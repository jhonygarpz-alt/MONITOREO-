import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { asyncH, notFound, unprocessable } from '../../lib/errors';
import { can, requirePerm } from '../../middleware/auth';
import { parse, uuid } from '../../lib/http';
import { audit } from '../../lib/audit';

export const operatorsRouter = Router();
const phone = z.string().trim().regex(/^\+?[0-9\s-]{7,20}$/, 'Teléfono inválido');
const opSchema = z.object({
  employeeNo: z.string().trim().min(1), fullName: z.string().trim().min(3), phonePrimary: phone.optional().nullable(), phoneAlt: phone.optional().nullable(),
  emergencyContactName: z.string().optional().nullable(), emergencyContactPhone: phone.optional().nullable(), emergencyContactRelation: z.string().optional().nullable(),
  status: z.enum(['ACTIVO', 'DESCANSO', 'VACACIONES', 'INCAPACIDAD', 'BAJA']).default('ACTIVO'), baseId: uuid.optional().nullable(),
  authorizedNotes: z.string().max(2000).optional().nullable(), licenseNumber: z.string().optional().nullable(), licenseExpiresAt: z.coerce.date().optional().nullable(),
});
const SENSITIVE = ['emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation'] as const;

function redact<T extends Record<string, unknown>>(o: T, allowed: boolean) {
  if (allowed) return o;
  const c = { ...o } as Record<string, unknown>;
  SENSITIVE.forEach((k) => { c[k] = c[k] ? '•••• (restringido)' : null; });
  return c as T;
}

operatorsRouter.get('/', requirePerm('operators.view'), asyncH(async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const where: Prisma.OperatorWhereInput = {};
  if (q) where.OR = [{ fullName: { contains: q, mode: 'insensitive' } }, { employeeNo: { contains: q, mode: 'insensitive' } }, { assignments: { some: { endAt: null, unit: { economicNumber: { contains: q, mode: 'insensitive' } } } } }];
  if (req.query.status) where.status = req.query.status as never;
  if (req.query.baseId) where.baseId = String(req.query.baseId);
  const rows = await prisma.operator.findMany({ where, include: { base: true, assignments: { where: { endAt: null }, include: { unit: { select: { id: true, economicNumber: true } } } } }, orderBy: { fullName: 'asc' } });
  const sens = can(req, 'operators.sensitive');
  res.json(rows.map((r) => redact(r as unknown as Record<string, unknown>, sens)));
}));

operatorsRouter.get('/:id', requirePerm('operators.view'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const op = await prisma.operator.findUnique({ where: { id }, include: { base: true, assignments: { include: { unit: { select: { economicNumber: true } } }, orderBy: { startAt: 'desc' } } } });
  if (!op) throw notFound('Operador');
  const sens = can(req, 'operators.sensitive');
  res.json(redact(op as unknown as Record<string, unknown>, sens));
}));

/** Consulta explícita del contacto de emergencia: requiere permiso, finalidad y queda auditada */
operatorsRouter.post('/:id/emergency-contact', requirePerm('operators.sensitive'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { purpose } = parse(z.object({ purpose: z.string().trim().min(10, 'Indique la finalidad de la consulta') }), req.body);
  const op = await prisma.operator.findUnique({ where: { id }, select: { emergencyContactName: true, emergencyContactPhone: true, emergencyContactRelation: true } });
  if (!op) throw notFound('Operador');
  await audit(prisma, { action: 'operator.sensitive_viewed', entityType: 'Operator', entityId: id, after: { purpose }, req });
  res.json(op);
}));

operatorsRouter.post('/', requirePerm('operators.manage'), asyncH(async (req, res) => {
  const b = parse(opSchema, req.body);
  const op = await prisma.operator.create({ data: b });
  await audit(prisma, { action: 'operator.created', entityType: 'Operator', entityId: op.id, after: { ...b, emergencyContactPhone: b.emergencyContactPhone ? '[set]' : null }, req });
  res.status(201).json(op);
}));

operatorsRouter.put('/:id', requirePerm('operators.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(opSchema.partial(), req.body);
  if (!can(req, 'operators.sensitive')) SENSITIVE.forEach((k) => delete (b as Record<string, unknown>)[k]);
  const before = await prisma.operator.findUniqueOrThrow({ where: { id } });
  const op = await prisma.operator.update({ where: { id }, data: b });
  await audit(prisma, { action: 'operator.updated', entityType: 'Operator', entityId: id, before: { status: before.status, phonePrimary: before.phonePrimary }, after: { ...b, emergencyContactPhone: b.emergencyContactPhone ? '[changed]' : undefined }, req });
  res.json(op);
}));

/** Asignar operador a unidad: cierra asignaciones vigentes (historial conservado) */
operatorsRouter.post('/:id/assign', requirePerm('operators.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { unitId } = parse(z.object({ unitId: uuid.nullable() }), req.body);
  const op = await prisma.operator.findUnique({ where: { id } });
  if (!op) throw notFound('Operador');
  if (unitId && op.status === 'BAJA') throw unprocessable('No se puede asignar un operador dado de baja');
  const r = await prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.operatorAssignment.updateMany({ where: { operatorId: id, endAt: null }, data: { endAt: now } });
    if (unitId) {
      await tx.operatorAssignment.updateMany({ where: { unitId, endAt: null }, data: { endAt: now } });
      const a = await tx.operatorAssignment.create({ data: { operatorId: id, unitId, assignedBy: req.user!.id, startAt: now } });
      await audit(tx, { action: 'operator.assigned', entityType: 'Operator', entityId: id, after: { unitId }, req });
      return a;
    }
    await audit(tx, { action: 'operator.unassigned', entityType: 'Operator', entityId: id, req });
    return null;
  });
  res.json(r);
}));
