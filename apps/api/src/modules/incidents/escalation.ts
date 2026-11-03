import type { EscalationLevel, AlertType } from '@prisma/client';
import { type Db } from '../../lib/prisma';
import { notifyUsers, usersWithRoles } from '../../lib/notify';

const NEXT: Record<EscalationLevel, EscalationLevel | null> = { MONITORISTA: 'GERENCIA', GERENCIA: 'OPERACIONES_ESTRATEGICAS', OPERACIONES_ESTRATEGICAS: null };
export const nextLevel = (l: EscalationLevel) => NEXT[l];

/**
 * Resuelve destinatarios con la matriz de escalamiento. Si no hay matriz o el titular
 * está inactivo, usa el suplente; si tampoco hay, todos los usuarios del rol del nivel.
 */
export async function resolveRecipients(db: Db, level: EscalationLevel, alertType?: AlertType | null) {
  const entries = await db.escalationMatrixEntry.findMany({
    where: { level, active: true, OR: [{ alertType: alertType ?? undefined }, { alertType: null }] },
    include: { primaryUser: true, substituteUser: true },
  });
  const ids: { userId: string; isSubstitute: boolean }[] = [];
  for (const e of entries.sort((a, b) => (a.alertType ? -1 : 1) - (b.alertType ? -1 : 1))) {
    if (e.primaryUser.active) ids.push({ userId: e.primaryUserId, isSubstitute: false });
    if (e.substituteUser?.active) ids.push({ userId: e.substituteUserId!, isSubstitute: !e.primaryUser.active });
  }
  if (!ids.length) {
    const roleKey = level === 'GERENCIA' ? 'GERENCIA' : level === 'OPERACIONES_ESTRATEGICAS' ? 'OPERACIONES_ESTRATEGICAS' : 'SUPERVISOR';
    (await usersWithRoles(db, [roleKey])).forEach((userId) => ids.push({ userId, isSubstitute: false }));
    // Si no hay nadie en Gerencia: suplencia por Operaciones Estratégicas y viceversa
    if (!ids.length && level === 'GERENCIA') (await usersWithRoles(db, ['OPERACIONES_ESTRATEGICAS'])).forEach((userId) => ids.push({ userId, isSubstitute: true }));
    if (!ids.length && level === 'OPERACIONES_ESTRATEGICAS') (await usersWithRoles(db, ['GERENCIA'])).forEach((userId) => ids.push({ userId, isSubstitute: true }));
  }
  return ids;
}

export async function escalate(db: Db, opts: {
  incidentId?: string; alertId?: string; from: EscalationLevel; to: EscalationLevel; reason: string; actorId?: string | null;
  automatic?: boolean; alertType?: AlertType | null; title: string; link: string;
}) {
  const recipients = await resolveRecipients(db, opts.to, opts.alertType);
  const created = [];
  for (const r of recipients.length ? recipients : [{ userId: null as unknown as string, isSubstitute: false }]) {
    created.push(await db.escalation.create({
      data: { incidentId: opts.incidentId, alertId: opts.alertId, fromLevel: opts.from, toLevel: opts.to, toUserId: r.userId ?? null, isSubstitute: r.isSubstitute, reason: opts.reason, actorId: opts.actorId ?? null, automatic: !!opts.automatic },
    }));
  }
  await notifyUsers(db, recipients.map((r) => r.userId), {
    type: 'escalation', title: `Escalamiento a ${opts.to.replace('_', ' ')}: ${opts.title}`, body: opts.reason, link: opts.link, severity: 'CRITICA',
    dedupKey: `esc-${opts.incidentId ?? opts.alertId}-${opts.to}`,
  });
  return { escalations: created, recipients: recipients.length };
}
