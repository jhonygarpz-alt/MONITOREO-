import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncH, notFound, unprocessable } from '../../lib/errors';
import { requirePerm } from '../../middleware/auth';
import { parse, uuid } from '../../lib/http';
import { audit } from '../../lib/audit';
import { activeStopsEvaluated, PROTECTED_STOP_REASONS } from './service';
import { createChangeRequest } from '../admin/changes';

export const opsRouter = Router();
const REASON = z.enum(['DESCANSO_OBLIGATORIO', 'FATIGA', 'EMERGENCIA', 'FALLA_MECANICA', 'CONDICION_INSEGURA', 'CARGA', 'DESCARGA', 'ESPERA_CLIENTE', 'TRAFICO', 'INSPECCION_AUTORIDAD', 'ALIMENTOS', 'COMBUSTIBLE', 'NO_AUTORIZADA', 'DESCONOCIDO']);
const OPTYPE = z.enum(['TRANSITO', 'CARGA', 'DESCARGA', 'RESGUARDO', 'PATIO', 'MANTENIMIENTO']);

opsRouter.get('/stops', requirePerm('ops.view'), asyncH(async (req, res) => {
  if (req.query.active === 'false') {
    return res.json(await prisma.stop.findMany({ where: { status: 'FINALIZADA' }, include: { unit: { select: { economicNumber: true } } }, orderBy: { endedAt: 'desc' }, take: 200 }));
  }
  res.json(await activeStopsEvaluated());
}));

opsRouter.post('/stops', requirePerm('ops.manage'), asyncH(async (req, res) => {
  const b = parse(z.object({
    unitId: uuid, tripId: uuid.optional().nullable(), operationType: OPTYPE.default('TRANSITO'), startedAt: z.coerce.date().optional(),
    reason: REASON.default('DESCONOCIDO'), authorized: z.boolean().default(false), lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional(),
    locationText: z.string().max(300).optional(), notes: z.string().max(2000).optional(),
  }), req.body);
  if (b.startedAt && b.startedAt > new Date()) throw unprocessable('La hora de inicio no puede ser futura');
  const stop = await prisma.$transaction(async (tx) => {
    const s = await tx.stop.create({ data: { unitId: b.unitId, tripId: b.tripId ?? null, operationType: b.operationType, startedAt: b.startedAt ?? new Date(), reason: b.reason, authorized: b.authorized, lat: b.lat, lng: b.lng, locationText: b.locationText, createdById: req.user!.id, source: 'MANUAL' } });
    if (b.notes) await tx.stopFollowUp.create({ data: { stopId: s.id, notes: b.notes, actorId: req.user!.id } });
    await tx.unit.update({ where: { id: b.unitId }, data: { opStatus: 'DETENIDA' } });
    await audit(tx, { action: 'ops.stop_created', entityType: 'Stop', entityId: s.id, after: b, req });
    return s;
  });
  res.status(201).json(stop);
}));

opsRouter.patch('/stops/:id', requirePerm('ops.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(z.object({ reason: REASON.optional(), authorized: z.boolean().optional(), operationType: OPTYPE.optional(), notes: z.string().trim().min(3).max(2000) }), req.body);
  const before = await prisma.stop.findUnique({ where: { id } });
  if (!before) throw notFound('Parada');
  const s = await prisma.$transaction(async (tx) => {
    const u = await tx.stop.update({ where: { id }, data: { reason: b.reason, authorized: b.authorized, operationType: b.operationType } });
    await tx.stopFollowUp.create({ data: { stopId: id, notes: b.notes, actorId: req.user!.id } });
    await audit(tx, { action: 'ops.stop_updated', entityType: 'Stop', entityId: id, before, after: b, req });
    return u;
  });
  res.json(s);
}));

opsRouter.post('/stops/:id/followups', requirePerm('ops.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { notes } = parse(z.object({ notes: z.string().trim().min(3).max(2000) }), req.body);
  const f = await prisma.stopFollowUp.create({ data: { stopId: id, notes, actorId: req.user!.id } });
  await audit(prisma, { action: 'ops.stop_followup', entityType: 'Stop', entityId: id, after: { notes }, req });
  res.status(201).json(f);
}));

opsRouter.post('/stops/:id/end', requirePerm('ops.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { notes, newStatus } = parse(z.object({ notes: z.string().trim().min(3).max(2000), newStatus: z.enum(['EN_TRANSITO', 'RESGUARDADA', 'EN_PATIO', 'MANTENIMIENTO', 'EN_PENSION']).default('EN_TRANSITO') }), req.body);
  const s = await prisma.stop.findUnique({ where: { id } });
  if (!s || s.status !== 'ACTIVA') throw unprocessable('La parada no está activa');
  const r = await prisma.$transaction(async (tx) => {
    const u = await tx.stop.update({ where: { id }, data: { status: 'FINALIZADA', endedAt: new Date() } });
    await tx.stopFollowUp.create({ data: { stopId: id, notes: `Cierre: ${notes}`, actorId: req.user!.id } });
    await tx.unit.update({ where: { id: s.unitId }, data: { opStatus: newStatus } });
    await audit(tx, { action: 'ops.stop_ended', entityType: 'Stop', entityId: id, after: { notes, newStatus }, req });
    return u;
  });
  res.json(r);
}));

/** Recordatorio al operador para continuar: bloqueado ante descanso, fatiga, emergencia, falla o condición insegura. */
opsRouter.post('/stops/:id/reminders', requirePerm('ops.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(z.object({
    channel: z.enum(['LLAMADA', 'MENSAJE', 'RADIO', 'APP_GPS']), message: z.string().trim().min(5).max(500),
    safeConditionsConfirmed: z.literal(true, { message: 'Confirme que es seguro y procedente solicitar la continuación' }),
    operatorConfirmed: z.boolean().default(false),
  }), req.body);
  const s = await prisma.stop.findUnique({ where: { id } });
  if (!s || s.status !== 'ACTIVA') throw unprocessable('La parada no está activa');
  if (PROTECTED_STOP_REASONS.includes(s.reason)) {
    throw unprocessable(`No se permite solicitar movimiento: la detención está registrada como ${s.reason.replace(/_/g, ' ').toLowerCase()}. La seguridad y el descanso del operador tienen prioridad.`);
  }
  const r = await prisma.$transaction(async (tx) => {
    const rem = await tx.operatorReminder.create({ data: { stopId: id, channel: b.channel, message: b.message, confirmed: b.operatorConfirmed, sentById: req.user!.id } });
    await audit(tx, { action: 'ops.operator_reminder', entityType: 'Stop', entityId: id, after: { ...b, confirmed: b.operatorConfirmed }, req });
    return rem;
  });
  res.status(201).json(r);
}));

opsRouter.get('/thresholds', requirePerm('ops.view'), asyncH(async (_req, res) => {
  res.json(await prisma.deadTimeThreshold.findMany({ orderBy: { operationType: 'asc' } }));
}));

opsRouter.put('/thresholds/:type', requirePerm('admin.settings'), asyncH(async (req, res) => {
  const type = parse(OPTYPE, req.params.type);
  const b = parse(z.object({ warnMinutes: z.number().int().positive(), maxMinutes: z.number().int().positive(), escalateMinutes: z.number().int().positive(), reason: z.string().trim().min(10) }), req.body);
  if (!(b.warnMinutes <= b.maxMinutes && b.maxMinutes <= b.escalateMinutes)) throw unprocessable('Debe cumplirse: advertencia ≤ máximo ≤ escalamiento');
  const old = await prisma.deadTimeThreshold.findUnique({ where: { operationType: type } });
  const cr = await createChangeRequest(req, 'DeadTimeThreshold', type, old, { warnMinutes: b.warnMinutes, maxMinutes: b.maxMinutes, escalateMinutes: b.escalateMinutes }, b.reason);
  res.status(202).json(cr);
}));
