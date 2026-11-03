import type { CameraStatus } from '@prisma/client';
import { prisma, type Db } from '../../lib/prisma';

export async function openCameraFault(db: Db, cameraId: string, faultStatus: CameraStatus, userId: string, notes?: string) {
  const open = await db.cameraFault.findFirst({ where: { cameraId, status: { not: 'RECUPERADA' } } });
  if (open) {
    await db.cameraFaultAction.create({ data: { faultId: open.id, action: 'REINCIDENCIA_DETECTADA', notes: `${faultStatus}. ${notes ?? ''}`.trim(), actorId: userId } });
    return open;
  }
  const f = await db.cameraFault.create({ data: { cameraId, faultStatus, openedById: userId } });
  await db.cameraFaultAction.create({ data: { faultId: f.id, action: 'FALLA_REGISTRADA', notes, actorId: userId } });
  return f;
}

/** Disponibilidad de cámaras (%) en una ventana: 1 - tiempo en falla / tiempo total, y tiempo medio de recuperación. */
export async function cameraAvailability(from: Date, to: Date, unitId?: string) {
  const cameras = await prisma.camera.findMany({ where: { active: true, ...(unitId ? { unitId } : {}) }, select: { id: true, unitId: true, label: true, unit: { select: { economicNumber: true } } } });
  const faults = await prisma.cameraFault.findMany({
    where: { cameraId: { in: cameras.map((c) => c.id) }, openedAt: { lt: to }, OR: [{ recoveredAt: null }, { recoveredAt: { gt: from } }] },
  });
  const windowMs = to.getTime() - from.getTime();
  const perCam = new Map<string, number>();
  for (const f of faults) {
    const s = Math.max(f.openedAt.getTime(), from.getTime());
    const e = Math.min((f.recoveredAt ?? to).getTime(), to.getTime());
    perCam.set(f.cameraId, (perCam.get(f.cameraId) ?? 0) + Math.max(0, e - s));
  }
  const recovered = faults.filter((f) => f.recoveredAt);
  const mttrMin = recovered.length ? Math.round(recovered.reduce((a, f) => a + (f.recoveredAt!.getTime() - f.openedAt.getTime()), 0) / recovered.length / 60000) : null;
  const byUnit = new Map<string, { unitId: string; economicNumber: string; cameras: number; downMs: number }>();
  for (const c of cameras) {
    const u = byUnit.get(c.unitId) ?? { unitId: c.unitId, economicNumber: c.unit.economicNumber, cameras: 0, downMs: 0 };
    u.cameras += 1; u.downMs += perCam.get(c.id) ?? 0; byUnit.set(c.unitId, u);
  }
  const totalDown = [...perCam.values()].reduce((a, b) => a + b, 0);
  const overall = cameras.length ? +(100 * (1 - totalDown / (windowMs * cameras.length))).toFixed(2) : null;
  return {
    from, to, cameras: cameras.length, availabilityPct: overall, faults: faults.length, recovered: recovered.length, mttrMinutes: mttrMin,
    byUnit: [...byUnit.values()].map((u) => ({ unitId: u.unitId, economicNumber: u.economicNumber, cameras: u.cameras, availabilityPct: +(100 * (1 - u.downMs / (windowMs * u.cameras))).toFixed(2) }))
      .sort((a, b) => a.availabilityPct - b.availabilityPct),
  };
}
