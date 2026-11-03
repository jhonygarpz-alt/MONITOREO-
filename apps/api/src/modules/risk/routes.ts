import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { asyncH, notFound } from '../../lib/errors';
import { requirePerm } from '../../middleware/auth';
import { parse, uuid } from '../../lib/http';
import { audit } from '../../lib/audit';

export const riskRouter = Router();

const KIND = z.enum(['TRAMO_ALTO_RIESGO', 'ZONA_INCIDENCIAS', 'PARADA_PERMITIDA', 'PARADA_RESTRINGIDA', 'RUTA_ALTERNA']);
const CATEGORY = z.enum(['RIESGO_DOCUMENTADO', 'INCIDENTE_INTERNO', 'RESTRICCION_PREVENTIVA']);
const LEVEL = z.enum(['BAJO', 'MEDIO', 'ALTO', 'MUY_ALTO']);
const coord = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const geometry = z.union([
  z.object({ type: z.literal('Point'), coordinates: coord }),
  z.object({ type: z.literal('LineString'), coordinates: z.array(coord).min(2) }),
  z.object({ type: z.literal('Polygon'), coordinates: z.array(z.array(coord).min(4)).min(1) }),
]);
const featureSchema = z.object({
  kind: KIND, category: CATEGORY, name: z.string().trim().min(3), state: z.string().trim().min(2), highway: z.string().optional().nullable(),
  corridorId: uuid.optional().nullable(), geometry, level: LEVEL, reason: z.string().trim().min(5),
  source: z.string().trim().min(3, 'La fuente de información es obligatoria'), sourceDate: z.coerce.date().optional().nullable(),
  preventiveMeasures: z.string().optional().nullable(), circulationHours: z.string().optional().nullable(),
});

riskRouter.get('/features', requirePerm('risk.view'), asyncH(async (req, res) => {
  const where: Prisma.RiskFeatureWhereInput = {};
  if (req.query.kind) where.kind = req.query.kind as never;
  if (req.query.category) where.category = req.query.category as never;
  if (req.query.validation) where.validation = req.query.validation as never;
  res.json(await prisma.riskFeature.findMany({ where, include: { corridor: { select: { name: true } } }, orderBy: { updatedAt: 'desc' } }));
}));

riskRouter.post('/features', requirePerm('risk.manage'), asyncH(async (req, res) => {
  const b = parse(featureSchema, req.body);
  const f = await prisma.riskFeature.create({ data: { ...b, geometry: b.geometry as Prisma.InputJsonValue, validation: 'PENDIENTE' } });
  await audit(prisma, { action: 'risk.feature_created', entityType: 'RiskFeature', entityId: f.id, after: b, req });
  res.status(201).json(f);
}));

riskRouter.put('/features/:id', requirePerm('risk.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(featureSchema.partial(), req.body);
  const before = await prisma.riskFeature.findUnique({ where: { id } });
  if (!before) throw notFound('Zona');
  const f = await prisma.riskFeature.update({ where: { id }, data: { ...b, geometry: b.geometry as Prisma.InputJsonValue | undefined, validation: 'PENDIENTE', validatedAt: null, validatedById: null } });
  await audit(prisma, { action: 'risk.feature_updated', entityType: 'RiskFeature', entityId: id, before, after: b, req });
  res.json(f);
}));

riskRouter.post('/features/:id/validate', requirePerm('risk.validate'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { decision, notes } = parse(z.object({ decision: z.enum(['VALIDADO', 'RECHAZADO', 'VENCIDO']), notes: z.string().trim().min(5) }), req.body);
  const f = await prisma.riskFeature.update({ where: { id }, data: { validation: decision, validatedById: req.user!.id, validatedAt: new Date() } });
  await audit(prisma, { action: 'risk.feature_validated', entityType: 'RiskFeature', entityId: id, after: { decision, notes }, req });
  res.json(f);
}));

/**
 * Importación de información verificada en formato GeoJSON FeatureCollection.
 * Cada feature debe traer properties: kind, category, name, state, level, reason, source.
 * Todo lo importado entra como PENDIENTE de validación.
 */
riskRouter.post('/import', requirePerm('risk.manage'), asyncH(async (req, res) => {
  const fc = parse(z.object({ type: z.literal('FeatureCollection'), features: z.array(z.object({ type: z.literal('Feature'), geometry, properties: z.record(z.string(), z.unknown()) })).min(1).max(2000) }), req.body);
  const batch = crypto.randomUUID();
  const errors: { index: number; error: unknown }[] = [];
  const valid: Prisma.RiskFeatureCreateManyInput[] = [];
  fc.features.forEach((f, index) => {
    const r = featureSchema.safeParse({ ...f.properties, geometry: f.geometry });
    if (!r.success) errors.push({ index, error: r.error.flatten().fieldErrors });
    else valid.push({ ...r.data, geometry: r.data.geometry as Prisma.InputJsonValue, validation: 'PENDIENTE', importBatch: batch });
  });
  if (errors.length) return res.status(400).json({ error: { code: 'IMPORT_INVALID', message: `${errors.length} registros inválidos. No se importó nada.`, details: errors.slice(0, 50) } });
  const r = await prisma.riskFeature.createMany({ data: valid });
  await audit(prisma, { action: 'risk.import', entityType: 'RiskFeature', entityId: null, after: { batch, count: r.count }, req });
  res.status(201).json({ batch, imported: r.count });
}));
