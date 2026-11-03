import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncH, notFound, unprocessable } from '../../lib/errors';
import { requirePerm } from '../../middleware/auth';
import { parse, uuid } from '../../lib/http';
import { audit } from '../../lib/audit';
import { notifyRoles } from '../../lib/notify';
import { cameraAvailability, openCameraFault } from './service';
import { fleetStatus } from '../fleet';

export const camerasRouter = Router();
const CAM_STATUS = z.enum(['FUNCIONANDO', 'SIN_TRANSMISION', 'DESCONECTADA', 'OBSTRUIDA', 'IMAGEN_DEFICIENTE', 'FALLA_TECNICA', 'PENDIENTE_VALIDACION']);

camerasRouter.get('/', requirePerm('cameras.view'), asyncH(async (req, res) => {
  const status = req.query.status as string | undefined;
  res.json(await prisma.camera.findMany({
    where: { active: true, ...(status === 'falla' ? { status: { notIn: ['FUNCIONANDO'] } } : status ? { status: status as never } : {}) },
    include: { unit: { select: { id: true, economicNumber: true, plates: true, opStatus: true } }, faults: { where: { status: { not: 'RECUPERADA' } }, take: 1 } },
    orderBy: [{ unit: { economicNumber: 'asc' } }, { label: 'asc' }],
  }));
}));

camerasRouter.get('/faults', requirePerm('cameras.view'), asyncH(async (req, res) => {
  const open = req.query.open !== 'false';
  res.json(await prisma.cameraFault.findMany({
    where: open ? { status: { not: 'RECUPERADA' } } : {},
    include: { camera: { include: { unit: { select: { id: true, economicNumber: true, plates: true } } } }, actions: { orderBy: { at: 'asc' } } },
    orderBy: { openedAt: 'desc' }, take: 300,
  }));
}));

camerasRouter.get('/availability', requirePerm('cameras.view'), asyncH(async (req, res) => {
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(to.getTime() - 7 * 86400_000);
  res.json(await cameraAvailability(from, to, req.query.unitId as string | undefined));
}));

camerasRouter.get('/:id/history', requirePerm('cameras.view'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const [checks, faults] = await Promise.all([
    prisma.cameraCheck.findMany({ where: { cameraId: id }, orderBy: { checkedAt: 'desc' }, take: 100 }),
    prisma.cameraFault.findMany({ where: { cameraId: id }, include: { actions: true }, orderBy: { openedAt: 'desc' } }),
  ]);
  res.json({ checks, faults });
}));

camerasRouter.post('/faults', requirePerm('cameras.manage'), asyncH(async (req, res) => {
  const b = parse(z.object({ cameraId: uuid, status: CAM_STATUS.exclude(['FUNCIONANDO', 'PENDIENTE_VALIDACION']), notes: z.string().max(2000).optional() }), req.body);
  const f = await prisma.$transaction(async (tx) => {
    await tx.camera.update({ where: { id: b.cameraId }, data: { status: b.status, statusAt: new Date() } });
    const fault = await openCameraFault(tx, b.cameraId, b.status, req.user!.id, b.notes);
    await audit(tx, { action: 'camera.fault_opened', entityType: 'CameraFault', entityId: fault.id, after: b, req });
    return fault;
  });
  res.status(201).json(f);
}));

const actionSchema = z.object({
  action: z.enum(['NOTIFICAR_OPERADOR', 'SOLICITAR_REVISION', 'SEGUIMIENTO', 'CONFIRMAR_RECUPERACION', 'ESCALAR_GERENCIA']),
  notes: z.string().trim().min(3).max(2000),
  /// El monitorista confirma que es seguro contactar al operador (no conduciendo en tramo de riesgo, etc.)
  safeToContact: z.boolean().optional(),
  /// Confirmación explícita de que el vehículo está detenido
  vehicleStopped: z.boolean().optional(),
  /// Para recuperar: el monitorista vio la imagen restablecida
  imageViewed: z.boolean().optional(),
});

camerasRouter.post('/faults/:id/actions', requirePerm('cameras.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(actionSchema, req.body);
  const fault = await prisma.cameraFault.findUnique({ where: { id }, include: { camera: true } });
  if (!fault) throw notFound('Falla');
  if (fault.status === 'RECUPERADA') throw unprocessable('La falla ya fue recuperada');
  const data: Record<string, unknown> = {};
  switch (b.action) {
    case 'NOTIFICAR_OPERADOR':
      if (!b.safeToContact) throw unprocessable('Confirme que es seguro contactar al operador en este momento');
      data.status = 'OPERADOR_NOTIFICADO'; data.operatorNotifiedAt = new Date(); break;
    case 'SOLICITAR_REVISION': {
      const [live] = await fleetStatus(new Date(), { ids: [fault.camera.unitId] });
      const moving = (live.position?.speedKph ?? 0) > 0 && live.freshness === 'ACTUALIZADA';
      if (!b.vehicleStopped) throw unprocessable('La revisión física solo puede solicitarse con el vehículo detenido. Confirme que está detenido.');
      if (moving) throw unprocessable(`La última posición indica movimiento (${live.position?.speedKph} km/h). Espere a que la unidad se detenga.`);
      data.status = 'REVISION_SOLICITADA'; data.reviewRequestedAt = new Date(); data.vehicleStoppedConfirmed = true; break;
    }
    case 'SEGUIMIENTO':
      data.status = fault.status === 'ESCALADA' ? 'ESCALADA' : 'EN_SEGUIMIENTO'; break;
    case 'CONFIRMAR_RECUPERACION':
      if (!b.imageViewed) throw unprocessable('Solo puede confirmarse la recuperación tras visualizar la imagen restablecida');
      data.status = 'RECUPERADA'; data.recoveredAt = new Date(); data.recoveryConfirmedById = req.user!.id; break;
    case 'ESCALAR_GERENCIA':
      data.status = 'ESCALADA'; data.escalatedAt = new Date(); break;
  }
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.cameraFault.update({ where: { id }, data });
    await tx.cameraFaultAction.create({ data: { faultId: id, action: b.action, notes: b.notes, actorId: req.user!.id } });
    if (b.action === 'CONFIRMAR_RECUPERACION') {
      await tx.camera.update({ where: { id: fault.cameraId }, data: { status: 'FUNCIONANDO', statusAt: new Date() } });
      await tx.cameraCheck.create({ data: { cameraId: fault.cameraId, status: 'FUNCIONANDO', imageViewed: true, notes: `Recuperación: ${b.notes}`, checkedById: req.user!.id } });
    }
    if (b.action === 'ESCALAR_GERENCIA') {
      await notifyRoles(tx, ['GERENCIA'], { type: 'camera.escalated', title: 'Falla de cámara escalada', body: b.notes, link: '/camaras', severity: 'ALTA', dedupKey: `camfault-esc-${id}` });
    }
    await audit(tx, { action: `camera.fault_${b.action.toLowerCase()}`, entityType: 'CameraFault', entityId: id, before: { status: fault.status }, after: data, req });
    return u;
  });
  res.json(updated);
}));
