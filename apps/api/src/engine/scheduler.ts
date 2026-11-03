import { logger } from '../lib/logger';
import { JOBS } from './jobs';
import { runOnce } from './runner';

/**
 * Un ciclo del motor. La protección contra ejecuciones duplicadas (varias instancias o
 * procesos) la da la clave única runKey de cada trabajo en la tabla job_runs.
 */
export async function tick(now = new Date()) {
  const results: Record<string, string> = {};
  for (const j of JOBS) {
    const r = await runOnce(j.name, j.key(now), () => j.run(now));
    results[j.name] = r.status;
  }
  return results;
}

let timer: NodeJS.Timeout | null = null;
let running = false;
export function startScheduler(seconds: number) {
  const loop = async () => {
    if (running) return;
    running = true;
    try { await tick(); } catch (e) { logger.error({ err: (e as Error).message }, 'Fallo en ciclo del motor de reglas'); } finally { running = false; }
  };
  void loop();
  timer = setInterval(loop, seconds * 1000);
  logger.info({ seconds, jobs: JOBS.length }, 'Motor de reglas iniciado');
}
export const stopScheduler = () => timer && clearInterval(timer);
