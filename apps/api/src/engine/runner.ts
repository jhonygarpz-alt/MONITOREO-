import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

const MAX_ATTEMPTS = 3;

/**
 * Ejecuta un trabajo una sola vez por runKey (protección contra duplicados entre procesos
 * e instancias). Si falla, se reintenta hasta MAX_ATTEMPTS con espera exponencial.
 */
export async function runOnce<T>(job: string, runKey: string, fn: () => Promise<T>): Promise<{ status: 'skipped' | 'ok' | 'failed'; result?: T; error?: string }> {
  let run = await prisma.jobRun.findUnique({ where: { runKey } });
  if (run) {
    if (run.status === 'EXITOSO') return { status: 'skipped' };
    if (run.status === 'EJECUTANDO' && Date.now() - run.startedAt.getTime() < 10 * 60000) return { status: 'skipped' };
    if (run.attempts >= MAX_ATTEMPTS) return { status: 'skipped' };
    const wait = 2 ** run.attempts * 30_000;
    if (run.finishedAt && Date.now() - run.finishedAt.getTime() < wait) return { status: 'skipped' };
    const claimed = await prisma.jobRun.updateMany({ where: { id: run.id, attempts: run.attempts }, data: { status: 'EJECUTANDO', attempts: { increment: 1 }, startedAt: new Date(), error: null } });
    if (!claimed.count) return { status: 'skipped' };
  } else {
    try {
      run = await prisma.jobRun.create({ data: { job, runKey } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return { status: 'skipped' };
      throw e;
    }
  }
  try {
    const result = await fn();
    await prisma.jobRun.update({ where: { runKey }, data: { status: 'EXITOSO', finishedAt: new Date(), result: JSON.parse(JSON.stringify(result ?? null)) ?? Prisma.JsonNull } });
    return { status: 'ok', result };
  } catch (e) {
    const msg = (e as Error).message?.slice(0, 2000) ?? String(e);
    logger.error({ job, runKey, err: msg }, 'Fallo en trabajo programado');
    await prisma.jobRun.update({ where: { runKey }, data: { status: 'FALLIDO', finishedAt: new Date(), error: msg } });
    return { status: 'failed', error: msg };
  }
}
