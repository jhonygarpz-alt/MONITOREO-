import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncH, conflict, notFound, unprocessable } from '../../lib/errors';
import { requirePerm } from '../../middleware/auth';
import { parse, uuid } from '../../lib/http';
import { audit } from '../../lib/audit';
import { getSetting } from '../../lib/settings';
import { cycleProgress, ensureCurrentCycle } from './service';
import { fleetStatus } from '../fleet';
import { openCameraFault } from '../cameras/service';

export const sweepsRouter = Router();

sweepsRouter.get('/current', requirePerm('sweeps.view'), asyncH(async (_req, res) => {
  const { cycle } = await ensureCurrentCycle();
  const progress = await cycleProgress(cycle.id);
  const previousPending = await prisma.sweepCycle.findMany({
    where: { id: { not: cycle.id }, status: { in: ['VENCIDO', 'INCOMPLETO'] }, startsAt: { gte: new Date(Date.now() - 24 * 3600_000) } },
    orderBy: { startsAt: 'desc' }, take: 6,
  });
  const prevWithCounts = await Promise.all(previousPending.map(async (c) => ({ ...c, progress: await cycleProgress(c.id) })));
  res.json({ cycle, progress, previousPending: prevWithCounts, now: new Date() });
}));

sweepsRouter.get('/cycles', requirePerm('sweeps.view'), asyncH(async (req, res) => {
  const cycles = await prisma.sweepCycle.findMany({ orderBy: { startsAt: 'desc' }, take: Math.min(Number(req.query.take ?? 24), 200) });
  res.json(await Promise.all(cycles.map(async (c) => ({ ...c, progress: await cycleProgress(c.id) }))));
}));

sweepsRouter.get('/cycles/:id/reviews', requirePerm('sweeps.view'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const status = req.query.status as string | undefined;
  const reviews = await prisma.sweepReview.findMany({
    where: { cycleId: id, ...(status ? { status: status as never } : {}) },
    include: { unit: { select: { id: true, economicNumber: true, plates: true, type: true, opStatus: true } }, reviewedBy: { select: { fullName: true } }, lockedBy: { select: { id: true, fullName: true } } },
    orderBy: { unit: { economicNumber: 'asc' } },
  });
  const fleet = await fleetStatus(new Date(), { ids: reviews.map((r) => r.unitId) });
  const fmap = new Map(fleet.map((f) => [f.id, f]));
  // Prioridad: sin comunicación / cámaras con falla / detenidas primero
  const score = (f?: (typeof fleet)[number]) => (!f ? 0 : (f.freshness === 'SIN_COMUNICACION' || f.freshness === 'NO_DISPONIBLE' ? 3 : 0) + (f.camerasWithFault ? 2 : 0) + (f.activeStop ? 1 : 0));
  const rows = reviews.map((r) => ({ ...r, live: fmap.get(r.unitId) }))
    .sort((a, b) => (a.status === 'PENDIENTE' ? 0 : 1) - (b.status === 'PENDIENTE' ? 0 : 1) || score(b.live) - score(a.live));
  res.json(rows);
}));

/** Paso 1: abrir unidad pendiente (bloqueo temporal para evitar doble revisión simultánea) */
sweepsRouter.post('/reviews/:id/open', requirePerm('sweeps.review'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const lockMin = await getSetting<number>('sweep.lockMinutes');
  const staleLock = new Date(Date.now() - lockMin * 60000);
  // Bloqueo atómico condicional: solo si está libre, vencido o es del mismo usuario
  const updated = await prisma.sweepReview.updateMany({
    where: {
      id, status: { in: ['PENDIENTE', 'EN_REVISION'] },
      OR: [{ lockedById: null }, { lockedById: req.user!.id }, { lockedAt: { lt: staleLock } }],
    },
    data: { lockedById: req.user!.id, lockedAt: new Date(), status: 'EN_REVISION', version: { increment: 1 } },
  });
  const review = await prisma.sweepReview.findUnique({ where: { id }, include: { lockedBy: { select: { fullName: true } }, cycle: true } });
  if (!review) throw notFound('Revisión');
  if (updated.count === 0) {
    if (['VERIFICADA', 'CON_ANOMALIA', 'NO_VERIFICABLE'].includes(review.status)) throw conflict('Esta unidad ya fue revisada en este ciclo');
    throw conflict(`La unidad está siendo revisada por ${review.lockedBy?.fullName ?? 'otro monitorista'}`, { lockedBy: review.lockedBy?.fullName });
  }
  const [live] = await fleetStatus(new Date(), { ids: [review.unitId] });
  res.json({ review, live });
}));

sweepsRouter.post('/reviews/:id/release', requirePerm('sweeps.review'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  await prisma.sweepReview.updateMany({ where: { id, lockedById: req.user!.id, status: 'EN_REVISION' }, data: { lockedById: null, lockedAt: null, status: 'PENDIENTE' } });
  res.json({ ok: true });
}));

const cameraCheck = z.object({
  cameraId: uuid,
  status: z.enum(['FUNCIONANDO', 'SIN_TRANSMISION', 'DESCONECTADA', 'OBSTRUIDA', 'IMAGEN_DEFICIENTE', 'FALLA_TECNICA', 'PENDIENTE_VALIDACION']),
  imageViewed: z.boolean(),
  notes: z.string().max(1000).optional(),
});

const submitSchema = z.object({
  version: z.number().int(),
  gpsStatus: z.enum(['VERIFICADO', 'NO_VERIFICADO', 'CON_ANOMALIA']),
  locationVerified: z.enum(['VERIFICADO', 'NO_VERIFICADO', 'CON_ANOMALIA']),
  movementState: z.enum(['EN_MOVIMIENTO', 'DETENIDA', 'APAGADA', 'DESCONOCIDO']),
  stopReason: z.enum(['DESCANSO_OBLIGATORIO', 'FATIGA', 'EMERGENCIA', 'FALLA_MECANICA', 'CONDICION_INSEGURA', 'CARGA', 'DESCARGA', 'ESPERA_CLIENTE', 'TRAFICO', 'INSPECCION_AUTORIDAD', 'ALIMENTOS', 'COMBUSTIBLE', 'NO_AUTORIZADA', 'DESCONOCIDO']).optional().nullable(),
  cameraChecks: z.array(cameraCheck).default([]),
  observations: z.string().max(3000).optional().nullable(),
  incidentsNoted: z.string().max(3000).optional().nullable(),
});

/** Paso 3: confirmar revisión o registrar anomalía. Nunca se marca como verificado lo que no se comprobó. */
sweepsRouter.post('/reviews/:id/submit', requirePerm('sweeps.review'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const body = parse(submitSchema, req.body);
  const review = await prisma.sweepReview.findUnique({ where: { id }, include: { unit: { include: { cameras: { where: { active: true } } } } } });
  if (!review) throw notFound('Revisión');
  if (review.lockedById !== req.user!.id) throw conflict('Debe abrir la unidad antes de registrar la revisión (o el bloqueo lo tiene otro monitorista)');
  if (review.version !== body.version) throw conflict('La revisión fue modificada por otro usuario. Recargue la unidad.');

  // Validaciones de verdad: cámaras "FUNCIONANDO" solo si se vio la imagen
  for (const c of body.cameraChecks) {
    if (c.status === 'FUNCIONANDO' && !c.imageViewed) throw unprocessable('No se puede marcar una cámara como funcionando sin haber visto la imagen');
    if (!review.unit.cameras.some((x) => x.id === c.cameraId)) throw unprocessable('Cámara no pertenece a la unidad');
  }
  const [live] = await fleetStatus(new Date(), { ids: [review.unitId] });
  if (body.gpsStatus === 'VERIFICADO' && (!live.position || live.freshness === 'NO_DISPONIBLE')) {
    throw unprocessable('No se puede verificar el GPS: no existe posición registrada para la unidad');
  }
  if (body.gpsStatus === 'VERIFICADO' && live.freshness === 'SIN_COMUNICACION') {
    throw unprocessable('La última posición supera el umbral de comunicación; registre la anomalía de GPS en lugar de verificar');
  }
  if (body.movementState === 'DETENIDA' && !body.stopReason) throw unprocessable('Indique el motivo de la detención (o "Desconocido")');

  const cams = review.unit.cameras;
  const checkedIds = new Set(body.cameraChecks.map((c) => c.cameraId));
  const allCamsChecked = cams.every((c) => checkedIds.has(c.id));
  const allCamsOk = body.cameraChecks.length > 0 && body.cameraChecks.every((c) => c.status === 'FUNCIONANDO' && c.imageViewed);
  const camerasStatus = cams.length === 0 ? 'NO_APLICA' : !allCamsChecked ? 'NO_VERIFICADO' : allCamsOk ? 'VERIFICADO' : 'CON_ANOMALIA';

  const anyAnomaly = body.gpsStatus === 'CON_ANOMALIA' || body.locationVerified === 'CON_ANOMALIA' || camerasStatus === 'CON_ANOMALIA' || body.stopReason === 'NO_AUTORIZADA';
  const fullyVerified = body.gpsStatus === 'VERIFICADO' && body.locationVerified === 'VERIFICADO' && (camerasStatus === 'VERIFICADO' || camerasStatus === 'NO_APLICA');
  const status = anyAnomaly ? 'CON_ANOMALIA' : fullyVerified ? 'VERIFICADA' : 'NO_VERIFICABLE';
  if (status === 'NO_VERIFICABLE' && !body.observations?.trim()) throw unprocessable('Explique en observaciones qué no pudo verificarse y por qué');

  const result = await prisma.$transaction(async (tx) => {
    const upd = await tx.sweepReview.updateMany({
      where: { id, version: body.version, lockedById: req.user!.id },
      data: {
        status, version: { increment: 1 }, lockedById: null, lockedAt: null,
        unitOpStatusSnapshot: review.unit.opStatus, operatorName: live.operator?.fullName ?? null,
        lastPositionLat: live.position?.lat ?? null, lastPositionLng: live.position?.lng ?? null,
        lastPositionAt: live.position?.recordedAt ?? null, lastPositionSource: live.position?.source ?? null,
        gpsStatus: body.gpsStatus, locationVerified: body.locationVerified, camerasStatus, movementState: body.movementState,
        stoppedMinutes: live.activeStop?.minutes ?? null, stopReason: body.stopReason ?? null,
        observations: body.observations ?? null, incidentsNoted: body.incidentsNoted ?? null,
        reviewedById: req.user!.id, reviewedAt: new Date(),
      },
    });
    if (upd.count !== 1) throw conflict('La revisión cambió durante el guardado. No se registró. Intente de nuevo.');
    for (const c of body.cameraChecks) {
      await tx.cameraCheck.create({ data: { cameraId: c.cameraId, sweepReviewId: id, status: c.status, imageViewed: c.imageViewed, notes: c.notes, checkedById: req.user!.id } });
      await tx.camera.update({ where: { id: c.cameraId }, data: { status: c.status, statusAt: new Date() } });
      if (c.status !== 'FUNCIONANDO' && c.status !== 'PENDIENTE_VALIDACION') {
        await openCameraFault(tx, c.cameraId, c.status, req.user!.id, `Detectada en barrido. ${c.notes ?? ''}`.trim());
      }
    }
    await audit(tx, { action: 'sweep.review_submitted', entityType: 'SweepReview', entityId: id, after: { status, gps: body.gpsStatus, cameras: camerasStatus, unit: review.unit.economicNumber }, req });
    return tx.sweepReview.findUniqueOrThrow({ where: { id } });
  });
  res.json({ review: result, progress: await cycleProgress(review.cycleId) });
}));

sweepsRouter.post('/generate', requirePerm('sweeps.manage'), asyncH(async (req, res) => {
  const r = await ensureCurrentCycle();
  await audit(prisma, { action: 'sweep.manual_generate', entityType: 'SweepCycle', entityId: r.cycle.id, req });
  res.json(r);
}));

sweepsRouter.get('/units/:unitId/history', requirePerm('sweeps.view'), asyncH(async (req, res) => {
  const unitId = parse(uuid, req.params.unitId);
  res.json(await prisma.sweepReview.findMany({
    where: { unitId, reviewedAt: { not: null } }, orderBy: { reviewedAt: 'desc' }, take: 50,
    include: { reviewedBy: { select: { fullName: true } }, cameraChecks: { include: { camera: { select: { label: true } } } } },
  }));
}));
