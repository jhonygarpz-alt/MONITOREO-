/**
 * Integración con la herramienta "Actualización de Estatus — Optima Dual Solutions".
 *
 * SOLO LECTURA: se lee el documento `flota_estatus` (id=1) del proyecto Supabase de Optima
 * y se actualiza el catálogo de unidades, bases, operadores, asignaciones y viajes del
 * Centro de Monitoreo. Nunca se escribe en Optima.
 *
 * Lo que Optima NO tiene (y por lo tanto NO se inventa): coordenadas GPS, cámaras, pólizas.
 * La "ubicación" de Optima es texto y se muestra como tal, nunca como posición GPS.
 */
import type { Prisma, TripStatus, UnitOpStatus, UnitType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { createAlertOnce } from '../../engine/alerts';
import { env } from '../../config/env';

export const OPTIMA = 'optima';

export interface OptimaRow {
  id: string; unidad?: string; tipoUnidad?: string; placasTractor?: string; sucursal?: string; operador?: string; status?: string;
  enRuta?: boolean; ubicacion?: string; observaciones?: string; cliente?: string; origen?: string; destino?: string;
  contenedor?: string; contenedor2?: string; dolly?: string; mantEtapa?: string; tiempoEntrega?: string;
}

const clean = (v?: string | null) => (v ?? '').toString().trim();
const norm = (v?: string | null) => clean(v).toUpperCase().replace(/\s+/g, ' ');
const slug = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

const TYPE_MAP: Record<string, UnitType> = {
  TRACTOCAMION: 'TRACTOCAMION', TANQUE: 'TANQUE', DOLLY: 'DOLLY', TORTON: 'TORTON', RABON: 'RABON',
  CAMIONETA: 'CAMIONETA', PICKUP: 'PICKUP', AUTOMOVIL: 'AUTOMOVIL', AUTOTANQUE: 'AUTOTANQUE', REMOLQUE: 'REMOLQUE',
};
const MOTOR: UnitType[] = ['TRACTOCAMION', 'AUTOTANQUE', 'TORTON', 'RABON'];

/** Estatus operativo de la unidad. null = no cambia (p.ej. "REVISAR GPS" o "Sin comunicación" no dicen dónde está). */
export function mapOpStatus(status: string, enRuta: boolean): UnitOpStatus | null {
  const s = norm(status);
  if (s === 'EN TRÁNSITO' || s === 'EN TRANSITO' || s === 'EN TRANSITO A CLIENTE') return 'EN_TRANSITO';
  if (s === 'DETENIDO') return 'DETENIDA';
  if (s === 'MANTENIMIENTO') return 'MANTENIMIENTO';
  if (s === 'PENSION' || s === 'PENSIÓN') return 'EN_PENSION';
  if (s === 'NO DISPONIBLE' || s === 'FUERA DE OPERACION' || s === 'FUERA DE OPERACIÓN') return 'FUERA_DE_SERVICIO';
  if (s === 'REVISAR GPS' || s === 'SIN COMUNICACIÓN' || s === 'SIN COMUNICACION' || !s) return null;
  // CARGADO, PENDIENTE CARGA/DESCARGA/SALIDA, DESCARGANDO, TAD CADEREYTA, VACIO, VIAJE FINALIZADO
  return enRuta ? 'EN_TRANSITO' : 'EN_PATIO';
}

export function mapTripStatus(status: string): TripStatus {
  const s = norm(status);
  if (s === 'EN TRÁNSITO' || s === 'EN TRANSITO' || s === 'EN TRANSITO A CLIENTE' || s === 'DETENIDO' || s === 'REVISAR GPS' || s === 'SIN COMUNICACIÓN') return 'EN_TRANSITO';
  if (s === 'CARGADO') return 'CARGADO';
  if (s === 'PENDIENTE CARGA') return 'EN_TRASLADO_A_CARGA';
  if (s === 'TAD CADEREYTA') return 'EN_CARGA';
  if (s === 'PENDIENTE DESCARGA' || s === 'DESCARGANDO') return 'EN_DESCARGA';
  if (s === 'VIAJE FINALIZADO' || s === 'VACIO') return 'FINALIZADO';
  if (s === 'PENDIENTE SALIDA') return 'PROGRAMADO';
  return 'PROGRAMADO';
}

export async function fetchOptimaRows(): Promise<OptimaRow[]> {
  if (!env.OPTIMA_SUPABASE_URL || !env.OPTIMA_SUPABASE_KEY) throw new Error('Integración Optima sin configurar (OPTIMA_SUPABASE_URL / OPTIMA_SUPABASE_KEY)');
  const url = `${env.OPTIMA_SUPABASE_URL.replace(/\/$/, '')}/rest/v1/flota_estatus?id=eq.1&select=data`;
  const res = await fetch(url, { headers: { apikey: env.OPTIMA_SUPABASE_KEY, Authorization: `Bearer ${env.OPTIMA_SUPABASE_KEY}` }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Optima respondió ${res.status}`);
  const body = (await res.json()) as { data?: { rows?: OptimaRow[] } }[];
  const rows = body?.[0]?.data?.rows;
  if (!Array.isArray(rows)) throw new Error('Optima: formato inesperado (no se encontró data.rows)');
  return rows;
}

export interface SyncSummary { total: number; created: number; updated: number; unchanged: number; skipped: number; operators: number; trips: number; couplings: number; alerts: number; conflicts: string[]; errors: string[] }

export async function syncOptima(rows: OptimaRow[], actor?: { id: string; email: string }): Promise<SyncSummary> {
  const sum: SyncSummary = { total: rows.length, created: 0, updated: 0, unchanged: 0, skipped: 0, operators: 0, trips: 0, couplings: 0, alerts: 0, conflicts: [], errors: [] };
  const now = new Date();
  const day = now.toISOString().slice(0, 10);

  // Precarga para evitar cientos de consultas
  const [units, bases, operators, clients] = await Promise.all([
    prisma.unit.findMany({ select: { id: true, economicNumber: true, plates: true, type: true, opStatus: true, externalSource: true, externalId: true, externalStatus: true, externalLocation: true, externalNotes: true, baseId: true } }),
    prisma.base.findMany(), prisma.operator.findMany(), prisma.client.findMany(),
  ]);
  const byExt = new Map(units.filter((u) => u.externalSource === OPTIMA).map((u) => [u.externalId!, u]));
  const byEco = new Map(units.map((u) => [norm(u.economicNumber), u]));
  const plateOwner = new Map(units.map((u) => [norm(u.plates), u.id]));
  const baseByCode = new Map(bases.map((b) => [norm(b.code), b]));
  const opByName = new Map(operators.map((o) => [norm(o.fullName), o]));
  const clientByName = new Map(clients.map((c) => [norm(c.name), c]));

  const ensureBase = async (sucursal: string) => {
    const code = norm(sucursal);
    if (!code) return null;
    let b = baseByCode.get(code);
    if (!b) { b = await prisma.base.create({ data: { code, name: code, city: 'Por definir', state: 'Por definir' } }); baseByCode.set(code, b); }
    return b.id;
  };
  const ensureOperator = async (name: string, baseId: string | null) => {
    const key = norm(name);
    if (!key) return null;
    let o = opByName.get(key);
    if (!o) {
      o = await prisma.operator.create({ data: { employeeNo: `OPT-${slug(name)}`, fullName: clean(name), baseId, dataSource: 'INTEGRATION', authorizedNotes: 'Registrado desde Optima; complete número de empleado y teléfonos.' } });
      opByName.set(key, o); sum.operators++;
    }
    return o.id;
  };
  const ensureClient = async (name: string) => {
    const key = norm(name);
    if (!key) return null;
    let c = clientByName.get(key);
    if (!c) { c = await prisma.client.create({ data: { name: clean(name).toUpperCase() } }); clientByName.set(key, c); }
    return c.id;
  };

  // 1) Unidades
  const synced: { row: OptimaRow; unitId: string; type: UnitType }[] = [];
  for (const r of rows) {
    try {
      const eco = clean(r.unidad);
      const type = TYPE_MAP[norm(r.tipoUnidad)];
      if (!eco || !type || !r.id) { sum.skipped++; continue; }
      const existing = byExt.get(r.id) ?? byEco.get(norm(eco));
      const baseId = await ensureBase(clean(r.sucursal));
      let plates = norm(r.placasTractor);
      if (!plates || (plateOwner.has(plates) && plateOwner.get(plates) !== existing?.id)) plates = `S/P-${slug(eco)}`;
      const ext = { externalSource: OPTIMA, externalId: r.id, externalStatus: clean(r.status) || null, externalLocation: clean(r.ubicacion) || null, externalNotes: clean(r.observaciones) || null, externalSyncedAt: now };
      const desired = mapOpStatus(clean(r.status), !!r.enRuta);
      if (!existing) {
        const u = await prisma.unit.create({ data: { economicNumber: eco, plates, type, baseId, opStatus: desired ?? 'EN_PATIO', dataSource: 'INTEGRATION', ...ext } });
        byEco.set(norm(eco), { ...u }); byExt.set(r.id, { ...u }); plateOwner.set(plates, u.id);
        sum.created++; synced.push({ row: r, unitId: u.id, type });
        continue;
      }
      // El estatus de Optima no sobrescribe una detención o resguardo registrados por el monitorista
      const [activeStop, openHaven] = await Promise.all([
        prisma.stop.findFirst({ where: { unitId: existing.id, status: 'ACTIVA' }, select: { id: true } }),
        prisma.havenArrival.findFirst({ where: { unitId: existing.id, departedAt: null }, select: { id: true } }),
      ]);
      const data: Prisma.UnitUpdateInput = { ...ext, type, base: baseId ? { connect: { id: baseId } } : undefined };
      if (desired && !activeStop && !openHaven && desired !== existing.opStatus) data.opStatus = desired;
      if (norm(existing.plates).startsWith('S/P-') && !plates.startsWith('S/P-')) { data.plates = plates; plateOwner.set(plates, existing.id); }
      const changed = data.opStatus !== undefined || data.plates !== undefined || existing.externalStatus !== ext.externalStatus
        || existing.externalLocation !== ext.externalLocation || existing.externalNotes !== ext.externalNotes || existing.type !== type || existing.baseId !== baseId || existing.externalId !== r.id;
      await prisma.unit.update({ where: { id: existing.id }, data });
      existing.baseId = baseId;
      if (changed) sum.updated++; else sum.unchanged++;
      synced.push({ row: r, unitId: existing.id, type });
    } catch (e) {
      sum.errors.push(`${clean(r.unidad) || r.id}: ${(e as Error).message.split('\n').pop()}`);
    }
  }

  // 2) Operadores, viajes, acoplamientos y avisos (solo unidades motrices)
  // Si Optima asigna el mismo tanque/dolly a dos tractos, se respeta el primero y se reporta el conflicto
  const claimed = new Map<string, string>();
  for (const { row: r, unitId, type } of synced) {
    try {
      if (!MOTOR.includes(type)) continue;
      const unit = byEco.get(norm(r.unidad))!;
      const baseId = unit.baseId ?? null;
      const operatorId = await ensureOperator(clean(r.operador), baseId);
      if (operatorId) {
        const current = await prisma.operatorAssignment.findFirst({ where: { unitId, endAt: null } });
        if (current?.operatorId !== operatorId) {
          await prisma.$transaction([
            prisma.operatorAssignment.updateMany({ where: { OR: [{ unitId }, { operatorId }], endAt: null }, data: { endAt: now } }),
            prisma.operatorAssignment.create({ data: { operatorId, unitId, startAt: now } }),
          ]);
        }
      }
      const trailerCodes = [r.contenedor, r.contenedor2, r.dolly].map(clean).filter(Boolean);
      for (const [i, code] of trailerCodes.entries()) {
        const t = byEco.get(norm(code));
        if (!t || !['TANQUE', 'DOLLY', 'REMOLQUE'].includes(t.type) || t.id === unitId) continue;
        const owner = claimed.get(t.id);
        if (owner && owner !== clean(r.unidad)) { sum.conflicts.push(`${code} aparece en ${owner} y en ${clean(r.unidad)}`); continue; }
        claimed.set(t.id, clean(r.unidad));
        const active = await prisma.unitCoupling.findFirst({ where: { trailerId: t.id, uncoupledAt: null } });
        if (active?.motorId === unitId) continue;
        await prisma.$transaction([
          prisma.unitCoupling.updateMany({ where: { trailerId: t.id, uncoupledAt: null }, data: { uncoupledAt: now } }),
          prisma.unitCoupling.create({ data: { motorId: unitId, trailerId: t.id, position: i + 1 } }),
        ]);
        sum.couplings++;
      }
      const tripNumber = `OPT-${slug(clean(r.unidad))}`;
      const clientName = clean(r.cliente);
      const trip = await prisma.trip.findUnique({ where: { tripNumber } });
      if (clientName) {
        const clientId = (await ensureClient(clientName))!;
        const tdata = { clientId, unitId, operatorId, trailerIds: trailerCodes, origin: clean(r.origen) || 'Por definir', destination: clean(r.destino) || 'Por definir', status: mapTripStatus(clean(r.status)), observations: clean(r.observaciones) || null };
        if (!trip) { await prisma.trip.create({ data: { tripNumber, ...tdata, startedAt: tdata.status === 'EN_TRANSITO' ? now : null } }); sum.trips++; }
        else if (trip.clientId !== clientId || trip.status !== tdata.status || trip.origin !== tdata.origin || trip.destination !== tdata.destination || trip.operatorId !== operatorId) {
          await prisma.trip.update({ where: { id: trip.id }, data: tdata }); sum.trips++;
        }
      } else if (trip && !['FINALIZADO', 'CANCELADO'].includes(trip.status)) {
        await prisma.trip.update({ where: { id: trip.id }, data: { status: 'FINALIZADO', finishedAt: now } }); sum.trips++;
      }
      if (norm(r.status) === 'REVISAR GPS') {
        const a = await createAlertOnce(`optima-revisar-gps:${unitId}:${day}`, { type: 'POSICION_DESACTUALIZADA', severity: 'MEDIA', unitId, source: 'INTEGRATION', title: `${clean(r.unidad)}: Optima indica "REVISAR GPS"`, description: `Ubicación reportada en Optima: ${clean(r.ubicacion) || 'sin dato'}. Verifique en la plataforma GPS.` });
        if (a) sum.alerts++;
      }
    } catch (e) {
      sum.errors.push(`${clean(r.unidad)} (relaciones): ${(e as Error).message.split('\n').pop()}`);
    }
  }

  await prisma.integration.updateMany({ where: { key: OPTIMA }, data: { lastSyncAt: now, lastError: sum.errors.length ? sum.errors.slice(0, 5).join(' | ') : null } });
  if (sum.created || sum.updated || sum.trips || sum.operators || sum.errors.length) {
    await audit(prisma, { action: 'integration.optima_sync', entityType: 'Integration', entityId: OPTIMA, after: sum, actorId: actor?.id ?? null, actorEmail: actor?.email ?? null });
  }
  return sum;
}

/** Ejecuta la sincronización si la integración está habilitada (validada) y configurada. */
export async function runOptimaIfEnabled() {
  const integ = await prisma.integration.findUnique({ where: { key: OPTIMA } });
  if (!integ?.enabled || !integ.validated) return { skipped: 'integración deshabilitada' };
  if (!env.OPTIMA_SUPABASE_URL || !env.OPTIMA_SUPABASE_KEY) return { skipped: 'sin configurar' };
  try {
    return await syncOptima(await fetchOptimaRows());
  } catch (e) {
    await prisma.integration.update({ where: { key: OPTIMA }, data: { lastError: (e as Error).message.slice(0, 500) } });
    throw e;
  }
}
