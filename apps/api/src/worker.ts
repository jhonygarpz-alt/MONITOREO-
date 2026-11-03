/** Proceso dedicado del motor de reglas (recomendado en producción: RUN_SCHEDULER=false en la API). */
import { env } from './config/env';
import { startScheduler } from './engine/scheduler';
startScheduler(env.SCHEDULER_TICK_SECONDS);
