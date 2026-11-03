import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { asyncH } from '../../lib/errors';
import { requirePerm } from '../../middleware/auth';
import { fleetStatus } from '../fleet';
import { cycleProgress, ensureCurrentCycle } from '../sweeps/service';
import { activeStopsEvaluated } from '../operations/service';
import { getSetting } from '../../lib/settings';
import { computeKpis } from '../reports/kpis';

export const dashboardRouter = Router();

async function operational() {
  const now = new Date();
  const [fleet, { cycle }, stops, escMin] = await Promise.all([fleetStatus(now), ensureCurrentCycle(now), activeStopsEvaluated(now), getSetting<Record<string, number>>('alerts.escalationMinutes')]);
  const progress = await cycleProgress(cycle.id);
  const [openAlerts, criticalIncidents, overdueCycles, completedCycles24, cameraFaults, tasks, pendingHandover, integrations] = await Promise.all([
    prisma.alert.findMany({ where: { status: { in: ['NUEVA', 'EN_ATENCION', 'ESCALADA'] } }, select: { id: true, severity: true, status: true, detectedAt: true } }),
    prisma.incident.count({ where: { status: { not: 'CERRADA' }, priority: 'CRITICA' } }),
    prisma.sweepCycle.count({ where: { status: 'VENCIDO', startsAt: { gte: new Date(now.getTime() - 24 * 3600_000) } } }),
    prisma.sweepCycle.count({ where: { status: 'COMPLETADO', startsAt: { gte: new Date(now.getTime() - 24 * 3600_000) } } }),
    prisma.cameraFault.count({ where: { status: { not: 'RECUPERADA' } } }),
    prisma.task.count({ where: { status: { in: ['ABIERTA', 'EN_PROCESO'] } } }),
    prisma.shiftHandover.count({ where: { status: { in: ['PENDIENTE_CONFIRMACION', 'ESCALADA_SUPERVISION'] } } }),
    prisma.integration.findMany({ where: { kind: 'GPS' } }),
  ]);
  const pendingEscalation = openAlerts.filter((a) => a.status === 'NUEVA' && now.getTime() - a.detectedAt.getTime() > (escMin[a.severity] ?? 60) * 60000).length;
  const count = (fn: (f: (typeof fleet)[number]) => boolean) => fleet.filter(fn).length;
  const latestPos = fleet.map((f) => f.position?.recordedAt).filter(Boolean).sort().pop() ?? null;
  const gpsLive = integrations.some((i) => i.enabled && i.validated);
  return {
    generatedAt: now,
    dataStatus: {
      gpsIntegration: gpsLive ? 'ACTIVA' : 'NO_INTEGRADA',
      message: gpsLive ? 'Posiciones provenientes de integración GPS' : 'Sin integración GPS activa: las posiciones son capturas manuales o datos de demostración etiquetados',
      latestPositionAt: latestPos,
      freshness: { actualizada: count((f) => f.freshness === 'ACTUALIZADA'), atrasada: count((f) => f.freshness === 'ATRASADA'), sinComunicacion: count((f) => f.freshness === 'SIN_COMUNICACION'), noDisponible: count((f) => f.freshness === 'NO_DISPONIBLE') },
      demoUnits: count((f) => f.dataSource === 'DEMO'),
    },
    kpis: {
      totalUnits: fleet.length,
      enTransito: count((f) => f.opStatus === 'EN_TRANSITO'),
      detenidas: count((f) => f.opStatus === 'DETENIDA' || !!f.activeStop),
      resguardadas: count((f) => f.opStatus === 'RESGUARDADA'),
      mantenimiento: count((f) => f.opStatus === 'MANTENIMIENTO'),
      sinGps: count((f) => f.freshness === 'SIN_COMUNICACION' || f.freshness === 'NO_DISPONIBLE'),
      camarasFalla: cameraFaults,
      alertasActivas: openAlerts.length,
      alertasCriticas: openAlerts.filter((a) => a.severity === 'CRITICA').length,
      incidenciasCriticas: criticalIncidents,
      barridosPendientes: progress.pending,
      barridosCompletados: progress.done,
      ciclosCompletados24h: completedCycles24,
      barridosVencidos: overdueCycles,
      tiemposMuertos: stops.filter((s) => s.level === 'EXCEDIDO' || s.level === 'ESCALAR').length,
      pendientesEscalamiento: pendingEscalation,
      pendientesTurno: tasks,
      entregasPendientes: pendingHandover,
    },
    sweep: { cycle, progress },
    attention: fleet.filter((f) => f.freshness !== 'ACTUALIZADA' || f.camerasWithFault > 0 || f.activeStop).map((f) => ({
      id: f.id, economicNumber: f.economicNumber, freshness: f.freshness, minutesSincePosition: f.minutesSincePosition, camerasWithFault: f.camerasWithFault,
      activeStop: f.activeStop, operator: f.operator?.fullName ?? null, opStatus: f.opStatus, dataSource: f.dataSource,
    })).slice(0, 50),
  };
}

dashboardRouter.get('/operational', requirePerm('dashboard.view'), asyncH(async (_req, res) => res.json(await operational())));

/** Pantalla del monitorista: 4 bloques prioritarios */
dashboardRouter.get('/monitor-home', requirePerm('dashboard.view'), asyncH(async (req, res) => {
  const op = await operational();
  const [alerts, myTasks, handoverForMe, myIncidents] = await Promise.all([
    prisma.alert.findMany({ where: { status: { in: ['NUEVA', 'EN_ATENCION', 'ESCALADA'] } }, include: { unit: { select: { economicNumber: true } } }, orderBy: { detectedAt: 'desc' }, take: 40 }),
    prisma.task.findMany({ where: { status: { in: ['ABIERTA', 'EN_PROCESO'] }, OR: [{ assigneeId: req.user!.id }, { assigneeId: null }] }, orderBy: [{ dueAt: 'asc' }], take: 20 }),
    prisma.shiftHandover.findFirst({ where: { status: { in: ['PENDIENTE_CONFIRMACION', 'ESCALADA_SUPERVISION'] }, outgoingUserId: { not: req.user!.id }, OR: [{ incomingUserId: req.user!.id }, { incomingUserId: null }] }, include: { outgoingUser: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.incident.findMany({ where: { status: { not: 'CERRADA' }, responsibleId: req.user!.id }, select: { id: true, folio: true, title: true, priority: true, status: true } }),
  ]);
  const rank = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAJA: 3 } as const;
  alerts.sort((a, b) => rank[a.severity] - rank[b.severity] || +b.detectedAt - +a.detectedAt);
  const tz = await getSetting<string>('system.timezone');
  res.json({
    timezone: tz, dataStatus: op.dataStatus,
    sweep: { ...op.sweep, overdueCycles: op.kpis.barridosVencidos },
    alerts: { items: alerts.slice(0, 8), nuevas: alerts.filter((a) => a.status === 'NUEVA').length, criticas: alerts.filter((a) => a.severity === 'CRITICA').length, total: alerts.length },
    attention: op.attention.slice(0, 8), attentionTotal: op.attention.length,
    pending: { tasks: myTasks, handover: handoverForMe, myIncidents },
    kpis: op.kpis,
  });
}));

dashboardRouter.get('/executive', requirePerm('dashboard.executive'), asyncH(async (_req, res) => {
  const to = new Date();
  const [op, week, pendingApprovals] = await Promise.all([
    operational(),
    computeKpis({ from: new Date(to.getTime() - 7 * 86400_000), to }),
    Promise.all([
      prisma.immobilizationRequest.count({ where: { status: { in: ['SOLICITADA', 'PRIMERA_AUTORIZACION'] } } }),
      prisma.incident.count({ where: { status: 'PENDIENTE_CIERRE' } }),
      prisma.configChangeRequest.count({ where: { status: 'PENDIENTE' } }),
      prisma.communique.count({ where: { status: 'PENDIENTE_APROBACION' } }),
      prisma.curfewException.count({ where: { status: 'PENDIENTE' } }),
    ]),
  ]);
  const [immob, closures, configs, communiques, exceptions] = pendingApprovals;
  res.json({ operational: op, week, approvals: { immob, closures, configs, communiques, exceptions, total: immob + closures + configs + communiques + exceptions } });
}));

dashboardRouter.get('/badges', asyncH(async (req, res) => {
  const [alerts, critical, incidents, handover, approvals, notif] = await Promise.all([
    prisma.alert.count({ where: { status: 'NUEVA' } }),
    prisma.alert.count({ where: { status: { in: ['NUEVA', 'EN_ATENCION', 'ESCALADA'] }, severity: 'CRITICA' } }),
    prisma.incident.count({ where: { status: { not: 'CERRADA' } } }),
    prisma.shiftHandover.count({ where: { status: { in: ['PENDIENTE_CONFIRMACION', 'ESCALADA_SUPERVISION'] }, outgoingUserId: { not: req.user!.id } } }),
    prisma.immobilizationRequest.count({ where: { status: { in: ['SOLICITADA', 'PRIMERA_AUTORIZACION'] } } }),
    prisma.notification.count({ where: { userId: req.user!.id, readAt: null } }),
  ]);
  res.json({ alerts, critical, incidents, handover, approvals, notifications: notif });
}));
