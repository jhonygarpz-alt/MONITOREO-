import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { asyncH, forbidden, notFound, unprocessable } from '../../lib/errors';
import { can, requirePerm } from '../../middleware/auth';
import { parse, uuid } from '../../lib/http';
import { audit } from '../../lib/audit';
import { escalate } from '../incidents/escalation';
import { createIncident } from '../incidents/service';

export const alertsRouter = Router();
export const ALERT_TYPE = z.enum(['PERDIDA_GPS', 'POSIBLE_INTERFERENCIA', 'DESCONEXION_BATERIA', 'PARADA_SOSPECHOSA', 'DESVIACION_RUTA', 'EXCESO_VELOCIDAD', 'POSIBLE_ROBO', 'ACCIDENTE', 'FUGA', 'DERRAME', 'INCENDIO', 'EMERGENCIA_OPERADOR', 'FALLO_CAMARAS', 'INCUMPLIMIENTO_OPERATIVO', 'TIEMPO_MUERTO', 'BARRIDO_VENCIDO', 'RESTRICCION_HORARIA', 'INCUMPLIMIENTO_RESGUARDO', 'DOCUMENTO_POR_VENCER', 'ENTREGA_TURNO_PENDIENTE', 'POSICION_DESACTUALIZADA']);
export const SEVERITY = z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']);

/** Severidad por defecto según tipo (configurable en la captura manual) */
export const DEFAULT_SEVERITY: Record<string, 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'> = {
  POSIBLE_ROBO: 'CRITICA', ACCIDENTE: 'CRITICA', FUGA: 'CRITICA', DERRAME: 'CRITICA', INCENDIO: 'CRITICA', EMERGENCIA_OPERADOR: 'CRITICA',
  POSIBLE_INTERFERENCIA: 'ALTA', DESCONEXION_BATERIA: 'ALTA', PARADA_SOSPECHOSA: 'ALTA', DESVIACION_RUTA: 'ALTA', INCUMPLIMIENTO_RESGUARDO: 'ALTA', PERDIDA_GPS: 'ALTA',
  EXCESO_VELOCIDAD: 'MEDIA', FALLO_CAMARAS: 'MEDIA', TIEMPO_MUERTO: 'MEDIA', BARRIDO_VENCIDO: 'MEDIA', RESTRICCION_HORARIA: 'MEDIA', INCUMPLIMIENTO_OPERATIVO: 'MEDIA', POSICION_DESACTUALIZADA: 'MEDIA',
  DOCUMENTO_POR_VENCER: 'BAJA', ENTREGA_TURNO_PENDIENTE: 'MEDIA',
};

alertsRouter.get('/', requirePerm('alerts.view'), asyncH(async (req, res) => {
  const where: Prisma.AlertWhereInput = {};
  if (req.query.status === 'open' || !req.query.status) where.status = { in: ['NUEVA', 'EN_ATENCION', 'ESCALADA'] };
  else if (req.query.status !== 'all') where.status = req.query.status as never;
  if (req.query.severity) where.severity = req.query.severity as never;
  if (req.query.type) where.type = { in: String(req.query.type).split(',') as never };
  if (req.query.unitId) where.unitId = String(req.query.unitId);
  const rows = await prisma.alert.findMany({ where, include: { unit: { select: { id: true, economicNumber: true, plates: true } }, incident: { select: { id: true, folio: true } } }, orderBy: [{ detectedAt: 'desc' }], take: 500 });
  const rank = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAJA: 3 } as const;
  rows.sort((a, b) => rank[a.severity] - rank[b.severity] || +b.detectedAt - +a.detectedAt);
  res.json(rows);
}));

alertsRouter.post('/', requirePerm('alerts.manage'), asyncH(async (req, res) => {
  const b = parse(z.object({ type: ALERT_TYPE, severity: SEVERITY.optional(), unitId: uuid.optional().nullable(), title: z.string().trim().min(3).max(200).optional(), description: z.string().max(3000).optional(), lat: z.number().optional(), lng: z.number().optional() }), req.body);
  const a = await prisma.alert.create({ data: { type: b.type, severity: b.severity ?? DEFAULT_SEVERITY[b.type], unitId: b.unitId ?? null, title: b.title ?? b.type.replace(/_/g, ' '), description: b.description, lat: b.lat, lng: b.lng, source: 'MANUAL' } });
  await audit(prisma, { action: 'alert.created', entityType: 'Alert', entityId: a.id, after: b, req });
  res.status(201).json(a);
}));

alertsRouter.post('/:id/ack', requirePerm('alerts.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const a = await prisma.alert.findUnique({ where: { id } });
  if (!a) throw notFound('Alerta');
  if (!['NUEVA', 'ESCALADA'].includes(a.status)) throw unprocessable('La alerta ya está en atención o cerrada');
  const r = await prisma.alert.update({ where: { id }, data: { status: 'EN_ATENCION', firstResponseAt: a.firstResponseAt ?? new Date(), acknowledgedById: req.user!.id } });
  await audit(prisma, { action: 'alert.ack', entityType: 'Alert', entityId: id, req });
  res.json(r);
}));

alertsRouter.post('/:id/resolve', requirePerm('alerts.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { resolution, outcome } = parse(z.object({ resolution: z.string().trim().min(15, 'Describa la verificación realizada (mín. 15 caracteres)'), outcome: z.enum(['RESUELTA', 'DESCARTADA']) }), req.body);
  const a = await prisma.alert.findUnique({ where: { id } });
  if (!a) throw notFound('Alerta');
  if (['RESUELTA', 'DESCARTADA', 'CONVERTIDA_INCIDENCIA'].includes(a.status)) throw unprocessable('La alerta ya está cerrada');
  if (a.severity === 'CRITICA' && !can(req, 'incidents.close.approve')) {
    throw forbidden('Las alertas críticas no pueden descartarse por el monitorista: conviértala en incidencia o escálela a Gerencia');
  }
  const r = await prisma.alert.update({ where: { id }, data: { status: outcome, resolution, resolvedAt: new Date(), firstResponseAt: a.firstResponseAt ?? new Date() } });
  await audit(prisma, { action: `alert.${outcome.toLowerCase()}`, entityType: 'Alert', entityId: id, before: { status: a.status }, after: { resolution }, req });
  res.json(r);
}));

alertsRouter.post('/:id/escalate', requirePerm('incidents.escalate'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { reason } = parse(z.object({ reason: z.string().trim().min(5) }), req.body);
  const a = await prisma.alert.findUnique({ where: { id } });
  if (!a) throw notFound('Alerta');
  const r = await prisma.$transaction(async (tx) => {
    const e = await escalate(tx, { alertId: id, from: 'MONITORISTA', to: 'GERENCIA', reason, actorId: req.user!.id, alertType: a.type, title: a.title, link: '/alertas' });
    await tx.alert.update({ where: { id }, data: { status: 'ESCALADA', escalatedAt: new Date(), firstResponseAt: a.firstResponseAt ?? new Date() } });
    await audit(tx, { action: 'alert.escalated', entityType: 'Alert', entityId: id, after: { reason }, req });
    return e;
  });
  res.json(r);
}));

alertsRouter.post('/:id/convert', requirePerm('incidents.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { description } = parse(z.object({ description: z.string().max(3000).optional() }), req.body);
  const a = await prisma.alert.findUnique({ where: { id } });
  if (!a) throw notFound('Alerta');
  if (a.incidentId) return res.json({ id: a.incidentId, existing: true });
  const inc = await createIncident(req, { type: a.type, priority: a.severity, unitId: a.unitId, title: a.title, description: description ?? a.description ?? undefined, alertId: a.id });
  res.status(201).json(inc);
}));
