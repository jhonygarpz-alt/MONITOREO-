import { Prisma, type AlertType, type Severity } from '@prisma/client';
import { prisma } from '../lib/prisma';

/** Crea una alerta del motor de reglas una única vez por dedupKey. */
export async function createAlertOnce(dedupKey: string, data: { type: AlertType; severity: Severity; title: string; description?: string; unitId?: string | null; occurredAt?: Date | null; lat?: number; lng?: number; source?: 'MANUAL' | 'DEMO' | 'INTEGRATION' }) {
  try {
    return await prisma.alert.create({ data: { ...data, dedupKey, source: data.source ?? 'MANUAL' } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return null;
    throw e;
  }
}
