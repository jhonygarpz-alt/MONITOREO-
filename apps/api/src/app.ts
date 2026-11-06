import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import path from 'node:path';
import fs from 'node:fs';
import { env } from './config/env';
import { logger } from './lib/logger';
import { errorHandler } from './lib/errors';
import { prisma } from './lib/prisma';
import { authenticate } from './middleware/auth';
import { authRouter } from './modules/auth/routes';
import { dashboardRouter } from './modules/dashboard/routes';
import { sweepsRouter } from './modules/sweeps/routes';
import { camerasRouter } from './modules/cameras/routes';
import { opsRouter } from './modules/operations/routes';
import { routeRouter } from './modules/route/routes';
import { riskRouter } from './modules/risk/routes';
import { alertsRouter } from './modules/alerts/routes';
import { incidentsRouter } from './modules/incidents/routes';
import { immobRouter } from './modules/immob/routes';
import { operatorsRouter } from './modules/operators/routes';
import { unitsRouter } from './modules/units/routes';
import { emergencyRouter } from './modules/emergency/routes';
import { communiquesRouter } from './modules/communiques/routes';
import { statusRouter } from './modules/status/routes';
import { handoverRouter } from './modules/handover/routes';
import { tasksRouter } from './modules/tasks/routes';
import { trainingRouter } from './modules/training/routes';
import { reportsRouter } from './modules/reports/routes';
import { adminRouter } from './modules/admin/routes';
import { catalogsRouter } from './modules/catalogs/routes';
import { notificationsRouter } from './modules/notifications/routes';
import { documentsRouter } from './modules/documents/routes';
import { buildOpenApi } from './openapi';
import crypto from 'node:crypto';
import { tick } from './engine/scheduler';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors({ origin: env.CORS_ORIGIN.split(','), credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  if (env.NODE_ENV !== 'test') app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));

  // Limitador simple de intentos de inicio de sesión por IP
  const hits = new Map<string, { n: number; t: number }>();
  app.use('/api/auth/login', (req, res, next) => {
    const k = req.ip ?? 'x'; const now = Date.now(); const h = hits.get(k);
    if (!h || now - h.t > 60_000) hits.set(k, { n: 1, t: now });
    else if (++h.n > 20) return res.status(429).json({ error: { code: 'RATE_LIMIT', message: 'Demasiados intentos. Espere un minuto.' } });
    next();
  });

  const api = express.Router();
  app.get('/api/health', async (_req, res) => {
    try { await prisma.$queryRaw`SELECT 1`; res.json({ ok: true, db: 'up', time: new Date() }); }
    catch { res.status(503).json({ ok: false, db: 'down' }); }
  });
  app.get('/api/openapi.json', (_req, res) => res.json(buildOpenApi(api)));
  app.use('/api/auth', authRouter);

  // Ejecución del motor de reglas por un programador externo (p.ej. pg_cron de Supabase).
  // Útil en hosting que suspende el servicio por inactividad: la llamada lo despierta y ejecuta los trabajos.
  app.post('/api/internal/tick', async (req, res, next) => {
    try {
      const given = req.get('x-cron-secret') ?? '';
      const expected = env.CRON_SECRET ?? '';
      const ok = expected.length > 0 && given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
      if (!ok) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
      res.json({ ok: true, results: await tick() });
    } catch (e) { next(e); }
  });

  api.use(authenticate);
  api.use('/dashboard', dashboardRouter);
  api.use('/sweeps', sweepsRouter);
  api.use('/cameras', camerasRouter);
  api.use('/ops', opsRouter);
  api.use('/route', routeRouter);
  api.use('/risk', riskRouter);
  api.use('/alerts', alertsRouter);
  api.use('/incidents', incidentsRouter);
  api.use('/immobilization', immobRouter);
  api.use('/operators', operatorsRouter);
  api.use('/units', unitsRouter);
  api.use('/emergency-contacts', emergencyRouter);
  api.use('/communiques', communiquesRouter);
  api.use('/status', statusRouter);
  api.use('/handovers', handoverRouter);
  api.use('/tasks', tasksRouter);
  api.use('/training', trainingRouter);
  api.use('/reports', reportsRouter);
  api.use('/admin', adminRouter);
  api.use('/catalogs', catalogsRouter);
  api.use('/notifications', notificationsRouter);
  api.use('/documents', documentsRouter);
  app.use('/api', api);
  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' } }));

  // Servir el frontend compilado en producción (mismo origen)
  const webDist = path.resolve(__dirname, '../../web/dist');
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
  }
  app.use(errorHandler);
  return app;
}
