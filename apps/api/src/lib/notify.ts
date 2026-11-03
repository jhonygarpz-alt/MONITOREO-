import type { Severity } from '@prisma/client';
import { prisma, type Db } from './prisma';

export interface NotifyInput { type: string; title: string; body?: string; link?: string; severity?: Severity; dedupKey?: string }

/** Notificación interna (bandeja de la aplicación). Deduplicada por usuario + dedupKey. */
export async function notifyUsers(db: Db, userIds: string[], n: NotifyInput) {
  const ids = [...new Set(userIds)];
  if (!ids.length) return 0;
  const r = await db.notification.createMany({
    data: ids.map((userId) => ({ userId, type: n.type, title: n.title, body: n.body, link: n.link, severity: n.severity ?? 'MEDIA', dedupKey: n.dedupKey })),
    skipDuplicates: true,
  });
  return r.count;
}

export async function usersWithRoles(db: Db, roleKeys: string[]) {
  const rows = await db.user.findMany({ where: { active: true, roles: { some: { role: { key: { in: roleKeys } } } } }, select: { id: true } });
  return rows.map((r) => r.id);
}

export async function usersWithPermission(db: Db, perm: string) {
  const rows = await db.user.findMany({ where: { active: true, roles: { some: { role: { permissions: { some: { permission: { key: perm } } } } } } }, select: { id: true } });
  return rows.map((r) => r.id);
}

export async function notifyRoles(db: Db, roleKeys: string[], n: NotifyInput) {
  return notifyUsers(db, await usersWithRoles(db, roleKeys), n);
}
