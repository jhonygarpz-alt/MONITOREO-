import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { cameraAvailability } from '../cameras/service';
import { PROTECTED_STOP_REASONS } from '../operations/service';
import { getSetting } from '../../lib/settings';

export interface KpiFilters { from: Date; to: Date; unitId?: string; monitoristaId?: string; baseId?: string; clientId?: string; incidentType?: string }

const avgMin = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length / 60000) * 10) / 10 : null);
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : null);

/**
 * Indicadores de Gerencia. Cuando no hay datos suficientes, el indicador es null y se
 * agrega una nota en dataQuality: nunca se reporta 100% o 0% por ausencia de información.
 */
export async function computeKpis(f: KpiFilters) {
  const quality: string[] = [];
  const unitWhere: Prisma.UnitWhereInput = { ...(f.unitId ? { id: f.unitId } : {}), ...(f.baseId ? { baseId: f.baseId } : {}) };
  const unitIds = f.unitId || f.baseId ? (await prisma.unit.findMany({ where: unitWhere, select: { id: true } })).map((u) => u.id) : undefined;
  const clientUnitIds = f.clientId ? (await prisma.trip.findMany({ where: { clientId: f.clientId, createdAt: { lte: f.to } }, select: { unitId: true } })).map((t) => t.unitId) : undefined;
  const scopeUnits = unitIds && clientUnitIds ? unitIds.filter((x) => clientUnitIds.includes(x)) : unitIds ?? clientUnitIds;
  const uFilter = scopeUnits ? { unitId: { in: scopeUnits } } : {};

  // Barridos
  const cycles = await prisma.sweepCycle.findMany({ where: { startsAt: { gte: f.from, lt: f.to } }, select: { status: true } });
  const closed = cycles.filter((c) => ['COMPLETADO', 'VENCIDO', 'INCOMPLETO'].includes(c.status));
  if (!closed.length) quality.push('Sin ciclos de barrido cerrados en el periodo');
  const reviews = await prisma.sweepReview.findMany({
    where: { cycle: { startsAt: { gte: f.from, lt: f.to }, status: { not: 'EN_CURSO' } }, ...uFilter, ...(f.monitoristaId ? { reviewedById: f.monitoristaId } : {}) },
    select: { status: true, gpsStatus: true, reviewedById: true },
  });
  const reviewed = reviews.filter((r) => !['PENDIENTE', 'EN_REVISION'].includes(r.status));

  // Cámaras
  const cams = await cameraAvailability(f.from, f.to, f.unitId);
  if (!cams.cameras) quality.push('No hay cámaras registradas para calcular disponibilidad');

  // Alertas
  const alerts = await prisma.alert.findMany({ where: { detectedAt: { gte: f.from, lt: f.to }, ...(scopeUnits ? { unitId: { in: scopeUnits } } : {}), ...(f.incidentType ? { type: f.incidentType as never } : {}) } });
  const escMin = await getSetting<Record<string, number>>('alerts.escalationMinutes');
  const now = new Date();
  const overdue = alerts.filter((a) => ['NUEVA'].includes(a.status) && now.getTime() - a.detectedAt.getTime() > (escMin[a.severity] ?? 60) * 60000);
  const detection = alerts.filter((a) => a.occurredAt).map((a) => a.detectedAt.getTime() - a.occurredAt!.getTime());
  const firstResp = alerts.filter((a) => a.firstResponseAt).map((a) => a.firstResponseAt!.getTime() - a.detectedAt.getTime());
  const escal = alerts.filter((a) => a.escalatedAt).map((a) => a.escalatedAt!.getTime() - a.detectedAt.getTime());
  if (!detection.length) quality.push('Tiempo de detección no disponible: las alertas no registran hora de ocurrencia (requiere integración GPS)');

  // Incidencias
  const incidents = await prisma.incident.findMany({
    where: { openedAt: { gte: f.from, lt: f.to }, ...(scopeUnits ? { unitId: { in: scopeUnits } } : {}), ...(f.incidentType ? { type: f.incidentType as never } : {}), ...(f.monitoristaId ? { responsibleId: f.monitoristaId } : {}) },
    include: { unit: { select: { economicNumber: true } }, operator: { select: { fullName: true } }, escalations: { orderBy: { at: 'asc' }, take: 1 } },
  });
  const group = <T,>(xs: T[], key: (x: T) => string) => Object.entries(xs.reduce<Record<string, number>>((a, x) => { const k = key(x); a[k] = (a[k] ?? 0) + 1; return a; }, {})).map(([k, v]) => ({ key: k, count: v })).sort((a, b) => b.count - a.count);
  const incEsc = incidents.filter((i) => i.escalations[0]).map((i) => i.escalations[0].at.getTime() - i.openedAt.getTime());

  // Tiempos muertos (excluye descansos y paradas de seguridad)
  const stops = await prisma.stop.findMany({ where: { startedAt: { gte: f.from, lt: f.to }, ...uFilter } });
  const deadStops = stops.filter((s) => !PROTECTED_STOP_REASONS.includes(s.reason));
  const minutes = (s: (typeof stops)[number]) => Math.round(((s.endedAt ?? now).getTime() - s.startedAt.getTime()) / 60000);
  const deadByType = Object.entries(deadStops.reduce<Record<string, number>>((a, s) => { a[s.operationType] = (a[s.operationType] ?? 0) + minutes(s); return a; }, {})).map(([k, v]) => ({ key: k, minutes: v }));

  // Resguardo
  const arrivals = await prisma.havenArrival.count({ where: { arrivedAt: { gte: f.from, lt: f.to }, ...uFilter } });
  const curfewBreaches = alerts.filter((a) => a.type === 'INCUMPLIMIENTO_RESGUARDO').length;
  if (!arrivals && !curfewBreaches) quality.push('Sin registros de resguardo en el periodo');

  // Turnos
  const handovers = await prisma.shiftHandover.findMany({ where: { createdAt: { gte: f.from, lt: f.to }, ...(f.monitoristaId ? { outgoingUserId: f.monitoristaId } : {}) } });
  const ackTimeout = await getSetting<number>('handover.ackTimeoutMinutes');
  const onTime = handovers.filter((h) => h.acknowledgedAt && h.acknowledgedAt.getTime() - h.createdAt.getTime() <= ackTimeout * 60000).length;
  if (!handovers.length) quality.push('Sin entregas de turno registradas en el periodo');

  // Capacitación
  const sessions = await prisma.trainingSession.findMany({ where: { scheduledAt: { gte: f.from, lt: f.to } }, include: { attendance: true } });
  const held = sessions.filter((s) => s.status === 'REALIZADA');
  const att = held.flatMap((s) => s.attendance);
  const agreements = await prisma.agreement.findMany({ where: { dueDate: { gte: f.from, lt: f.to } } });

  return {
    period: { from: f.from, to: f.to }, filters: f, generatedAt: now,
    sweeps: { cycles: cycles.length, closedCycles: closed.length, completedCycles: closed.filter((c) => c.status === 'COMPLETADO').length, compliancePct: pct(closed.filter((c) => c.status === 'COMPLETADO').length, closed.length), coveragePct: pct(reviewed.length, reviews.length), reviews: reviews.length, reviewed: reviewed.length, anomalies: reviews.filter((r) => r.status === 'CON_ANOMALIA').length },
    cameras: { availabilityPct: cams.availabilityPct, faults: cams.faults, mttrMinutes: cams.mttrMinutes, worstUnits: cams.byUnit.slice(0, 10) },
    gps: { availabilityPct: pct(reviewed.filter((r) => r.gpsStatus === 'VERIFICADO').length, reviewed.length), basis: 'Porcentaje de revisiones de barrido con GPS verificado' },
    alerts: { total: alerts.length, overdue: overdue.length, detectionAvgMin: avgMin(detection), firstResponseAvgMin: avgMin(firstResp), escalationAvgMin: avgMin(escal), bySeverity: group(alerts, (a) => a.severity), byType: group(alerts, (a) => a.type) },
    incidents: { total: incidents.length, open: incidents.filter((i) => i.status !== 'CERRADA').length, byCategory: group(incidents, (i) => i.type), byUnit: group(incidents, (i) => i.unit?.economicNumber ?? 'Sin unidad'), byOperator: group(incidents, (i) => i.operator?.fullName ?? 'Sin operador'), escalationAvgMin: avgMin(incEsc) },
    pendingCases: await prisma.incident.count({ where: { status: { not: 'CERRADA' } } }),
    deadTime: { stops: deadStops.length, totalMinutes: deadStops.reduce((a, s) => a + minutes(s), 0), byOperationType: deadByType, protectedStopsExcluded: stops.length - deadStops.length },
    curfew: { arrivals, breaches: curfewBreaches, compliancePct: arrivals + curfewBreaches ? pct(arrivals, arrivals + curfewBreaches) : null },
    handover: { total: handovers.length, confirmedOnTime: onTime, compliancePct: pct(onTime, handovers.length), unconfirmed: handovers.filter((h) => !h.acknowledgedAt).length },
    training: { sessions: sessions.length, held: held.length, attendancePct: pct(att.filter((a) => a.present).length, att.length), agreements: agreements.length, agreementsMetPct: pct(agreements.filter((a) => a.status === 'CUMPLIDO').length, agreements.length) },
    monitoristas: group(reviewed, (r) => r.reviewedById ?? 'N/D'),
    dataQuality: quality,
  };
}
