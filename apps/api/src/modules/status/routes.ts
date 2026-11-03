import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { asyncH, notFound, unprocessable } from '../../lib/errors';
import { requirePerm } from '../../middleware/auth';
import { parse, uuid } from '../../lib/http';
import { audit } from '../../lib/audit';
import { nextFolio } from '../../lib/folio';
import { latestPositions } from '../fleet';

/**
 * Comandas de estatus para clientes. El contenido se FILTRA en servidor según las
 * autorizaciones del cliente: nunca coordenadas exactas en tiempo real, ni datos de seguridad.
 */
export const statusRouter = Router();
const TRIP_STATUS = z.enum(['PROGRAMADO', 'EN_TRASLADO_A_CARGA', 'EN_CARGA', 'CARGADO', 'EN_TRANSITO', 'EN_RESGUARDO', 'EN_DESCARGA', 'DESCARGADO', 'FINALIZADO', 'CON_INCIDENCIA']);

statusRouter.get('/trips', requirePerm('status.view'), asyncH(async (req, res) => {
  res.json(await prisma.trip.findMany({
    where: req.query.all === 'true' ? {} : { status: { notIn: ['FINALIZADO', 'CANCELADO'] } },
    include: { client: true, unit: { select: { economicNumber: true } }, operator: { select: { fullName: true } }, route: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 300,
  }));
}));

statusRouter.post('/trips', requirePerm('trips.manage'), asyncH(async (req, res) => {
  const b = parse(z.object({
    tripNumber: z.string().trim().min(1), clientId: uuid, routeId: uuid.optional().nullable(), unitId: uuid, operatorId: uuid.optional().nullable(),
    trailerIds: z.array(z.string()).default([]), product: z.string().optional(), unNumber: z.string().regex(/^(UN)?\d{4}$/i, 'Número ONU inválido').optional().nullable(),
    volumeLiters: z.number().int().positive().optional(), origin: z.string().trim().min(2), destination: z.string().trim().min(2), scheduledStart: z.coerce.date().optional(), observations: z.string().optional(),
  }), req.body);
  const t = await prisma.trip.create({ data: b });
  await audit(prisma, { action: 'trip.created', entityType: 'Trip', entityId: t.id, after: b, req });
  res.status(201).json(t);
}));

statusRouter.post('/trips/:id/status', requirePerm('status.create', 'trips.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(z.object({ status: TRIP_STATUS, eta: z.coerce.date().optional().nullable(), etaSource: z.string().max(200).optional().nullable(), observations: z.string().max(2000).optional() }), req.body);
  if (b.eta && !b.etaSource) throw unprocessable('Indique la base de la hora estimada (p.ej. distancia restante y velocidad promedio)');
  const before = await prisma.trip.findUniqueOrThrow({ where: { id } });
  const t = await prisma.trip.update({ where: { id }, data: { status: b.status, eta: b.eta, etaSource: b.etaSource, observations: b.observations ?? before.observations, ...(b.status === 'EN_TRANSITO' && !before.startedAt ? { startedAt: new Date() } : {}), ...(b.status === 'FINALIZADO' ? { finishedAt: new Date() } : {}) } });
  await audit(prisma, { action: 'trip.status', entityType: 'Trip', entityId: id, before: { status: before.status }, after: b, req });
  res.json(t);
}));

/** Construye el contenido seguro de la comanda */
async function buildSnapshot(tripId: string, includeOperator: boolean, observations?: string) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: { client: true, unit: true, operator: true } });
  if (!trip) throw notFound('Viaje');
  const pos = (await latestPositions(prisma, [trip.unitId])).get(trip.unitId);
  const showOp = includeOperator && trip.client.canSeeOperator;
  let location = 'Información de ubicación no autorizada para este destinatario';
  if (trip.client.canSeeApproxLocation) location = pos?.address ? `Cercanías de ${pos.address.split(',').slice(-2).join(',').trim()}` : 'Sin ubicación verificada disponible';
  return {
    trip,
    snapshot: {
      client: trip.client.name, tripNumber: trip.tripNumber, economicNumber: trip.unit.economicNumber, trailers: trip.trailerIds,
      operator: showOp ? trip.operator?.fullName ?? null : null, origin: trip.origin, destination: trip.destination, currentLocation: location,
      status: trip.status, lastUpdate: (pos?.recordedAt ?? trip.updatedAt).toISOString(), lastUpdateSource: pos?.source ?? 'MANUAL',
      eta: trip.eta && trip.etaSource ? trip.eta.toISOString() : null, observations: observations ?? trip.observations ?? null,
    },
  };
}

statusRouter.post('/trips/:id/preview', requirePerm('status.create'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { includeOperator, observations } = parse(z.object({ includeOperator: z.boolean().default(false), observations: z.string().max(1000).optional() }), req.body);
  const { snapshot, trip } = await buildSnapshot(id, includeOperator, observations);
  res.json({ snapshot, permissions: { canSeeOperator: trip.client.canSeeOperator, canSeeApproxLocation: trip.client.canSeeApproxLocation } });
}));

statusRouter.post('/trips/:id/reports', requirePerm('status.create'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(z.object({ includeOperator: z.boolean().default(false), observations: z.string().max(1000).optional() }), req.body);
  const { snapshot, trip } = await buildSnapshot(id, b.includeOperator, b.observations);
  const r = await prisma.$transaction(async (tx) => {
    const folio = await nextFolio(tx, 'EST', 'status_reports');
    const x = await tx.statusReport.create({ data: { folio, tripId: id, snapshot: { ...snapshot, folio } as Prisma.InputJsonValue, status: trip.status, observations: b.observations, includeOperator: !!snapshot.operator, generatedById: req.user!.id } });
    await audit(tx, { action: 'status_report.generated', entityType: 'StatusReport', entityId: x.id, after: { folio, tripId: id }, req });
    return x;
  });
  res.status(201).json(r);
}));

statusRouter.post('/reports/:id/shared', requirePerm('status.create'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(z.object({ via: z.enum(['WHATSAPP', 'CORREO', 'PDF', 'IMAGEN']), to: z.string().trim().min(3).max(300) }), req.body);
  const r = await prisma.statusReport.update({ where: { id }, data: { sharedVia: b.via, sharedTo: b.to, sharedAt: new Date() } });
  await audit(prisma, { action: 'status_report.shared', entityType: 'StatusReport', entityId: id, after: b, req });
  res.json(r);
}));

statusRouter.get('/reports', requirePerm('status.view'), asyncH(async (req, res) => {
  res.json(await prisma.statusReport.findMany({ where: req.query.tripId ? { tripId: String(req.query.tripId) } : {}, orderBy: { generatedAt: 'desc' }, take: 200 }));
}));
