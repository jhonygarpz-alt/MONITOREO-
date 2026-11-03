import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { DEFAULT_SETTINGS, invalidateSettings } from '../../lib/settings';
import { notifyUsers, usersWithPermission } from '../../lib/notify';
import { conflict, forbidden, notFound, unprocessable } from '../../lib/errors';
import { clearAuthCache } from '../../middleware/auth';

export const CHANGE_TARGETS = ['Setting', 'DeadTimeThreshold', 'CirculationRule', 'RolePermissions'] as const;

/** Toda modificación de configuración crítica se registra como solicitud y requiere autorización de un tercero. */
export async function createChangeRequest(req: Request, targetType: (typeof CHANGE_TARGETS)[number], targetKey: string, oldValue: unknown, newValue: unknown, reason: string) {
  const pending = await prisma.configChangeRequest.findFirst({ where: { targetType, targetKey, status: 'PENDIENTE' } });
  if (pending) throw conflict('Ya existe una solicitud de cambio pendiente para esta configuración');
  return prisma.$transaction(async (tx) => {
    const cr = await tx.configChangeRequest.create({
      data: { targetType, targetKey, oldValue: (oldValue ?? undefined) as Prisma.InputJsonValue, newValue: newValue as Prisma.InputJsonValue, reason, requestedById: req.user!.id },
    });
    await audit(tx, { action: 'config.change_requested', entityType: 'ConfigChangeRequest', entityId: cr.id, before: oldValue, after: { targetType, targetKey, newValue, reason }, req });
    const approvers = (await usersWithPermission(tx, 'admin.settings.approve')).filter((u) => u !== req.user!.id);
    await notifyUsers(tx, approvers, { type: 'config.change', title: 'Cambio de configuración por autorizar', body: `${targetType} · ${targetKey}`, link: '/configuracion', severity: 'ALTA', dedupKey: `cr-${cr.id}` });
    return cr;
  });
}

async function apply(tx: Tx, cr: { targetType: string; targetKey: string; newValue: Prisma.JsonValue }, userId: string) {
  const v = cr.newValue as Record<string, unknown>;
  switch (cr.targetType) {
    case 'Setting': {
      const def = DEFAULT_SETTINGS[cr.targetKey];
      await tx.setting.upsert({
        where: { key: cr.targetKey },
        update: { value: cr.newValue as Prisma.InputJsonValue, version: { increment: 1 }, updatedById: userId },
        create: { key: cr.targetKey, value: cr.newValue as Prisma.InputJsonValue, critical: def?.critical ?? true, description: def?.description, updatedById: userId },
      });
      invalidateSettings();
      return;
    }
    case 'DeadTimeThreshold':
      await tx.deadTimeThreshold.upsert({
        where: { operationType: cr.targetKey as never },
        update: { warnMinutes: Number(v.warnMinutes), maxMinutes: Number(v.maxMinutes), escalateMinutes: Number(v.escalateMinutes) },
        create: { operationType: cr.targetKey as never, warnMinutes: Number(v.warnMinutes), maxMinutes: Number(v.maxMinutes), escalateMinutes: Number(v.escalateMinutes) },
      });
      return;
    case 'CirculationRule': {
      const data = {
        name: String(v.name), corridorId: (v.corridorId as string) || null, routeId: (v.routeId as string) || null,
        appliesBeyondMonterrey: !!v.appliesBeyondMonterrey, curfewStart: String(v.curfewStart), curfewEnd: String(v.curfewEnd),
        warnMinutesBefore: Number(v.warnMinutesBefore ?? 90), riskAssessmentRef: (v.riskAssessmentRef as string) || null, active: v.active !== false,
      };
      if (cr.targetKey === 'new') await tx.circulationRule.create({ data });
      else await tx.circulationRule.update({ where: { id: cr.targetKey }, data: { ...data, version: { increment: 1 } } });
      return;
    }
    case 'RolePermissions': {
      const role = await tx.role.findUniqueOrThrow({ where: { key: cr.targetKey } });
      const perms = await tx.permission.findMany({ where: { key: { in: (cr.newValue as string[]) ?? [] } } });
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      await tx.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })) });
      clearAuthCache();
      return;
    }
    default:
      throw unprocessable('Tipo de cambio no soportado');
  }
}

export async function decideChangeRequest(req: Request, id: string, approve: boolean, comment: string) {
  const cr = await prisma.configChangeRequest.findUnique({ where: { id } });
  if (!cr) throw notFound('Solicitud');
  if (cr.status !== 'PENDIENTE') throw conflict('La solicitud ya fue resuelta');
  if (cr.requestedById === req.user!.id) throw forbidden('Quien solicita un cambio no puede autorizarlo');
  return prisma.$transaction(async (tx) => {
    if (approve) await apply(tx, cr, req.user!.id);
    const r = await tx.configChangeRequest.update({ where: { id }, data: { status: approve ? 'APLICADA' : 'RECHAZADA', decidedById: req.user!.id, decidedAt: new Date(), decisionComment: comment } });
    await audit(tx, { action: approve ? 'config.change_applied' : 'config.change_rejected', entityType: cr.targetType, entityId: null, before: cr.oldValue, after: { key: cr.targetKey, newValue: cr.newValue, comment }, req });
    await notifyUsers(tx, [cr.requestedById], { type: 'config.decided', title: approve ? 'Cambio de configuración aplicado' : 'Cambio de configuración rechazado', body: `${cr.targetType} · ${cr.targetKey}: ${comment}`, link: '/configuracion' });
    return r;
  });
}
