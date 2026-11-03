import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

export const app = createApp();
export const PASS = 'Test-Pass-123';

const tokens = new Map<string, string>();
export async function login(email: string) {
  if (tokens.has(email)) return tokens.get(email)!;
  const r = await request(app).post('/api/auth/login').send({ email, password: PASS });
  if (r.status !== 200) throw new Error(`login ${email}: ${r.status} ${JSON.stringify(r.body)}`);
  tokens.set(email, r.body.token);
  return r.body.token as string;
}

export function as(email: string) {
  const call = (method: 'get' | 'post' | 'put' | 'delete', url: string, body?: unknown) =>
    login(email).then((t) => { const r = request(app)[method](url).set('Authorization', `Bearer ${t}`); return body !== undefined ? r.send(body as object) : r; });
  return { get: (u: string) => call('get', u), post: (u: string, b?: unknown) => call('post', u, b ?? {}), put: (u: string, b?: unknown) => call('put', u, b ?? {}) };
}

export const M1 = 'monitorista1@cim.local';
export const M2 = 'monitorista2@cim.local';
export const G1 = 'gerencia@cim.local';
export const G2 = 'gerencia2@cim.local';
export const OE = 'oe@cim.local';
export const EX = 'ejecutor@cim.local';
export const SUP = 'supervisor@cim.local';
export const AUD = 'auditor@cim.local';

let seq = 0;
/** Crea una unidad motriz de prueba con cámara, GPS y posición opcional. */
export async function makeUnit(opts: { speed?: number; ageMin?: number; noPosition?: boolean; immobilizer?: boolean; cameras?: number; opStatus?: 'EN_TRANSITO' | 'DETENIDA' } = {}) {
  seq++;
  const n = `${Date.now().toString(36)}${seq}`;
  const unit = await prisma.unit.create({ data: { economicNumber: `TEST-${n}`, plates: `TS${n}`.slice(0, 14), type: 'TRACTOCAMION', opStatus: opts.opStatus ?? 'EN_TRANSITO', dataSource: 'MANUAL' } });
  await prisma.gpsDevice.create({ data: { unitId: unit.id, provider: 'Test', identifier: `IMEI-${n}`, supportsImmobilizer: opts.immobilizer ?? true } });
  const cams = [];
  for (let i = 0; i < (opts.cameras ?? 1); i++) cams.push(await prisma.camera.create({ data: { unitId: unit.id, label: `Cam${i}`, status: 'FUNCIONANDO' } }));
  if (!opts.noPosition) await prisma.gpsPosition.create({ data: { unitId: unit.id, lat: 26, lng: -100, speedKph: opts.speed ?? 0, recordedAt: new Date(Date.now() - (opts.ageMin ?? 1) * 60000), source: 'MANUAL' } });
  return { unit, cams };
}
export { prisma };
