import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncH, forbidden, notFound, unprocessable } from '../../lib/errors';
import { requirePerm } from '../../middleware/auth';
import { parse, uuid } from '../../lib/http';
import { audit } from '../../lib/audit';
import { notifyUsers, usersWithPermission } from '../../lib/notify';
import { curfewStatus } from './service';
import { createChangeRequest } from '../admin/changes';

export const routeRouter = Router();
const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:mm');

routeRouter.get('/curfew-status', requirePerm('route.view'), asyncH(async (_req, res) => res.json(await curfewStatus())));

routeRouter.get('/rules', requirePerm('route.view'), asyncH(async (_req, res) => {
  res.json(await prisma.circulationRule.findMany({ include: { corridor: true, route: true }, orderBy: { createdAt: 'asc' } }));
}));

const ruleSchema = z.object({
  name: z.string().trim().min(3), corridorId: uuid.optional().nullable(), routeId: uuid.optional().nullable(),
  appliesBeyondMonterrey: z.boolean().default(false), curfewStart: HHMM, curfewEnd: HHMM,
  warnMinutesBefore: z.number().int().min(10).max(600).default(90), riskAssessmentRef: z.string().max(300).optional().nullable(),
  active: z.boolean().default(true), reason: z.string().trim().min(10, 'Justifique el cambio (mín. 10 caracteres)'),
});

/** Crear o modificar regla: genera solicitud que requiere autorización */
routeRouter.post('/rules', requirePerm('route.rules.manage'), asyncH(async (req, res) => {
  const { reason, ...b } = parse(ruleSchema, req.body);
  res.status(202).json(await createChangeRequest(req, 'CirculationRule', 'new', null, b, reason));
}));
routeRouter.put('/rules/:id', requirePerm('route.rules.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { reason, ...b } = parse(ruleSchema, req.body);
  const old = await prisma.circulationRule.findUnique({ where: { id } });
  if (!old) throw notFound('Regla');
  res.status(202).json(await createChangeRequest(req, 'CirculationRule', id, old, b, reason));
}));

// ---- Puntos de resguardo ----
routeRouter.get('/havens', requirePerm('route.view'), asyncH(async (req, res) => {
  res.json(await prisma.safeHaven.findMany({ where: req.query.validated === 'true' ? { validation: 'VALIDADO', active: true } : {}, include: { corridor: true }, orderBy: { name: 'asc' } }));
}));
const havenSchema = z.object({
  name: z.string().trim().min(3), state: z.string().trim().min(2), municipality: z.string().optional(), highway: z.string().optional(), kmMarker: z.string().optional(),
  lat: z.number().min(14).max(33), lng: z.number().min(-118).max(-86), corridorId: uuid.optional().nullable(), capacity: z.number().int().optional(),
  hours: z.string().optional(), contactPhone: z.string().optional(), source: z.string().trim().min(3, 'Indique la fuente de la información'),
});
routeRouter.post('/havens', requirePerm('risk.manage'), asyncH(async (req, res) => {
  const b = parse(havenSchema, req.body);
  const h = await prisma.safeHaven.create({ data: { ...b, validation: 'PENDIENTE' } });
  await audit(prisma, { action: 'haven.created', entityType: 'SafeHaven', entityId: h.id, after: b, req });
  res.status(201).json(h);
}));
routeRouter.put('/havens/:id', requirePerm('risk.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(havenSchema.partial(), req.body);
  const before = await prisma.safeHaven.findUniqueOrThrow({ where: { id } });
  // Cualquier cambio de datos regresa el punto a validación pendiente
  const h = await prisma.safeHaven.update({ where: { id }, data: { ...b, validation: 'PENDIENTE', validatedAt: null, validatedById: null } });
  await audit(prisma, { action: 'haven.updated', entityType: 'SafeHaven', entityId: id, before, after: b, req });
  res.json(h);
}));
routeRouter.post('/havens/:id/validate', requirePerm('risk.validate'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { decision, notes } = parse(z.object({ decision: z.enum(['VALIDADO', 'RECHAZADO']), notes: z.string().trim().min(5) }), req.body);
  const h = await prisma.safeHaven.update({ where: { id }, data: { validation: decision, validatedById: req.user!.id, validatedAt: new Date() } });
  await audit(prisma, { action: 'haven.validated', entityType: 'SafeHaven', entityId: id, after: { decision, notes }, req });
  res.json(h);
}));

// ---- Llegadas a resguardo ----
routeRouter.get('/arrivals', requirePerm('route.view'), asyncH(async (req, res) => {
  res.json(await prisma.havenArrival.findMany({
    where: req.query.open === 'true' ? { departedAt: null } : {},
    include: { unit: { select: { economicNumber: true } }, haven: { select: { name: true } }, trip: { select: { tripNumber: true } } }, orderBy: { arrivedAt: 'desc' }, take: 200,
  }));
}));
routeRouter.post('/arrivals', requirePerm('route.manage'), asyncH(async (req, res) => {
  const b = parse(z.object({ unitId: uuid, havenId: uuid, tripId: uuid.optional().nullable(), arrivedAt: z.coerce.date().optional(), evidence: z.string().trim().min(5, 'Describa cómo se verificó la llegada (GPS, cámara, llamada)') }), req.body);
  const haven = await prisma.safeHaven.findUnique({ where: { id: b.havenId } });
  if (!haven) throw notFound('Punto de resguardo');
  if (haven.validation !== 'VALIDADO') throw unprocessable('El punto de resguardo no está validado; no puede usarse operativamente');
  const open = await prisma.havenArrival.findFirst({ where: { unitId: b.unitId, departedAt: null } });
  if (open) throw unprocessable('La unidad ya tiene una llegada a resguardo abierta');
  const arrivedAt = b.arrivedAt ?? new Date();
  if (arrivedAt > new Date()) throw unprocessable('La hora de llegada no puede ser futura');
  const a = await prisma.$transaction(async (tx) => {
    const r = await tx.havenArrival.create({ data: { unitId: b.unitId, havenId: b.havenId, tripId: b.tripId ?? null, arrivedAt, evidence: b.evidence, recordedById: req.user!.id } });
    await tx.unit.update({ where: { id: b.unitId }, data: { opStatus: 'RESGUARDADA' } });
    if (b.tripId) await tx.trip.update({ where: { id: b.tripId }, data: { status: 'EN_RESGUARDO' } });
    await audit(tx, { action: 'haven.arrival', entityType: 'HavenArrival', entityId: r.id, after: b, req });
    return r;
  });
  res.status(201).json(a);
}));
routeRouter.post('/arrivals/:id/depart', requirePerm('route.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { notes } = parse(z.object({ notes: z.string().trim().min(3) }), req.body);
  const a = await prisma.havenArrival.findUnique({ where: { id } });
  if (!a || a.departedAt) throw unprocessable('Llegada no encontrada o ya cerrada');
  const r = await prisma.$transaction(async (tx) => {
    const u = await tx.havenArrival.update({ where: { id }, data: { departedAt: new Date() } });
    await tx.unit.update({ where: { id: a.unitId }, data: { opStatus: 'EN_TRANSITO' } });
    if (a.tripId) await tx.trip.update({ where: { id: a.tripId }, data: { status: 'EN_TRANSITO' } });
    await audit(tx, { action: 'haven.departure', entityType: 'HavenArrival', entityId: id, after: { notes }, req });
    return u;
  });
  res.json(r);
}));

// ---- Excepciones de circulación ----
routeRouter.get('/exceptions', requirePerm('route.view'), asyncH(async (_req, res) => {
  res.json(await prisma.curfewException.findMany({ include: { unit: { select: { economicNumber: true } }, trip: { select: { tripNumber: true } } }, orderBy: { validFrom: 'desc' }, take: 200 }));
}));
routeRouter.post('/exceptions', requirePerm('route.exceptions.request'), asyncH(async (req, res) => {
  const b = parse(z.object({
    unitId: uuid, tripId: uuid.optional().nullable(), reason: z.string().trim().min(10), riskAssessment: z.string().trim().min(30, 'La evaluación de riesgos debe documentarse (mín. 30 caracteres)'),
    validFrom: z.coerce.date(), validUntil: z.coerce.date(),
  }), req.body);
  if (b.validUntil <= b.validFrom) throw unprocessable('La vigencia final debe ser posterior a la inicial');
  if (b.validUntil.getTime() - b.validFrom.getTime() > 12 * 3600_000) throw unprocessable('Una excepción no puede exceder 12 horas');
  const e = await prisma.$transaction(async (tx) => {
    const r = await tx.curfewException.create({ data: { ...b, tripId: b.tripId ?? null, requestedById: req.user!.id } });
    await audit(tx, { action: 'curfew.exception_requested', entityType: 'CurfewException', entityId: r.id, after: b, req });
    const approvers = (await usersWithPermission(tx, 'route.exceptions.approve')).filter((x) => x !== req.user!.id);
    await notifyUsers(tx, approvers, { type: 'curfew.exception', title: 'Excepción de circulación por autorizar', body: b.reason, link: '/resguardos', severity: 'ALTA', dedupKey: `cexc-${r.id}` });
    return r;
  });
  res.status(201).json(e);
}));
routeRouter.post('/exceptions/:id/decide', requirePerm('route.exceptions.approve'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { approve, comment } = parse(z.object({ approve: z.boolean(), comment: z.string().trim().min(5) }), req.body);
  const e = await prisma.curfewException.findUnique({ where: { id } });
  if (!e) throw notFound('Excepción');
  if (e.requestedById === req.user!.id) throw forbidden('No puede autorizar su propia solicitud');
  if (e.status !== 'PENDIENTE') throw unprocessable('La solicitud ya fue resuelta');
  const r = await prisma.curfewException.update({ where: { id }, data: { status: approve ? 'APROBADA' : 'RECHAZADA', approvedById: req.user!.id, approvedAt: new Date() } });
  await audit(prisma, { action: approve ? 'curfew.exception_approved' : 'curfew.exception_rejected', entityType: 'CurfewException', entityId: id, after: { comment }, req });
  res.json(r);
}));
