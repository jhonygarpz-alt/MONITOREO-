import crypto from 'node:crypto';
import type { Request } from 'express';
import { prisma, type Db } from './prisma';

export interface AuditInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  actorId?: string | null;
  actorEmail?: string | null;
  req?: Request;
}

const AUDIT_LOCK = 774411;
const INCIDENT_LOCK = 774412;

export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/** JSON canónico (claves ordenadas): PostgreSQL JSONB no conserva el orden de claves. */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
}

function clean(v: unknown) {
  if (v === undefined) return undefined;
  return JSON.parse(JSON.stringify(v, (k, val) => (k === 'passwordHash' ? '[REDACTED]' : typeof val === 'bigint' ? val.toString() : val)));
}

/** Inserta un registro de auditoría con hash encadenado (evidencia de no alteración). */
export async function audit(db: Db, input: AuditInput) {
  const run = async (tx: Db) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${AUDIT_LOCK})`);
    const last = await tx.auditLog.findFirst({ orderBy: { seq: 'desc' }, select: { hash: true } });
    const at = new Date();
    const actorId = input.actorId ?? input.req?.user?.id ?? null;
    const actorEmail = input.actorEmail ?? input.req?.user?.email ?? null;
    const payload = {
      at: at.toISOString(), actorId, action: input.action, entityType: input.entityType,
      entityId: input.entityId ?? null, before: clean(input.before) ?? null, after: clean(input.after) ?? null,
    };
    const prevHash = last?.hash ?? null;
    const hash = sha256((prevHash ?? 'GENESIS') + canonical(payload));
    return tx.auditLog.create({
      data: {
        at, actorId, actorEmail, action: input.action, entityType: input.entityType, entityId: input.entityId ?? null,
        before: payload.before ?? undefined, after: payload.after ?? undefined,
        ip: input.req?.ip ?? null, userAgent: input.req?.get('user-agent')?.slice(0, 250) ?? null, prevHash, hash,
      },
    });
  };
  if ('$transaction' in db) return (db as typeof prisma).$transaction((tx) => run(tx));
  return run(db);
}

/** Verifica la cadena de hashes de auditoría. */
export async function verifyAuditChain(limit = 5000) {
  const rows = await prisma.auditLog.findMany({ orderBy: { seq: 'asc' }, take: limit });
  let prev: string | null = null;
  for (const r of rows) {
    const payload = {
      at: r.at.toISOString(), actorId: r.actorId, action: r.action, entityType: r.entityType,
      entityId: r.entityId, before: r.before ?? null, after: r.after ?? null,
    };
    const expected = sha256((prev ?? 'GENESIS') + canonical(payload));
    if (r.prevHash !== prev || r.hash !== expected) return { ok: false, brokenAtSeq: r.seq.toString(), checked: rows.length };
    prev = r.hash;
  }
  return { ok: true, checked: rows.length };
}

/** Agrega un evento al historial inalterable de la incidencia. */
export async function incidentEvent(
  tx: Db, incidentId: string, kind: string, message: string,
  actor?: { id: string; fullName: string } | null, data?: unknown,
) {
  await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${INCIDENT_LOCK})`);
  const last = await tx.incidentEvent.findFirst({ where: { incidentId }, orderBy: { seq: 'desc' }, select: { hash: true } });
  const at = new Date();
  const prevHash = last?.hash ?? null;
  const hash = sha256((prevHash ?? incidentId) + canonical({ kind, message, data: clean(data) ?? null, actor: actor?.id ?? null, at: at.toISOString() }));
  return tx.incidentEvent.create({
    data: { incidentId, kind, message, data: clean(data) ?? undefined, actorId: actor?.id ?? null, actorName: actor?.fullName ?? 'Sistema', at, prevHash, hash },
  });
}
