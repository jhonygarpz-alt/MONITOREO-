import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { forbidden, unauthorized } from '../lib/errors';
import type { PermissionKey } from '../rbac/catalog';

export interface AuthUser {
  id: string; email: string; fullName: string; roles: string[]; permissions: Set<string>;
}
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { user?: AuthUser } }
}

export const COOKIE = 'cim_session';

export function signToken(userId: string, tokenVersion: number) {
  return jwt.sign({ sub: userId, v: tokenVersion }, env.JWT_SECRET, { expiresIn: `${env.JWT_EXPIRES_HOURS}h`, issuer: 'cim' });
}

const cache = new Map<string, { u: AuthUser; v: number; t: number }>();
export const clearAuthCache = (userId?: string) => (userId ? cache.delete(userId) : cache.clear());

export async function loadUser(userId: string, v: number): Promise<AuthUser | null> {
  const c = cache.get(userId);
  if (c && c.v === v && Date.now() - c.t < 15000) return c.u;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
  });
  if (!user || !user.active || user.tokenVersion !== v) return null;
  const perms = new Set<string>();
  user.roles.forEach((ur) => ur.role.permissions.forEach((rp) => perms.add(rp.permission.key)));
  const u: AuthUser = { id: user.id, email: user.email, fullName: user.fullName, roles: user.roles.map((r) => r.role.key), permissions: perms };
  cache.set(userId, { u, v, t: Date.now() });
  return u;
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const bearer = req.get('authorization')?.replace(/^Bearer\s+/i, '');
    const token = req.cookies?.[COOKIE] ?? bearer;
    if (!token) throw unauthorized();
    // CSRF: si se autentica por cookie, exigir encabezado personalizado en métodos mutables
    if (req.cookies?.[COOKIE] && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('x-cim-client') !== 'web') {
      throw forbidden('Solicitud rechazada (protección CSRF)');
    }
    let payload: { sub: string; v: number };
    try {
      payload = jwt.verify(token, env.JWT_SECRET, { issuer: 'cim' }) as { sub: string; v: number };
    } catch {
      throw unauthorized('La sesión expiró. Inicie sesión nuevamente.');
    }
    const user = await loadUser(payload.sub, payload.v);
    if (!user) throw unauthorized();
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}

export const can = (req: Request, p: PermissionKey) => !!req.user?.permissions.has(p);

export function requirePerm(...perms: PermissionKey[]) {
  const mw = (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!perms.some((p) => req.user!.permissions.has(p))) return next(forbidden(`Requiere permiso: ${perms.join(' o ')}`));
    next();
  };
  // metadatos para la documentación OpenAPI generada
  (mw as unknown as { perms: string[] }).perms = perms;
  return mw;
}
