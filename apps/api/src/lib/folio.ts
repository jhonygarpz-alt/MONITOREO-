import type { Db } from './prisma';

/** Folio legible y único: PREFIJO-AAAAMMDD-#### (secuencia por día y prefijo, con bloqueo). */
export async function nextFolio(db: Db, prefix: string, table: 'incidents' | 'immobilization_requests' | 'communiques' | 'status_reports') {
  const d = new Date();
  const day = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  const like = `${prefix}-${day}-%`;
  await db.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, like);
  const rows = await db.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint AS c FROM "${table}" WHERE folio LIKE $1`, like);
  const n = Number(rows[0]?.c ?? 0) + 1;
  return `${prefix}-${day}-${String(n).padStart(4, '0')}`;
}
