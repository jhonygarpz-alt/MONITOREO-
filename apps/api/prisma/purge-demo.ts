/** Elimina o desactiva los datos de DEMOSTRACIÓN antes de operar con información real. */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const units = await prisma.unit.findMany({ where: { dataSource: 'DEMO' }, select: { id: true } });
  const ids = units.map((u) => u.id);
  await prisma.gpsPosition.deleteMany({ where: { OR: [{ source: 'DEMO' }, { unitId: { in: ids } }] } });
  await prisma.stopFollowUp.deleteMany({ where: { stop: { unitId: { in: ids } } } });
  await prisma.operatorReminder.deleteMany({ where: { stop: { unitId: { in: ids } } } });
  await prisma.stop.deleteMany({ where: { unitId: { in: ids } } });
  await prisma.alert.deleteMany({ where: { unitId: { in: ids }, incidentId: null } });
  await prisma.cameraCheck.deleteMany({ where: { camera: { unitId: { in: ids } } } });
  await prisma.cameraFaultAction.deleteMany({ where: { fault: { camera: { unitId: { in: ids } } } } });
  await prisma.cameraFault.deleteMany({ where: { camera: { unitId: { in: ids } } } });
  await prisma.sweepReview.deleteMany({ where: { unitId: { in: ids } } });
  // Las unidades con incidencias (historial inalterable) se desactivan en lugar de borrarse
  const withHistory = await prisma.incident.findMany({ where: { unitId: { in: ids } }, select: { unitId: true } });
  const keep = new Set(withHistory.map((i) => i.unitId!));
  await prisma.unit.updateMany({ where: { id: { in: [...keep] } }, data: { active: false } });
  console.log(`Datos de demostración depurados. Unidades conservadas inactivas por historial: ${keep.size}. Elimine manualmente catálogos [DEMO] desde Administración.`);
}
main().finally(() => prisma.$disconnect());
