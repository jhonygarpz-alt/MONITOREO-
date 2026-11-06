import { prisma, type Db } from '../../lib/prisma';
import { getSetting } from '../../lib/settings';
import { audit } from '../../lib/audit';
import { monitoredUnitWhere } from '../fleet';

/** Inicio del ciclo vigente alineado a la periodicidad (p.ej. 00:00, 02:00, 04:00 UTC-alineado). */
export function cycleStartFor(now: Date, intervalMin: number) {
  const ms = intervalMin * 60000;
  return new Date(Math.floor(now.getTime() / ms) * ms);
}

/** Genera (idempotente) el ciclo de barrido vigente con una revisión por cada unidad activa de la flota. */
export async function ensureCurrentCycle(now = new Date(), db: Db = prisma) {
  const interval = await getSetting<number>('sweep.intervalMinutes');
  const startsAt = cycleStartFor(now, interval);
  const cycleKey = startsAt.toISOString();
  const existing = await db.sweepCycle.findUnique({ where: { cycleKey } });
  if (existing) {
    // Unidades dadas de alta (o sincronizadas) durante el ciclo se agregan al barrido en curso
    if (existing.status === 'EN_CURSO') {
      const missing = await db.unit.findMany({ where: { ...monitoredUnitWhere, opStatus: { not: 'FUERA_DE_SERVICIO' }, sweepReviews: { none: { cycleId: existing.id } } }, select: { id: true } });
      if (missing.length) {
        await db.sweepReview.createMany({ data: missing.map((u) => ({ cycleId: existing.id, unitId: u.id })), skipDuplicates: true });
        const total = await db.sweepReview.count({ where: { cycleId: existing.id } });
        return { cycle: await db.sweepCycle.update({ where: { id: existing.id }, data: { totalUnits: total } }), created: false };
      }
    }
    return { cycle: existing, created: false };
  }
  const units = await db.unit.findMany({ where: { ...monitoredUnitWhere, opStatus: { not: 'FUERA_DE_SERVICIO' } }, select: { id: true } });
  try {
    const cycle = await prisma.$transaction(async (tx) => {
      const c = await tx.sweepCycle.create({
        data: { cycleKey, startsAt, dueAt: new Date(startsAt.getTime() + interval * 60000), status: 'EN_CURSO', totalUnits: units.length },
      });
      await tx.sweepReview.createMany({ data: units.map((u) => ({ cycleId: c.id, unitId: u.id })), skipDuplicates: true });
      await audit(tx, { action: 'sweep.cycle_created', entityType: 'SweepCycle', entityId: c.id, after: { cycleKey, units: units.length } });
      return c;
    });
    return { cycle, created: true };
  } catch (e: unknown) {
    // Otro proceso lo creó en paralelo (cycleKey único): no se duplica
    if ((e as { code?: string }).code === 'P2002') return { cycle: await db.sweepCycle.findUniqueOrThrow({ where: { cycleKey } }), created: false };
    throw e;
  }
}

export async function cycleProgress(cycleId: string) {
  const groups = await prisma.sweepReview.groupBy({ by: ['status'], where: { cycleId }, _count: true });
  const by = Object.fromEntries(groups.map((g) => [g.status, g._count])) as Record<string, number>;
  const total = groups.reduce((a, g) => a + g._count, 0);
  const done = (by.VERIFICADA ?? 0) + (by.CON_ANOMALIA ?? 0) + (by.NO_VERIFICABLE ?? 0);
  return {
    total, done, pending: (by.PENDIENTE ?? 0) + (by.EN_REVISION ?? 0), verified: by.VERIFICADA ?? 0,
    anomalies: by.CON_ANOMALIA ?? 0, unverifiable: by.NO_VERIFICABLE ?? 0, inReview: by.EN_REVISION ?? 0,
    percent: total ? Math.round((done / total) * 100) : 0,
  };
}

/** Cierra ciclos cuyo plazo venció: COMPLETADO si todas revisadas, VENCIDO si quedaron pendientes. */
export async function closeExpiredCycles(now = new Date()) {
  const due = await prisma.sweepCycle.findMany({ where: { status: { in: ['EN_CURSO', 'PROGRAMADO'] }, dueAt: { lte: now } } });
  const results: { id: string; status: string; pending: number }[] = [];
  for (const c of due) {
    const p = await cycleProgress(c.id);
    const status = p.pending === 0 ? 'COMPLETADO' : 'VENCIDO';
    await prisma.sweepCycle.update({ where: { id: c.id }, data: { status, closedAt: now } });
    await audit(prisma, { action: 'sweep.cycle_closed', entityType: 'SweepCycle', entityId: c.id, after: { status, ...p } });
    results.push({ id: c.id, status, pending: p.pending });
  }
  return results;
}

export async function markCompletedCycles() {
  const open = await prisma.sweepCycle.findMany({ where: { status: 'EN_CURSO' } });
  for (const c of open) {
    const p = await cycleProgress(c.id);
    if (p.total > 0 && p.pending === 0) {
      await prisma.sweepCycle.update({ where: { id: c.id }, data: { status: 'COMPLETADO', closedAt: new Date() } });
    }
  }
}
