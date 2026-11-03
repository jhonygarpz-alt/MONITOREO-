import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { asyncH } from '../../lib/errors';
import { parse, uuid } from '../../lib/http';

export const notificationsRouter = Router();
notificationsRouter.get('/', asyncH(async (req, res) => {
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.notification.count({ where: { userId: req.user!.id, readAt: null } }),
  ]);
  res.json({ unread, rows });
}));
notificationsRouter.post('/:id/read', asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  await prisma.notification.updateMany({ where: { id, userId: req.user!.id }, data: { readAt: new Date() } });
  res.json({ ok: true });
}));
notificationsRouter.post('/read-all', asyncH(async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user!.id, readAt: null }, data: { readAt: new Date() } });
  res.json({ ok: true });
}));
