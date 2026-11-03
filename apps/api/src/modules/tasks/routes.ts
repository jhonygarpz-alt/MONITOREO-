import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncH, notFound, unprocessable } from '../../lib/errors';
import { requirePerm } from '../../middleware/auth';
import { parse, uuid } from '../../lib/http';
import { audit } from '../../lib/audit';
import { notifyUsers } from '../../lib/notify';

export const tasksRouter = Router();

tasksRouter.get('/', requirePerm('tasks.view'), asyncH(async (req, res) => {
  const mine = req.query.mine === 'true';
  res.json(await prisma.task.findMany({
    where: { status: req.query.status === 'all' ? undefined : { in: ['ABIERTA', 'EN_PROCESO'] }, ...(mine ? { OR: [{ assigneeId: req.user!.id }, { assigneeId: null }] } : {}) },
    include: { assignee: { select: { fullName: true } }, createdBy: { select: { fullName: true } } }, orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }], take: 300,
  }));
}));

tasksRouter.post('/', requirePerm('tasks.manage'), asyncH(async (req, res) => {
  const b = parse(z.object({ title: z.string().trim().min(3).max(200), description: z.string().max(3000).optional(), priority: z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']).default('MEDIA'), assigneeId: uuid.optional().nullable(), dueAt: z.coerce.date().optional().nullable(), entityType: z.string().optional(), entityId: uuid.optional() }), req.body);
  const t = await prisma.task.create({ data: { ...b, createdById: req.user!.id } });
  if (b.assigneeId && b.assigneeId !== req.user!.id) await notifyUsers(prisma, [b.assigneeId], { type: 'task.assigned', title: `Nuevo pendiente: ${b.title}`, link: '/', severity: b.priority });
  await audit(prisma, { action: 'task.created', entityType: 'Task', entityId: t.id, after: b, req });
  res.status(201).json(t);
}));

tasksRouter.post('/:id/complete', requirePerm('tasks.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { notes, cancel } = parse(z.object({ notes: z.string().trim().min(3), cancel: z.boolean().default(false) }), req.body);
  const t = await prisma.task.findUnique({ where: { id } });
  if (!t) throw notFound('Pendiente');
  if (['COMPLETADA', 'CANCELADA'].includes(t.status)) throw unprocessable('El pendiente ya está cerrado');
  const r = await prisma.task.update({ where: { id }, data: { status: cancel ? 'CANCELADA' : 'COMPLETADA', completedAt: new Date(), completionNotes: notes } });
  await audit(prisma, { action: cancel ? 'task.cancelled' : 'task.completed', entityType: 'Task', entityId: id, after: { notes }, req });
  res.json(r);
}));
