import { prisma } from '../../lib/prisma';
import { fleetStatus } from '../fleet';
import { cycleProgress, ensureCurrentCycle } from '../sweeps/service';

/** Fotografía del estado operativo generada en servidor (no editable por el usuario) */
export async function buildHandoverSnapshot(now = new Date()) {
  const fleet = await fleetStatus(now);
  const { cycle } = await ensureCurrentCycle(now);
  const progress = await cycleProgress(cycle.id);
  const pendingReviews = await prisma.sweepReview.findMany({ where: { cycleId: cycle.id, status: { in: ['PENDIENTE', 'EN_REVISION'] } }, include: { unit: { select: { economicNumber: true } } } });
  const overdueCycles = await prisma.sweepCycle.count({ where: { status: 'VENCIDO', startsAt: { gte: new Date(now.getTime() - 24 * 3600_000) } } });
  const [incidents, faults, critical, tasks, instructions] = await Promise.all([
    prisma.incident.findMany({ where: { status: { not: 'CERRADA' } }, select: { id: true, folio: true, title: true, priority: true, status: true, responsible: { select: { fullName: true } }, unit: { select: { economicNumber: true } } } }),
    prisma.cameraFault.findMany({ where: { status: { not: 'RECUPERADA' } }, select: { id: true, faultStatus: true, status: true, openedAt: true, camera: { select: { label: true, unit: { select: { economicNumber: true } } } } } }),
    prisma.alert.findMany({ where: { severity: { in: ['CRITICA', 'ALTA'] }, detectedAt: { gte: new Date(now.getTime() - 12 * 3600_000) } }, select: { id: true, title: true, severity: true, status: true, detectedAt: true, unit: { select: { economicNumber: true } } }, orderBy: { detectedAt: 'desc' }, take: 30 }),
    prisma.task.findMany({ where: { status: { in: ['ABIERTA', 'EN_PROCESO'] } }, select: { id: true, title: true, priority: true, dueAt: true, assignee: { select: { fullName: true } } } }),
    prisma.communique.findMany({ where: { type: { in: ['INSTRUCCION_OPERATIVA', 'HORARIO_CIRCULACION', 'REGLA_SEGURIDAD', 'CAMBIO_PROCEDIMIENTO'] }, status: { in: ['APROBADO', 'PUBLICADO'] }, createdAt: { gte: new Date(now.getTime() - 14 * 86400_000) } }, select: { id: true, folio: true, title: true } }),
  ]);
  const pick = (f: (typeof fleet)[number]) => ({ id: f.id, economicNumber: f.economicNumber, freshness: f.freshness, operator: f.operator?.fullName ?? null });
  return {
    generatedAt: now.toISOString(),
    units: {
      enTransito: fleet.filter((f) => f.opStatus === 'EN_TRANSITO').map(pick),
      detenidas: fleet.filter((f) => f.opStatus === 'DETENIDA' || f.activeStop).map((f) => ({ ...pick(f), minutes: f.activeStop?.minutes ?? null, reason: f.activeStop?.reason ?? null })),
      resguardadas: fleet.filter((f) => f.opStatus === 'RESGUARDADA').map(pick),
      sinComunicacion: fleet.filter((f) => f.freshness === 'SIN_COMUNICACION' || f.freshness === 'NO_DISPONIBLE').map(pick),
    },
    sweeps: { cycleId: cycle.id, startsAt: cycle.startsAt, dueAt: cycle.dueAt, progress, pendingUnits: pendingReviews.map((r) => r.unit.economicNumber), overdueCycles24h: overdueCycles },
    incidents, cameraFaults: faults, criticalEvents: critical, tasks, instructions,
  };
}
