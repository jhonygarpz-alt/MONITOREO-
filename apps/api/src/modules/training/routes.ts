import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncH, notFound, unprocessable } from '../../lib/errors';
import { requirePerm } from '../../middleware/auth';
import { parse, uuid } from '../../lib/http';
import { audit } from '../../lib/audit';
import { notifyUsers } from '../../lib/notify';
import { getSetting } from '../../lib/settings';

export const trainingRouter = Router();

trainingRouter.get('/sessions', requirePerm('training.view'), asyncH(async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 90 * 86400_000);
  res.json(await prisma.trainingSession.findMany({ where: { scheduledAt: { gte: from } }, include: { _count: { select: { attendance: true, agreements: true } } }, orderBy: { scheduledAt: 'asc' } }));
}));

trainingRouter.get('/sessions/:id', requirePerm('training.view'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const s = await prisma.trainingSession.findUnique({ where: { id }, include: { attendance: { include: { user: { select: { fullName: true } } } }, cases: true, agreements: { include: { responsible: { select: { fullName: true } } } }, evaluations: true } });
  if (!s) throw notFound('Sesión');
  res.json(s);
}));

const sessionSchema = z.object({
  title: z.string().trim().min(3), scheduledAt: z.coerce.date(), timezone: z.string().default('America/Mexico_City'), durationMin: z.number().int().min(15).max(480).default(60),
  agenda: z.string().max(5000).optional(), topics: z.array(z.string()).default([]), isDrill: z.boolean().default(false), drillScenario: z.string().max(3000).optional(),
});
trainingRouter.post('/sessions', requirePerm('training.manage'), asyncH(async (req, res) => {
  const b = parse(sessionSchema, req.body);
  if (b.isDrill && !b.drillScenario) throw unprocessable('Describa el escenario del simulacro');
  const confirmed = await getSetting<boolean>('training.timezoneConfirmed');
  const s = await prisma.trainingSession.create({ data: { ...b, timezoneConfirmed: confirmed, facilitatorId: req.user!.id } });
  await audit(prisma, { action: 'training.session_created', entityType: 'TrainingSession', entityId: s.id, after: b, req });
  res.status(201).json(s);
}));
trainingRouter.put('/sessions/:id', requirePerm('training.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(sessionSchema.partial().extend({ status: z.enum(['PROGRAMADA', 'REALIZADA', 'CANCELADA', 'REPROGRAMADA']).optional(), summary: z.string().max(10000).optional() }), req.body);
  const s = await prisma.trainingSession.update({ where: { id }, data: b });
  await audit(prisma, { action: 'training.session_updated', entityType: 'TrainingSession', entityId: id, after: b, req });
  res.json(s);
}));

trainingRouter.post('/sessions/:id/attendance', requirePerm('training.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { records } = parse(z.object({ records: z.array(z.object({ userId: uuid, present: z.boolean(), notes: z.string().optional() })).min(1) }), req.body);
  await prisma.$transaction(records.map((r) => prisma.trainingAttendance.upsert({ where: { sessionId_userId: { sessionId: id, userId: r.userId } }, update: { present: r.present, notes: r.notes }, create: { sessionId: id, ...r } })));
  await audit(prisma, { action: 'training.attendance', entityType: 'TrainingSession', entityId: id, after: { count: records.length }, req });
  res.json({ ok: true });
}));

trainingRouter.post('/sessions/:id/cases', requirePerm('training.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(z.object({ title: z.string().trim().min(3), incidentId: uuid.optional().nullable(), analysis: z.string().optional(), lessons: z.string().optional() }), req.body);
  res.status(201).json(await prisma.trainingCase.create({ data: { ...b, sessionId: id } }));
}));

trainingRouter.post('/sessions/:id/evaluations', requirePerm('training.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(z.object({ userId: uuid, score: z.number().min(0), maxScore: z.number().positive().default(100), notes: z.string().optional() }), req.body);
  if (b.score > b.maxScore) throw unprocessable('La calificación excede el máximo');
  res.status(201).json(await prisma.trainingEvaluation.upsert({ where: { sessionId_userId: { sessionId: id, userId: b.userId } }, update: b, create: { ...b, sessionId: id } }));
}));

trainingRouter.get('/agreements', requirePerm('training.view'), asyncH(async (req, res) => {
  res.json(await prisma.agreement.findMany({ where: req.query.open === 'false' ? {} : { status: { in: ['ABIERTO', 'EN_PROCESO', 'VENCIDO'] } }, include: { responsible: { select: { fullName: true } }, session: { select: { title: true, scheduledAt: true } } }, orderBy: { dueDate: 'asc' } }));
}));
trainingRouter.post('/agreements', requirePerm('training.manage'), asyncH(async (req, res) => {
  const b = parse(z.object({ sessionId: uuid.optional().nullable(), description: z.string().trim().min(5), responsibleId: uuid, dueDate: z.coerce.date() }), req.body);
  const a = await prisma.agreement.create({ data: b });
  await notifyUsers(prisma, [b.responsibleId], { type: 'agreement.assigned', title: 'Nuevo compromiso de mejora asignado', body: b.description, link: '/capacitacion' });
  await audit(prisma, { action: 'agreement.created', entityType: 'Agreement', entityId: a.id, after: b, req });
  res.status(201).json(a);
}));
trainingRouter.post('/agreements/:id/progress', requirePerm('training.view'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(z.object({ status: z.enum(['EN_PROCESO', 'CUMPLIDO', 'CANCELADO']), notes: z.string().trim().min(3) }), req.body);
  const a0 = await prisma.agreement.findUnique({ where: { id } });
  if (!a0) throw notFound('Acuerdo');
  const a = await prisma.agreement.update({ where: { id }, data: { status: b.status, progressNotes: `${a0.progressNotes ? a0.progressNotes + '\n' : ''}[${new Date().toISOString()}] ${req.user!.fullName}: ${b.notes}`, completedAt: b.status === 'CUMPLIDO' ? new Date() : null } });
  await audit(prisma, { action: 'agreement.progress', entityType: 'Agreement', entityId: id, after: b, req });
  res.json(a);
}));
