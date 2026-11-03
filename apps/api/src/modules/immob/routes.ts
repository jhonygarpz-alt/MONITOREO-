import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { asyncH, forbidden, notFound, unprocessable } from '../../lib/errors';
import { requirePerm } from '../../middleware/auth';
import { actor, parse, uuid } from '../../lib/http';
import { audit, incidentEvent } from '../../lib/audit';
import { nextFolio } from '../../lib/folio';
import { notifyUsers, usersWithPermission } from '../../lib/notify';
import { fleetStatus } from '../fleet';

/**
 * CONTROL DE INMOVILIZACIÓN — Solo flujo de solicitud, doble autorización y registro.
 * El sistema NO envía comandos físicos. La única modalidad admitida es el bloqueo del
 * siguiente arranque con la unidad detenida. La ejecución se registra solo con la
 * confirmación del proveedor GPS.
 */
export const immobRouter = Router();

async function assertStopped(unitId: string) {
  const [u] = await fleetStatus(new Date(), { ids: [unitId] });
  if (!u) throw notFound('Unidad');
  if (!u.position || u.freshness !== 'ACTUALIZADA') {
    throw unprocessable('No hay posición GPS actualizada: no puede confirmarse que la unidad esté detenida. Operación bloqueada.');
  }
  if ((u.position.speedKph ?? 0) > 0) {
    throw unprocessable(`BLOQUEADO: la unidad reporta ${u.position.speedKph} km/h. No se permite ninguna intervención con el vehículo en movimiento.`);
  }
  return u;
}

const conditionsSchema = z.object({
  vehicleStopped: z.literal(true, { message: 'Debe confirmarse que el vehículo está detenido' }),
  safeLocation: z.literal(true, { message: 'Debe confirmarse que la ubicación es segura' }),
  noRiskToPeople: z.literal(true, { message: 'Debe confirmarse que no hay riesgo para personas o terceros' }),
  operatorStatusKnown: z.boolean(),
  authoritiesInformed: z.boolean(),
  notes: z.string().max(2000).optional(),
});

immobRouter.get('/', requirePerm('immob.view'), asyncH(async (_req, res) => {
  res.json(await prisma.immobilizationRequest.findMany({
    include: { unit: { select: { economicNumber: true, plates: true } }, requestedBy: { select: { fullName: true } }, executor: { select: { fullName: true } }, authorizations: { include: { approver: { select: { fullName: true } } } }, incident: { select: { folio: true } } },
    orderBy: { requestedAt: 'desc' }, take: 200,
  }));
}));

immobRouter.get('/executors', requirePerm('immob.view'), asyncH(async (_req, res) => {
  res.json(await prisma.user.findMany({ where: { active: true, roles: { some: { role: { key: 'EJECUTOR_GPS' } } } }, select: { id: true, fullName: true } }));
}));

immobRouter.post('/', requirePerm('immob.request'), asyncH(async (req, res) => {
  const b = parse(z.object({ unitId: uuid, incidentId: uuid.optional().nullable(), reason: z.string().trim().min(10), riskAssessment: z.string().trim().min(30, 'Documente la evaluación de riesgo (mín. 30 caracteres)'), conditions: conditionsSchema }), req.body);
  const device = await prisma.gpsDevice.findFirst({ where: { unitId: b.unitId, active: true } });
  if (!device) throw unprocessable('La unidad no tiene dispositivo GPS registrado');
  if (!device.supportsImmobilizer) throw unprocessable('El dispositivo GPS de la unidad no reporta función de inmovilización');
  const live = await assertStopped(b.unitId);
  const r = await prisma.$transaction(async (tx) => {
    const folio = await nextFolio(tx, 'INM', 'immobilization_requests');
    const x = await tx.immobilizationRequest.create({
      data: { folio, unitId: b.unitId, incidentId: b.incidentId ?? null, reason: b.reason, riskAssessment: b.riskAssessment, conditions: b.conditions as Prisma.InputJsonValue, verifiedSpeedKph: live.position!.speedKph ?? 0, verifiedPositionAt: live.position!.recordedAt, requestedById: req.user!.id },
    });
    if (b.incidentId) await incidentEvent(tx, b.incidentId, 'INMOVILIZACION', `Solicitud de inmovilización ${folio} (bloqueo de siguiente arranque) — pendiente de doble autorización`, actor(req));
    const approvers = (await usersWithPermission(tx, 'immob.authorize')).filter((u) => u !== req.user!.id);
    await notifyUsers(tx, approvers, { type: 'immob.request', title: `Autorización requerida: ${folio}`, body: `${live.economicNumber}: ${b.reason}`, link: '/inmovilizacion', severity: 'CRITICA', dedupKey: `immob-${x.id}` });
    await audit(tx, { action: 'immob.requested', entityType: 'ImmobilizationRequest', entityId: x.id, after: b, req });
    return x;
  });
  res.status(201).json(r);
}));

immobRouter.post('/:id/authorize', requirePerm('immob.authorize'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { decision, comment } = parse(z.object({ decision: z.enum(['APROBADA', 'RECHAZADA']), comment: z.string().trim().min(10) }), req.body);
  const r0 = await prisma.immobilizationRequest.findUnique({ where: { id }, include: { authorizations: true } });
  if (!r0) throw notFound('Solicitud');
  if (!['SOLICITADA', 'PRIMERA_AUTORIZACION'].includes(r0.status)) throw unprocessable('La solicitud no está en etapa de autorización');
  if (r0.requestedById === req.user!.id) throw forbidden('El solicitante no puede autorizar su propia solicitud');
  if (r0.authorizations.some((a) => a.approverId === req.user!.id)) throw forbidden('Ya registró su autorización; se requiere una segunda persona');
  if (decision === 'APROBADA') await assertStopped(r0.unitId);
  const r = await prisma.$transaction(async (tx) => {
    await tx.authorization.create({ data: { requestId: id, approverId: req.user!.id, decision, comment } });
    const approvals = r0.authorizations.filter((a) => a.decision === 'APROBADA').length + (decision === 'APROBADA' ? 1 : 0);
    const status = decision === 'RECHAZADA' ? 'RECHAZADA' : approvals >= 2 ? 'AUTORIZADA' : 'PRIMERA_AUTORIZACION';
    const u = await tx.immobilizationRequest.update({ where: { id }, data: { status } });
    if (r0.incidentId) await incidentEvent(tx, r0.incidentId, 'INMOVILIZACION', `${r0.folio}: ${decision === 'APROBADA' ? `autorización ${approvals}/2` : 'rechazada'} — ${comment}`, actor(req));
    await audit(tx, { action: `immob.${decision.toLowerCase()}`, entityType: 'ImmobilizationRequest', entityId: id, after: { decision, comment, status }, req });
    if (status === 'AUTORIZADA') {
      const ex = await tx.user.findMany({ where: { active: true, roles: { some: { role: { key: 'EJECUTOR_GPS' } } } }, select: { id: true } });
      await notifyUsers(tx, ex.map((e) => e.id), { type: 'immob.authorized', title: `${r0.folio} autorizada: requiere ejecución`, link: '/inmovilizacion', severity: 'CRITICA', dedupKey: `immob-auth-${id}` });
    }
    return u;
  });
  res.json(r);
}));

immobRouter.post('/:id/execution', requirePerm('immob.execute'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(z.object({
    providerConfirmation: z.string().trim().min(3, 'Capture el folio/confirmación del proveedor GPS'), executionNotes: z.string().trim().min(10),
    outcome: z.enum(['CONFIRMADA', 'FALLIDA']),
  }), req.body);
  const r0 = await prisma.immobilizationRequest.findUnique({ where: { id } });
  if (!r0) throw notFound('Solicitud');
  if (r0.status !== 'AUTORIZADA') throw unprocessable('Solo se puede registrar la ejecución de solicitudes con doble autorización');
  if (r0.requestedById === req.user!.id) throw forbidden('El solicitante no puede ser el ejecutor');
  await assertStopped(r0.unitId);
  const r = await prisma.$transaction(async (tx) => {
    // Un intento fallido NO se registra como ejecutado: la solicitud permanece AUTORIZADA
    const u = b.outcome === 'CONFIRMADA'
      ? await tx.immobilizationRequest.update({ where: { id }, data: { status: 'EJECUCION_REGISTRADA', executorId: req.user!.id, providerConfirmation: b.providerConfirmation, executionNotes: b.executionNotes, executedAt: new Date() } })
      : await tx.immobilizationRequest.update({ where: { id }, data: { executionNotes: `[INTENTO FALLIDO ${new Date().toISOString()}] ${b.executionNotes}` } });
    if (r0.incidentId) await incidentEvent(tx, r0.incidentId, 'INMOVILIZACION', b.outcome === 'CONFIRMADA' ? `${r0.folio}: ejecución confirmada por proveedor (${b.providerConfirmation})` : `${r0.folio}: intento de ejecución FALLIDO — ${b.executionNotes}`, actor(req));
    await audit(tx, { action: b.outcome === 'CONFIRMADA' ? 'immob.executed' : 'immob.execution_failed', entityType: 'ImmobilizationRequest', entityId: id, after: b, req });
    return u;
  });
  res.json({ request: r, commandSentBySystem: false, note: 'El sistema no envía comandos físicos; se registró la acción realizada en la plataforma del proveedor.' });
}));

immobRouter.post('/:id/restore', requirePerm('immob.execute'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(z.object({ restorationNotes: z.string().trim().min(10), providerConfirmation: z.string().trim().min(3) }), req.body);
  const r0 = await prisma.immobilizationRequest.findUnique({ where: { id } });
  if (!r0 || r0.status !== 'EJECUCION_REGISTRADA') throw unprocessable('Solo se restablecen intervenciones ejecutadas');
  const r = await prisma.$transaction(async (tx) => {
    const u = await tx.immobilizationRequest.update({ where: { id }, data: { status: 'RESTABLECIDA', restoredAt: new Date(), restorationNotes: `${b.restorationNotes} (confirmación: ${b.providerConfirmation})` } });
    if (r0.incidentId) await incidentEvent(tx, r0.incidentId, 'INMOVILIZACION', `${r0.folio}: restablecimiento confirmado (${b.providerConfirmation})`, actor(req));
    await audit(tx, { action: 'immob.restored', entityType: 'ImmobilizationRequest', entityId: id, after: b, req });
    return u;
  });
  res.json(r);
}));

immobRouter.post('/:id/cancel', requirePerm('immob.request', 'immob.authorize'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { reason } = parse(z.object({ reason: z.string().trim().min(5) }), req.body);
  const r0 = await prisma.immobilizationRequest.findUnique({ where: { id } });
  if (!r0 || !['SOLICITADA', 'PRIMERA_AUTORIZACION', 'AUTORIZADA'].includes(r0.status)) throw unprocessable('No se puede cancelar en el estado actual');
  const r = await prisma.immobilizationRequest.update({ where: { id }, data: { status: 'CANCELADA', executionNotes: `Cancelada: ${reason}` } });
  await audit(prisma, { action: 'immob.cancelled', entityType: 'ImmobilizationRequest', entityId: id, after: { reason }, req });
  res.json(r);
}));
