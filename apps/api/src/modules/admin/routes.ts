import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { asyncH, forbidden, notFound, unprocessable } from '../../lib/errors';
import { requirePerm } from '../../middleware/auth';
import { page, parse, uuid } from '../../lib/http';
import { audit, verifyAuditChain } from '../../lib/audit';
import { DEFAULT_SETTINGS } from '../../lib/settings';
import { env } from '../../config/env';
import { clearAuthCache } from '../../middleware/auth';
import { createChangeRequest, decideChangeRequest } from './changes';
import { PERMISSIONS } from '../../rbac/catalog';

export const adminRouter = Router();

// ---------------- Usuarios ----------------
adminRouter.get('/users', requirePerm('admin.users', 'training.manage', 'incidents.manage', 'handover.create'), asyncH(async (_req, res) => {
  res.json(await prisma.user.findMany({ select: { id: true, email: true, fullName: true, employeeNo: true, phone: true, active: true, lastLoginAt: true, roles: { select: { role: { select: { key: true, name: true } } } } }, orderBy: { fullName: 'asc' } }));
}));

const userSchema = z.object({ email: z.string().email().transform((s) => s.toLowerCase()), fullName: z.string().trim().min(3), employeeNo: z.string().optional().nullable(), phone: z.string().optional().nullable(), roles: z.array(z.string()).min(1) });
adminRouter.post('/users', requirePerm('admin.users'), asyncH(async (req, res) => {
  const b = parse(userSchema, req.body);
  const roles = await prisma.role.findMany({ where: { key: { in: b.roles } } });
  if (roles.length !== b.roles.length) throw unprocessable('Rol inválido');
  const tempPassword = `Cim-${crypto.randomBytes(6).toString('base64url')}9a`;
  const u = await prisma.$transaction(async (tx) => {
    const x = await tx.user.create({ data: { email: b.email, fullName: b.fullName, employeeNo: b.employeeNo, phone: b.phone, passwordHash: await bcrypt.hash(tempPassword, env.BCRYPT_ROUNDS), mustChangePwd: true, roles: { create: roles.map((r) => ({ roleId: r.id })) } } });
    await audit(tx, { action: 'user.created', entityType: 'User', entityId: x.id, after: { ...b }, req });
    return x;
  });
  // La contraseña temporal se muestra una sola vez; nunca se almacena en claro
  res.status(201).json({ id: u.id, email: u.email, tempPassword });
}));

adminRouter.put('/users/:id', requirePerm('admin.users'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(userSchema.partial().extend({ active: z.boolean().optional() }), req.body);
  if (id === req.user!.id && (b.active === false || b.roles)) throw forbidden('No puede modificar sus propios roles ni desactivarse');
  const before = await prisma.user.findUnique({ where: { id }, include: { roles: { include: { role: true } } } });
  if (!before) throw notFound('Usuario');
  const u = await prisma.$transaction(async (tx) => {
    if (b.roles) {
      const roles = await tx.role.findMany({ where: { key: { in: b.roles } } });
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({ data: roles.map((r) => ({ userId: id, roleId: r.id })) });
    }
    const x = await tx.user.update({ where: { id }, data: { fullName: b.fullName, employeeNo: b.employeeNo, phone: b.phone, active: b.active, ...(b.active === false || b.roles ? { tokenVersion: { increment: 1 } } : {}) } });
    await audit(tx, { action: 'user.updated', entityType: 'User', entityId: id, before: { active: before.active, roles: before.roles.map((r) => r.role.key) }, after: b, req });
    return x;
  });
  clearAuthCache(id);
  res.json({ id: u.id });
}));

adminRouter.post('/users/:id/reset-password', requirePerm('admin.users'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const tempPassword = `Cim-${crypto.randomBytes(6).toString('base64url')}9a`;
  await prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(tempPassword, env.BCRYPT_ROUNDS), mustChangePwd: true, tokenVersion: { increment: 1 }, failedLogins: 0, lockedUntil: null } });
  clearAuthCache(id);
  await audit(prisma, { action: 'user.password_reset', entityType: 'User', entityId: id, req });
  res.json({ tempPassword });
}));

// ---------------- Roles y permisos ----------------
adminRouter.get('/roles', requirePerm('admin.roles', 'admin.users'), asyncH(async (_req, res) => {
  res.json(await prisma.role.findMany({ include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } }, orderBy: { name: 'asc' } }));
}));
adminRouter.get('/permissions', requirePerm('admin.roles', 'admin.users'), asyncH(async (_req, res) => res.json(await prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { key: 'asc' }] }))));
adminRouter.put('/roles/:key/permissions', requirePerm('admin.roles'), asyncH(async (req, res) => {
  const { permissions, reason } = parse(z.object({ permissions: z.array(z.string()).refine((ps) => ps.every((p) => p in PERMISSIONS), 'Permiso inválido'), reason: z.string().trim().min(10) }), req.body);
  const role = await prisma.role.findUnique({ where: { key: req.params.key }, include: { permissions: { include: { permission: true } } } });
  if (!role) throw notFound('Rol');
  res.status(202).json(await createChangeRequest(req, 'RolePermissions', role.key, role.permissions.map((p) => p.permission.key), permissions, reason));
}));

// ---------------- Configuración ----------------
adminRouter.get('/settings', requirePerm('admin.settings', 'admin.audit', 'dashboard.executive'), asyncH(async (_req, res) => {
  const rows = await prisma.setting.findMany();
  const map = new Map(rows.map((r) => [r.key, r]));
  res.json(Object.entries(DEFAULT_SETTINGS).map(([key, d]) => ({ key, value: map.get(key)?.value ?? d.value, critical: d.critical, description: d.description, version: map.get(key)?.version ?? 0, updatedAt: map.get(key)?.updatedAt ?? null })));
}));
adminRouter.put('/settings/:key', requirePerm('admin.settings'), asyncH(async (req, res) => {
  const key = req.params.key;
  const def = DEFAULT_SETTINGS[key];
  if (!def) throw notFound('Parámetro');
  const { value, reason } = parse(z.object({ value: z.unknown(), reason: z.string().trim().min(10, 'Justifique el cambio (mín. 10 caracteres)') }), req.body);
  if (typeof value !== typeof def.value) throw unprocessable(`El valor debe ser de tipo ${typeof def.value}`);
  if (key === 'sweep.intervalMinutes' && (Number(value) < 30 || Number(value) > 240)) throw unprocessable('La periodicidad debe estar entre 30 y 240 minutos');
  if (key.endsWith('timezone')) { try { new Intl.DateTimeFormat('es-MX', { timeZone: String(value) }); } catch { throw unprocessable('Zona horaria inválida'); } }
  const current = await prisma.setting.findUnique({ where: { key } });
  res.status(202).json(await createChangeRequest(req, 'Setting', key, current?.value ?? def.value, value, reason));
}));
adminRouter.get('/change-requests', requirePerm('admin.settings', 'admin.settings.approve', 'admin.audit'), asyncH(async (req, res) => {
  res.json(await prisma.configChangeRequest.findMany({ where: req.query.status ? { status: req.query.status as never } : {}, orderBy: { requestedAt: 'desc' }, take: 200 }));
}));
adminRouter.post('/change-requests/:id/decide', requirePerm('admin.settings.approve'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { approve, comment } = parse(z.object({ approve: z.boolean(), comment: z.string().trim().min(5) }), req.body);
  res.json(await decideChangeRequest(req, id, approve, comment));
}));

// ---------------- Matriz de escalamiento (suplentes) ----------------
adminRouter.get('/escalation-matrix', requirePerm('admin.settings', 'incidents.escalate'), asyncH(async (_req, res) => {
  res.json(await prisma.escalationMatrixEntry.findMany({ include: { primaryUser: { select: { fullName: true, active: true } }, substituteUser: { select: { fullName: true, active: true } } }, orderBy: { level: 'asc' } }));
}));
adminRouter.post('/escalation-matrix', requirePerm('admin.settings.approve'), asyncH(async (req, res) => {
  const b = parse(z.object({ level: z.enum(['MONITORISTA', 'GERENCIA', 'OPERACIONES_ESTRATEGICAS']), alertType: z.string().optional().nullable(), primaryUserId: uuid, substituteUserId: uuid.optional().nullable(), ackTimeoutMinutes: z.number().int().min(1).max(240).default(10) }), req.body);
  if (b.primaryUserId === b.substituteUserId) throw unprocessable('El suplente debe ser otra persona');
  const e = await prisma.escalationMatrixEntry.create({ data: { ...b, alertType: (b.alertType as never) || null } });
  await audit(prisma, { action: 'escalation_matrix.created', entityType: 'EscalationMatrixEntry', entityId: e.id, after: b, req });
  res.status(201).json(e);
}));
adminRouter.delete('/escalation-matrix/:id', requirePerm('admin.settings.approve'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const before = await prisma.escalationMatrixEntry.findUniqueOrThrow({ where: { id } });
  const e = await prisma.escalationMatrixEntry.update({ where: { id }, data: { active: false } });
  await audit(prisma, { action: 'escalation_matrix.deactivated', entityType: 'EscalationMatrixEntry', entityId: id, before, req });
  res.json(e);
}));

// ---------------- Turnos ----------------
adminRouter.get('/shifts', requirePerm('handover.view'), asyncH(async (_req, res) => res.json(await prisma.shiftDefinition.findMany({ orderBy: { startTime: 'asc' } }))));
adminRouter.post('/shifts', requirePerm('admin.catalogs'), asyncH(async (req, res) => {
  const b = parse(z.object({ name: z.string().trim().min(2), startTime: z.string().regex(/^\d{2}:\d{2}$/), endTime: z.string().regex(/^\d{2}:\d{2}$/) }), req.body);
  const s = await prisma.shiftDefinition.create({ data: b });
  await audit(prisma, { action: 'shift.created', entityType: 'ShiftDefinition', entityId: s.id, after: b, req });
  res.status(201).json(s);
}));

// ---------------- Integraciones ----------------
adminRouter.get('/integrations', requirePerm('admin.integrations', 'admin.audit', 'dashboard.executive'), asyncH(async (_req, res) => res.json(await prisma.integration.findMany({ orderBy: { name: 'asc' } }))));
adminRouter.put('/integrations/:key', requirePerm('admin.integrations'), asyncH(async (req, res) => {
  const b = parse(z.object({ enabled: z.boolean().optional(), validated: z.boolean().optional(), notes: z.string().max(3000).optional() }), req.body);
  const before = await prisma.integration.findUnique({ where: { key: req.params.key } });
  if (!before) throw notFound('Integración');
  if (b.enabled && !(b.validated ?? before.validated)) throw unprocessable('No se puede habilitar una integración sin validación técnica, legal y de seguridad documentada');
  if (b.validated && !b.notes) throw unprocessable('Documente la validación (fabricante, compatibilidad, procedimiento legal, pruebas)');
  const i = await prisma.integration.update({ where: { key: req.params.key }, data: b });
  await audit(prisma, { action: 'integration.updated', entityType: 'Integration', entityId: i.id, before, after: b, req });
  res.json(i);
}));

adminRouter.post('/integrations/optima/sync', requirePerm('admin.integrations'), asyncH(async (req, res) => {
  const { fetchOptimaRows, syncOptima } = await import('../integrations/optima');
  try {
    res.json(await syncOptima(await fetchOptimaRows(), { id: req.user!.id, email: req.user!.email }));
  } catch (e) {
    await prisma.integration.updateMany({ where: { key: 'optima' }, data: { lastError: (e as Error).message.slice(0, 500) } });
    throw unprocessable(`No se pudo sincronizar con Optima: ${(e as Error).message}`);
  }
}));

// ---------------- Auditoría ----------------
adminRouter.get('/audit', requirePerm('admin.audit'), asyncH(async (req, res) => {
  const { take, skip } = page(req.query);
  const where: Prisma.AuditLogWhereInput = {};
  if (req.query.entityType) where.entityType = String(req.query.entityType);
  if (req.query.entityId) where.entityId = String(req.query.entityId);
  if (req.query.actorId) where.actorId = String(req.query.actorId);
  if (req.query.action) where.action = { contains: String(req.query.action) };
  if (req.query.from || req.query.to) where.at = { ...(req.query.from ? { gte: new Date(String(req.query.from)) } : {}), ...(req.query.to ? { lte: new Date(String(req.query.to)) } : {}) };
  const [rows, total] = await Promise.all([prisma.auditLog.findMany({ where, orderBy: { seq: 'desc' }, take, skip }), prisma.auditLog.count({ where })]);
  res.json({ total, rows: rows.map((r) => ({ ...r, seq: r.seq.toString() })) });
}));
adminRouter.get('/audit/verify', requirePerm('admin.audit'), asyncH(async (_req, res) => res.json(await verifyAuditChain())));
adminRouter.get('/jobs', requirePerm('admin.audit', 'admin.integrations'), asyncH(async (_req, res) => res.json(await prisma.jobRun.findMany({ orderBy: { startedAt: 'desc' }, take: 200 }))));
