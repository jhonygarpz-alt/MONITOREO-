import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { asyncH, notFound, unprocessable } from '../../lib/errors';
import { requirePerm } from '../../middleware/auth';
import { parse, uuid } from '../../lib/http';
import { audit } from '../../lib/audit';
import { fleetStatus } from '../fleet';
import { getSetting } from '../../lib/settings';

export const unitsRouter = Router();
const UNIT_TYPE = z.enum(['TRACTOCAMION', 'AUTOTANQUE', 'REMOLQUE', 'TANQUE', 'DOLLY']);
const OPSTATUS = z.enum(['EN_TRANSITO', 'DETENIDA', 'RESGUARDADA', 'EN_PATIO', 'EN_PENSION', 'MANTENIMIENTO', 'FUERA_DE_SERVICIO']);
const unitSchema = z.object({
  economicNumber: z.string().trim().min(1).max(30), plates: z.string().trim().min(3).max(15).transform((s) => s.toUpperCase()),
  brand: z.string().optional().nullable(), model: z.string().optional().nullable(), year: z.number().int().min(1980).max(2100).optional().nullable(),
  vin: z.string().trim().length(17, 'El número de serie (VIN) debe tener 17 caracteres').transform((s) => s.toUpperCase()).optional().nullable(),
  type: UNIT_TYPE, baseId: uuid.optional().nullable(), opStatus: OPSTATUS.default('EN_PATIO'), capacityLiters: z.number().int().positive().optional().nullable(),
  nightRuleOverride: z.boolean().optional().nullable(), notes: z.string().max(3000).optional().nullable(),
});

/** Estado de flota en vivo con frescura del dato (búsqueda rápida por número económico) */
unitsRouter.get('/fleet', requirePerm('units.view'), asyncH(async (req, res) => {
  let rows = await fleetStatus();
  const q = String(req.query.q ?? '').trim().toLowerCase();
  if (q) rows = rows.filter((r) => r.economicNumber.toLowerCase().includes(q) || r.plates.toLowerCase().includes(q) || r.operator?.fullName.toLowerCase().includes(q));
  if (req.query.filter === 'attention') rows = rows.filter((r) => r.freshness !== 'ACTUALIZADA' || r.camerasWithFault > 0 || r.activeStop);
  res.json(rows);
}));

unitsRouter.get('/', requirePerm('units.view'), asyncH(async (req, res) => {
  const where: Prisma.UnitWhereInput = {};
  if (req.query.type) where.type = req.query.type as never;
  if (req.query.q) where.OR = [{ economicNumber: { contains: String(req.query.q), mode: 'insensitive' } }, { plates: { contains: String(req.query.q), mode: 'insensitive' } }];
  res.json(await prisma.unit.findMany({ where, include: { base: true, devices: true, _count: { select: { cameras: true } } }, orderBy: { economicNumber: 'asc' } }));
}));

unitsRouter.get('/:id', requirePerm('units.view'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const unit = await prisma.unit.findUnique({
    where: { id },
    include: {
      base: true, devices: true, cameras: { orderBy: { label: 'asc' } }, policies: { orderBy: { validTo: 'desc' } },
      assignments: { include: { operator: { select: { id: true, fullName: true, employeeNo: true, phonePrimary: true } } }, orderBy: { startAt: 'desc' }, take: 20 },
      couplingsAsMotor: { include: { trailer: { select: { id: true, economicNumber: true, plates: true, type: true } } }, orderBy: { coupledAt: 'desc' } },
      couplingsAsTrailer: { include: { motor: { select: { id: true, economicNumber: true } } }, where: { uncoupledAt: null } },
    },
  });
  if (!unit) throw notFound('Unidad');
  const [docs, positions, live, incidents] = await Promise.all([
    prisma.document.findMany({ where: { entityType: 'Unit', entityId: id, deletedAt: null }, orderBy: { uploadedAt: 'desc' } }),
    prisma.gpsPosition.findMany({ where: { unitId: id }, orderBy: { recordedAt: 'desc' }, take: 20 }),
    fleetStatus(new Date(), { ids: [id] }),
    prisma.incident.findMany({ where: { unitId: id }, select: { id: true, folio: true, title: true, status: true, openedAt: true, priority: true }, orderBy: { openedAt: 'desc' }, take: 10 }),
  ]);
  const warnDays = await getSetting<number>('docs.expiryWarnDays');
  const limit = new Date(Date.now() + warnDays * 86400_000);
  const expiring = [
    ...unit.policies.filter((p) => p.validTo <= limit).map((p) => ({ kind: 'Póliza', label: `${p.insurer} ${p.policyNumber}`, expiresAt: p.validTo, expired: p.validTo < new Date() })),
    ...docs.filter((d) => d.expiresAt && d.expiresAt <= limit).map((d) => ({ kind: 'Documento', label: d.title, expiresAt: d.expiresAt!, expired: d.expiresAt! < new Date() })),
  ];
  res.json({ ...unit, documents: docs, positions, live: live[0], incidents, expiring });
}));

unitsRouter.post('/', requirePerm('units.manage'), asyncH(async (req, res) => {
  const b = parse(unitSchema, req.body);
  const u = await prisma.unit.create({ data: { ...b, dataSource: 'MANUAL' } });
  await audit(prisma, { action: 'unit.created', entityType: 'Unit', entityId: u.id, after: b, req });
  res.status(201).json(u);
}));

unitsRouter.put('/:id', requirePerm('units.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(unitSchema.partial(), req.body);
  const before = await prisma.unit.findUniqueOrThrow({ where: { id } });
  const u = await prisma.unit.update({ where: { id }, data: b });
  await audit(prisma, { action: 'unit.updated', entityType: 'Unit', entityId: id, before, after: b, req });
  res.json(u);
}));

unitsRouter.post('/:id/status', requirePerm('ops.manage', 'units.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { opStatus, notes } = parse(z.object({ opStatus: OPSTATUS, notes: z.string().trim().min(3) }), req.body);
  const before = await prisma.unit.findUniqueOrThrow({ where: { id } });
  const u = await prisma.unit.update({ where: { id }, data: { opStatus } });
  await audit(prisma, { action: 'unit.status_changed', entityType: 'Unit', entityId: id, before: { opStatus: before.opStatus }, after: { opStatus, notes }, req });
  res.json(u);
}));

// Acoplamiento motriz ↔ remolque/tanque
unitsRouter.post('/:id/couple', requirePerm('units.manage'), asyncH(async (req, res) => {
  const motorId = parse(uuid, req.params.id);
  const { trailerId, position } = parse(z.object({ trailerId: uuid, position: z.number().int().min(1).max(3).default(1) }), req.body);
  const [m, t] = await Promise.all([prisma.unit.findUnique({ where: { id: motorId } }), prisma.unit.findUnique({ where: { id: trailerId } })]);
  if (!m || !t) throw notFound('Unidad');
  if (!['TRACTOCAMION', 'AUTOTANQUE'].includes(m.type)) throw unprocessable('Solo una unidad motriz puede tener remolques/tanques acoplados');
  if (!['REMOLQUE', 'TANQUE', 'DOLLY'].includes(t.type)) throw unprocessable('Solo remolques, tanques o dollies pueden acoplarse');
  const c = await prisma.$transaction(async (tx) => {
    await tx.unitCoupling.updateMany({ where: { trailerId, uncoupledAt: null }, data: { uncoupledAt: new Date() } });
    const x = await tx.unitCoupling.create({ data: { motorId, trailerId, position } });
    await audit(tx, { action: 'unit.coupled', entityType: 'Unit', entityId: motorId, after: { trailerId, position }, req });
    return x;
  });
  res.status(201).json(c);
}));
unitsRouter.post('/couplings/:id/uncouple', requirePerm('units.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const c = await prisma.unitCoupling.update({ where: { id }, data: { uncoupledAt: new Date() } });
  await audit(prisma, { action: 'unit.uncoupled', entityType: 'UnitCoupling', entityId: id, req });
  res.json(c);
}));

// Dispositivos GPS
unitsRouter.post('/:id/devices', requirePerm('units.manage'), asyncH(async (req, res) => {
  const unitId = parse(uuid, req.params.id);
  const b = parse(z.object({ provider: z.string().trim().min(2), identifier: z.string().trim().min(2), model: z.string().optional(), supportsImmobilizer: z.boolean().default(false) }), req.body);
  const d = await prisma.gpsDevice.create({ data: { ...b, unitId, immobilizerIntegrationValidated: false } });
  await audit(prisma, { action: 'device.created', entityType: 'GpsDevice', entityId: d.id, after: b, req });
  res.status(201).json(d);
}));

// Cámaras
unitsRouter.post('/:id/cameras', requirePerm('units.manage'), asyncH(async (req, res) => {
  const unitId = parse(uuid, req.params.id);
  const b = parse(z.object({ label: z.string().trim().min(2), channel: z.number().int().optional() }), req.body);
  const c = await prisma.camera.create({ data: { ...b, unitId, status: 'PENDIENTE_VALIDACION' } });
  await audit(prisma, { action: 'camera.created', entityType: 'Camera', entityId: c.id, after: b, req });
  res.status(201).json(c);
}));

// Pólizas
unitsRouter.post('/:id/policies', requirePerm('units.manage'), asyncH(async (req, res) => {
  const unitId = parse(uuid, req.params.id);
  const b = parse(z.object({ insurer: z.string().trim().min(2), policyNumber: z.string().trim().min(2), coverage: z.string().optional(), validFrom: z.coerce.date(), validTo: z.coerce.date(), claimsPhone: z.string().optional() }), req.body);
  if (b.validTo <= b.validFrom) throw unprocessable('La vigencia final debe ser posterior a la inicial');
  const p = await prisma.insurancePolicy.create({ data: { ...b, unitId } });
  await audit(prisma, { action: 'policy.created', entityType: 'InsurancePolicy', entityId: p.id, after: b, req });
  res.status(201).json(p);
}));

/** Captura manual de posición verificada (identificada como MANUAL, nunca como "en vivo") */
unitsRouter.post('/:id/positions', requirePerm('positions.capture'), asyncH(async (req, res) => {
  const unitId = parse(uuid, req.params.id);
  const b = parse(z.object({
    lat: z.number().min(14).max(33), lng: z.number().min(-118).max(-86), speedKph: z.number().min(0).max(200).optional(), recordedAt: z.coerce.date(),
    address: z.string().max(300).optional(), verification: z.string().trim().min(5, 'Indique cómo se verificó (plataforma GPS, llamada, etc.)'),
  }), req.body);
  if (b.recordedAt > new Date(Date.now() + 60000)) throw unprocessable('La hora de la posición no puede ser futura');
  const p = await prisma.gpsPosition.create({ data: { unitId, lat: b.lat, lng: b.lng, speedKph: b.speedKph, recordedAt: b.recordedAt, address: b.address, source: 'MANUAL', capturedBy: req.user!.id } });
  await audit(prisma, { action: 'position.manual_capture', entityType: 'GpsPosition', entityId: p.id, after: b, req });
  res.status(201).json(p);
}));
