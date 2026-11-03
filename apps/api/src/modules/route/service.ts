import { prisma } from '../../lib/prisma';
import { getSetting } from '../../lib/settings';
import { inLocalWindow, localParts, minutesUntilLocal } from '../../lib/time';
import { fleetStatus, haversineKm, type FleetUnit } from '../fleet';

export type CurfewState = 'EN_RESGUARDO' | 'EN_TIEMPO' | 'ADVERTENCIA' | 'RESTRICCION_ACTIVA' | 'INCUMPLIMIENTO' | 'EXCEPCION_AUTORIZADA' | 'SIN_EVIDENCIA';

/** Regla aplicable con prioridad: ruta específica > corredor > política general "más allá de Monterrey". */
export async function applicableRules() {
  return prisma.circulationRule.findMany({ where: { active: true } });
}

export async function curfewStatus(now = new Date()) {
  const tz = await getSetting<string>('system.timezone');
  const [rules, fleet, havens, openArrivals, exceptions, trips] = await Promise.all([
    applicableRules(),
    fleetStatus(now),
    prisma.safeHaven.findMany({ where: { active: true, validation: 'VALIDADO' } }),
    prisma.havenArrival.findMany({ where: { departedAt: null }, include: { haven: true } }),
    prisma.curfewException.findMany({ where: { status: 'APROBADA', validFrom: { lte: now }, validUntil: { gte: now } } }),
    prisma.trip.findMany({ where: { status: { in: ['EN_TRANSITO', 'EN_RESGUARDO', 'CARGADO', 'EN_TRASLADO_A_CARGA'] } }, include: { route: true } }),
  ]);
  const tripByUnit = new Map(trips.map((t) => [t.unitId, t]));
  const arrivalByUnit = new Map(openArrivals.map((a) => [a.unitId, a]));
  const excByUnit = new Map(exceptions.map((e) => [e.unitId, e]));

  const out: Array<{
    unit: Pick<FleetUnit, 'id' | 'economicNumber' | 'plates' | 'freshness' | 'position' | 'operator'>;
    trip: { id: string; tripNumber: string; destination: string; route: string | null } | null;
    rule: { id: string; name: string; curfewStart: string; curfewEnd: string; warnMinutesBefore: number } | null;
    state: CurfewState; minutesToCurfew: number | null; inHaven: { name: string; arrivedAt: Date } | null;
    nextHaven: { id: string; name: string; distanceKm: number | null } | null; exception: { id: string; validUntil: Date } | null; reason: string;
  }> = [];

  for (const u of fleet) {
    const trip = tripByUnit.get(u.id);
    const route = trip?.route ?? null;
    const subject = !!route?.beyondMonterrey || !!u.activeTrip?.beyondMonterrey;
    const rule =
      rules.find((r) => route && r.routeId === route.id) ??
      rules.find((r) => route?.corridorId && r.corridorId === route.corridorId && !r.routeId) ??
      (subject ? rules.find((r) => r.appliesBeyondMonterrey && !r.routeId && !r.corridorId) : undefined);
    if (!rule) continue;

    const arrival = arrivalByUnit.get(u.id);
    const exc = excByUnit.get(u.id);
    const inWindow = inLocalWindow(now, rule.curfewStart, rule.curfewEnd, tz);
    let minutesToCurfew: number | null = minutesUntilLocal(now, rule.curfewStart, tz);
    if (minutesToCurfew < -12 * 60) minutesToCurfew += 24 * 60;
    if (inWindow) minutesToCurfew = 0;

    const corridorHavens = havens.filter((h) => !route?.corridorId || !h.corridorId || h.corridorId === route.corridorId);
    let nextHaven: { id: string; name: string; distanceKm: number | null } | null = null;
    if (u.position && corridorHavens.length) {
      const sorted = corridorHavens.map((h) => ({ h, d: haversineKm(u.position!, h) })).sort((a, b) => a.d - b.d);
      nextHaven = { id: sorted[0].h.id, name: sorted[0].h.name, distanceKm: Math.round(sorted[0].d) };
    } else if (corridorHavens.length) {
      nextHaven = { id: corridorHavens[0].id, name: corridorHavens[0].name, distanceKm: null };
    }

    let state: CurfewState; let reason: string;
    if (arrival) { state = 'EN_RESGUARDO'; reason = `Llegada registrada a ${arrival.haven.name}`; }
    else if (exc) { state = 'EXCEPCION_AUTORIZADA'; reason = 'Circulación con excepción documentada y autorizada'; }
    else if (inWindow) {
      const moving = u.freshness === 'ACTUALIZADA' && (u.position?.speedKph ?? 0) > 5;
      if (u.freshness !== 'ACTUALIZADA') { state = 'SIN_EVIDENCIA'; reason = 'Dentro de horario restringido sin posición actualizada: no puede confirmarse que esté resguardada'; }
      else { state = moving ? 'INCUMPLIMIENTO' : 'RESTRICCION_ACTIVA'; reason = moving ? 'Circulando en horario restringido sin excepción autorizada' : 'Horario restringido: sin llegada a resguardo registrada'; }
    } else if (minutesToCurfew !== null && minutesToCurfew <= rule.warnMinutesBefore) {
      state = 'ADVERTENCIA'; reason = `Faltan ${minutesToCurfew} min para el horario límite ${rule.curfewStart}`;
    } else { state = 'EN_TIEMPO'; reason = `Horario límite ${rule.curfewStart}`; }

    out.push({
      unit: { id: u.id, economicNumber: u.economicNumber, plates: u.plates, freshness: u.freshness, position: u.position, operator: u.operator },
      trip: trip ? { id: trip.id, tripNumber: trip.tripNumber, destination: trip.destination, route: route?.name ?? null } : null,
      rule: { id: rule.id, name: rule.name, curfewStart: rule.curfewStart, curfewEnd: rule.curfewEnd, warnMinutesBefore: rule.warnMinutesBefore },
      state, minutesToCurfew, inHaven: arrival ? { name: arrival.haven.name, arrivedAt: arrival.arrivedAt } : null, nextHaven,
      exception: exc ? { id: exc.id, validUntil: exc.validUntil } : null, reason,
    });
  }
  const order: CurfewState[] = ['INCUMPLIMIENTO', 'SIN_EVIDENCIA', 'RESTRICCION_ACTIVA', 'ADVERTENCIA', 'EXCEPCION_AUTORIZADA', 'EN_TIEMPO', 'EN_RESGUARDO'];
  out.sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state));
  return { timezone: tz, localNow: localParts(now, tz), items: out };
}
