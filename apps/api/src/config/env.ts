import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_EXPIRES_HOURS: z.coerce.number().default(12),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  STORAGE_DIR: z.string().default('./storage'),
  MAX_UPLOAD_MB: z.coerce.number().default(15),
  RUN_SCHEDULER: z.enum(['true', 'false']).default('true'),
  SCHEDULER_TICK_SECONDS: z.coerce.number().default(60),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  LOG_LEVEL: z.string().default('info'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Variables de entorno inválidas:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
