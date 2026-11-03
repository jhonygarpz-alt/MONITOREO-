import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { asyncH, forbidden, notFound, unprocessable } from '../../lib/errors';
import { requirePerm, can } from '../../middleware/auth';
import { parse, uuid } from '../../lib/http';
import { audit, incidentEvent } from '../../lib/audit';
import { notifyUsers } from '../../lib/notify';
import { buildHandoverSnapshot } from './service';

export const handoverRouter = Router();

handoverRouter.get('/preview', requirePerm('handover.create'), asyncH(async (_req, res) => res.json(await buildHandoverSnapshot())));

handoverRouter.get('/', requirePerm('handover.view'), asyncH(async (_req, res) => {
  res.json(await prisma.shiftHandover.findMany({ include: { outgoingUser: { select: { fullName: true } }, incomingUser: { select: { fullName: true } }, shift: true }, orderBy: { createdAt: 'desc' }, take: 100 }));
}));

handoverRouter.get('/pending-for-me', requirePerm('handover.create'), asyncH(async (req, res) => {
  res.json(await prisma.shiftHandover.findMany({
    where: { status: { in: ['PENDIENTE_CONFIRMACION', 'ESCALADA_SUPERVISION'] }, outgoingUserId: { not: req.user!.id }, OR: [{ incomingUserId: req.user!.id }, { incomingUserId: null }] },
    include: { outgoingUser: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' },
  }));
}));

handoverRouter.get('/:id', requirePerm('handover.view'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const h = await prisma.shiftHandover.findUnique({ where: { id }, include: { outgoingUser: { select: { fullName: true } }, incomingUser: { select: { fullName: true } }, shift: true } });
  if (!h) throw notFound('Entrega de turno');
  res.json(h);
}));

handoverRouter.post('/', requirePerm('handover.create'), asyncH(async (req, res) => {
  const b = parse(z.object({ incomingUserId: uuid.optional().nullable(), shiftId: uuid.optional().nullable(), priorities: z.string().trim().min(3, 'Indique las actividades prioritarias').max(5000), instructions: z.string().max(5000).optional(), notes: z.string().max(5000).optional() }), req.body);
  if (b.incomingUserId === req.user!.id) throw unprocessable('El monitorista entrante debe ser otra persona');
  const open = await prisma.shiftHandover.findFirst({ where: { outgoingUserId: req.user!.id, status: 'PENDIENTE_CONFIRMACION' } });
  if (open) throw unprocessable('Ya tiene una entrega de turno pendiente de confirmación');
  const snapshot = await buildHandoverSnapshot();
  const h = await prisma.$transaction(async (tx) => {
    const x = await tx.shiftHandover.create({ data: { ...b, outgoingUserId: req.user!.id, snapshot: snapshot as unknown as Prisma.InputJsonValue } });
    if (b.incomingUserId) await notifyUsers(tx, [b.incomingUserId], { type: 'handover.incoming', title: `${req.user!.fullName} le entrega el turno`, body: 'Revise y confirme la recepción', link: `/turnos/${x.id}`, severity: 'ALTA', dedupKey: `ho-${x.id}` });
    await audit(tx, { action: 'handover.created', entityType: 'ShiftHandover', entityId: x.id, after: { ...b, incidents: snapshot.incidents.length, pendingSweeps: snapshot.sweeps.progress.pending }, req });
    return x;
  });
  res.status(201).json(h);
}));

/** El entrante confirma recepción. Los responsables de incidencias y pendientes se conservan, salvo que explícitamente los asuma. */
handoverRouter.post('/:id/acknowledge', requirePerm('handover.create'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(z.object({ withObservations: z.boolean().default(false), comments: z.string().max(5000).optional(), assumeTaskIds: z.array(uuid).default([]), assumeIncidentIds: z.array(uuid).default([]) }), req.body);
  const h = await prisma.shiftHandover.findUnique({ where: { id } });
  if (!h) throw notFound('Entrega de turno');
  if (!['PENDIENTE_CONFIRMACION', 'ESCALADA_SUPERVISION'].includes(h.status)) throw unprocessable('La entrega ya fue confirmada');
  if (h.outgoingUserId === req.user!.id) throw forbidden('El monitorista saliente no puede confirmar su propia entrega');
  if (h.incomingUserId && h.incomingUserId !== req.user!.id && !can(req, 'handover.supervise')) throw forbidden('Esta entrega está asignada a otro monitorista');
  if (b.withObservations && !b.comments?.trim()) throw unprocessable('Describa las observaciones');
  const r = await prisma.$transaction(async (tx) => {
    const u = await tx.shiftHandover.update({ where: { id }, data: { status: b.withObservations ? 'CON_OBSERVACIONES' : 'CONFIRMADA', acknowledgedAt: new Date(), incomingUserId: h.incomingUserId ?? req.user!.id, receiverComments: b.comments } });
    for (const tid of b.assumeTaskIds) {
      await tx.task.update({ where: { id: tid }, data: { assigneeId: req.user!.id, originHandoverId: id } });
    }
    for (const iid of b.assumeIncidentIds) {
      const inc = await tx.incident.update({ where: { id: iid }, data: { responsibleId: req.user!.id } });
      
      await incidentEvent(tx, iid, 'REASIGNADA', `Asumida por ${req.user!.fullName} en cambio de turno`, { id: req.user!.id, fullName: req.user!.fullName }, { handoverId: id, folio: inc.folio });
    }
    await audit(tx, { action: 'handover.acknowledged', entityType: 'ShiftHandover', entityId: id, after: b, req });
    await notifyUsers(tx, [h.outgoingUserId], { type: 'handover.ack', title: 'Entrega de turno confirmada', body: `${req.user!.fullName} confirmó la recepción${b.withObservations ? ' con observaciones' : ''}`, link: `/turnos/${id}` });
    return u;
  });
  res.json(r);
}));
