import { env } from './config/env';
import { createApp } from './app';
import { logger } from './lib/logger';
import { startScheduler } from './engine/scheduler';

const app = createApp();
app.listen(env.PORT, () => {
  logger.info(`CENTRO INTELIGENTE DE MONITOREO — API en puerto ${env.PORT}`);
  if (env.RUN_SCHEDULER === 'true') startScheduler(env.SCHEDULER_TICK_SECONDS);
});
