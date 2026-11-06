import type { DataSource, GpsPosition } from '@prisma/client';
import { prisma, type Db } from '../lib/prisma';
import { getSetting } from '../lib/settings';

export type Freshness = 'ACTUALIZADA' | 'ATRASADA' | 'SIN_COMUNICACION' | 'NO_DISPONIBLE';

export async function freshnessThresholds() {
  const [stale, lost] = await Promise.all([getSetting<number>('gps.staleMinutes'), getSetting<number>('gps.lostMinutes')]);
  return { stale, lost };
}

export function computeFreshness(pos: { recordedAt: Date } | null | undefined, now: Date, t: { stale: number; lost: number }): Freshness {
  if (!pos) return 'NO_DISPONIBLE';
  const age = (now.getTime() - pos.recordedAt.getTime()) / 60000;
  if (age <= t.stale) return 'ACTUALIZADA';
  if (age <= t.lost) return 'ATRASADA';
  return 'SIN_COMUNICACION';
}

export async function latestPositions(db: Db = prisma, unitIds?: string[]) {
  const rows = await db.$queryRawUnsafe<GpsPosition[]>(
    `SELECT DISTINCT ON ("unitId") * FROM "gps_positions" ${unitIds ? `WHERE "unitId" = ANY($1::uuid[])` : ''} ORDER BY "unitId", "recordedAt" DESC`,
    ...(unitIds ? [unitIds] : []),
  );
  return new Map(rows.map((r) => [r.unitId, r]));
}

export interface FleetUnit {
  id: string; economicNumber: string; plates: string; type: string; opStatus: string; base: string | null; dataSource: DataSource;
  external: { source: string; status: string | null; location: string | null; notes: string | null; syncedAt: Date | null } | null;
  operator: { id: string; fullName: string; phonePrimary: string | null } | null;
  position: { lat: number; lng: number; speedKph: number | null; recordedAt: Date; source: DataSource; address: string | null } | null;
  freshness: Freshness; minutesSincePosition: number | null;
  cameras: { id: string; label: string; status: string }[]; camerasWithFault: number;
  activeStop: { id: string; startedAt: Date; reason: string; minutes: number; operationType: string; authorized: boolean } | null;
  activeTrip: { id: string; tripNumber: string; status: string; routeId: string | null; destination: string; beyondMonterrey: boolean } | null;
  trailers: string[];
}

/** Unidades monitoreables: motrices o cualquier unidad con dispositivo GPS (los remolques/tanques se revisan junto con su motriz). */
export const monitoredUnitWhere = { active: true, OR: [{ type: { in: ['TRACTOCAMION', 'AUTOTANQUE', 'TORTON', 'RABON'] as ('TRACTOCAMION' | 'AUTOTANQUE' | 'TORTON' | 'RABON')[] } }, { devices: { some: { active: true } } }] };

export async function fleetStatus(now = new Date(), where: { ids?: string[] } = {}): Promise<FleetUnit[]> {
  const t = await freshnessThresholds();
  const units = await prisma.unit.findMany({
    where: where.ids ? { id: { in: where.ids } } : monitoredUnitWhere,
    include: {
      base: true,
      cameras: { where: { active: true }, orderBy: { label: 'asc' } },
      assignments: { where: { endAt: null }, include: { operator: true } },
      stops: { where: { status: 'ACTIVA' } },
      couplingsAsMotor: { where: { uncoupledAt: null }, include: { trailer: { select: { economicNumber: true, type: true } } } },
      trips: { where: { status: { notIn: ['FINALIZADO', 'CANCELADO', 'PROGRAMADO'] } }, include: { route: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { economicNumber: 'asc' },
  });
  const pos = await latestPositions(prisma, units.map((u) => u.id));
  return units.map((u) => {
    const p = pos.get(u.id);
    const op = u.assignments[0]?.operator;
    const st = u.stops[0];
    const trip = u.trips[0];
    return {
      id: u.id, economicNumber: u.economicNumber, plates: u.plates, type: u.type, opStatus: u.opStatus, base: u.base?.name ?? null, dataSource: u.dataSource,
      external: u.externalSource ? { source: u.externalSource, status: u.externalStatus, location: u.externalLocation, notes: u.externalNotes, syncedAt: u.externalSyncedAt } : null,
      operator: op ? { id: op.id, fullName: op.fullName, phonePrimary: op.phonePrimary } : null,
      position: p ? { lat: p.lat, lng: p.lng, speedKph: p.speedKph, recordedAt: p.recordedAt, source: p.source, address: p.address } : null,
      freshness: computeFreshness(p, now, t),
      minutesSincePosition: p ? Math.round((now.getTime() - new Date(p.recordedAt).getTime()) / 60000) : null,
      cameras: u.cameras.map((c) => ({ id: c.id, label: c.label, status: c.status })),
      camerasWithFault: u.cameras.filter((c) => c.status !== 'FUNCIONANDO').length,
      activeStop: st ? { id: st.id, startedAt: st.startedAt, reason: st.reason, operationType: st.operationType, authorized: st.authorized, minutes: Math.round((now.getTime() - st.startedAt.getTime()) / 60000) } : null,
      trailers: u.couplingsAsMotor.map((c) => c.trailer.economicNumber),
      activeTrip: trip ? { id: trip.id, tripNumber: trip.tripNumber, status: trip.status, routeId: trip.routeId, destination: trip.destination, beyondMonterrey: !!trip.route?.beyondMonterrey || !!u.nightRuleOverride } : null,
    };
  });
}

/** Distancia Haversine en km. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371; const toR = (x: number) => (x * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat); const dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
