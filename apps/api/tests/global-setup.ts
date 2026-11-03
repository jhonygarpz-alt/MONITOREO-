import { execSync } from 'node:child_process';

export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://cim:cim_dev_pass@localhost:5432/cim_test';
  const env = { ...process.env, DATABASE_URL: url, SEED_PASSWORD: 'Test-Pass-123', NODE_ENV: 'test' };
  execSync('npx prisma migrate reset --force --skip-seed --skip-generate', { env, stdio: 'ignore' });
  execSync('npx tsx prisma/seed.ts', { env, stdio: 'ignore' });
}
