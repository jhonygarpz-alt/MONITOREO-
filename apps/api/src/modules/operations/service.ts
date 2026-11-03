import type { OperationType, StopReason } from '@prisma/client';
import { prisma } from '../../lib/prisma';

/** Motivos en los que NUNCA se solicita al operador reanudar la marcha. */
export const PROTECTED_STOP_REASONS: StopReason[] = ['DESCANSO_OBLIGATORIO', 'FATIGA', 'EMERGENCIA', 'FALLA_MECANICA', 'CONDICION_INSEGURA', 'INSPECCION_AUTORIDAD'];

export type DeadTimeLevel = 'NORMAL' | 'ADVERTENCIA' | 'EXCEDIDO' | 'ESCALAR';

export async function thresholdsMap() {
  const rows = await prisma.deadTimeThreshold.findMany();
  return new Map<OperationType, (typeof rows)[number]>(rows.map((r) => [r.operationType, r]));
}

export function deadTimeLevel(minutes: number, t?: { warnMinutes: number; maxMinutes: number; escalateMinutes: number }): DeadTimeLevel {
  if (!t) return 'NORMAL';
  if (minutes >= t.escalateMinutes) return 'ESCALAR';
  if (minutes >= t.maxMinutes) return 'EXCEDIDO';
  if (minutes >= t.warnMinutes) return 'ADVERTENCIA';
  return 'NORMAL';
}

export async function activeStopsEvaluated(now = new Date()) {
  const [stops, th] = await Promise.all([
    prisma.stop.findMany({
      where: { status: 'ACTIVA' },
      include: { unit: { select: { id: true, economicNumber: true, plates: true } }, trip: { select: { tripNumber: true, client: { select: { name: true } } } }, followUps: { orderBy: { at: 'desc' }, take: 3 }, reminders: { orderBy: { at: 'desc' }, take: 3 } },
      orderBy: { startedAt: 'asc' },
    }),
    thresholdsMap(),
  ]);
  return stops.map((s) => {
    const minutes = Math.round((now.getTime() - s.startedAt.getTime()) / 60000);
    const t = th.get(s.operationType);
    // Las paradas por descanso obligatorio/seguridad se reportan, pero no generan presión para mover la unidad
    const level = PROTECTED_STOP_REASONS.includes(s.reason) ? 'NORMAL' : deadTimeLevel(minutes, t);
    return { ...s, minutes, level, threshold: t ?? null, protected: PROTECTED_STOP_REASONS.includes(s.reason), reminderAllowed: !PROTECTED_STOP_REASONS.includes(s.reason) };
  });
}
