import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncH, badRequest, unauthorized } from '../../lib/errors';
import { audit } from '../../lib/audit';
import { parse } from '../../lib/http';
import { env } from '../../config/env';
import { authenticate, clearAuthCache, COOKIE, signToken } from '../../middleware/auth';

export const authRouter = Router();
const MAX_FAILED = 5;
const LOCK_MIN = 15;

export const passwordPolicy = z.string().min(10, 'Mínimo 10 caracteres')
  .regex(/[A-Z]/, 'Debe incluir una mayúscula').regex(/[a-z]/, 'Debe incluir una minúscula').regex(/[0-9]/, 'Debe incluir un número');

authRouter.post('/login', asyncH(async (req, res) => {
  const { email, password } = parse(z.object({ email: z.string().email(), password: z.string().min(1).max(200) }), req.body);
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  const generic = unauthorized('Correo o contraseña incorrectos');
  if (!user || !user.active) {
    await bcrypt.compare(password, '$2a$12$abcdefghijklmnopqrstuuJ0bQvU8b5XgWlZb1uY8aCk1w7tQ0Zy'); // tiempo constante
    throw generic;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) throw unauthorized(`Cuenta bloqueada temporalmente por intentos fallidos. Intente después de ${LOCK_MIN} minutos.`);
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLogins + 1;
    await prisma.user.update({ where: { id: user.id }, data: { failedLogins: failed, lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MIN * 60000) : null } });
    await audit(prisma, { action: 'auth.login_failed', entityType: 'User', entityId: user.id, actorId: user.id, actorEmail: user.email, req });
    throw generic;
  }
  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await audit(prisma, { action: 'auth.login', entityType: 'User', entityId: user.id, actorId: user.id, actorEmail: user.email, req });
  const token = signToken(user.id, user.tokenVersion);
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: env.COOKIE_SECURE === 'true', maxAge: env.JWT_EXPIRES_HOURS * 3600_000, path: '/' });
  res.json({ ok: true, mustChangePwd: user.mustChangePwd, token: env.NODE_ENV === 'test' ? token : undefined });
}));

authRouter.post('/logout', (req, res) => {
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

authRouter.get('/me', authenticate, asyncH(async (req, res) => {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, select: { mustChangePwd: true, phone: true, employeeNo: true } });
  res.json({ id: req.user!.id, email: req.user!.email, fullName: req.user!.fullName, roles: req.user!.roles, permissions: [...req.user!.permissions], ...u });
}));

authRouter.post('/change-password', authenticate, asyncH(async (req, res) => {
  const { current, next } = parse(z.object({ current: z.string(), next: passwordPolicy }), req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (!(await bcrypt.compare(current, user.passwordHash))) throw badRequest('La contraseña actual no es correcta');
  if (current === next) throw badRequest('La nueva contraseña debe ser distinta');
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, env.BCRYPT_ROUNDS), mustChangePwd: false, tokenVersion: { increment: 1 } },
  });
  clearAuthCache(user.id);
  await audit(prisma, { action: 'auth.password_changed', entityType: 'User', entityId: user.id, req });
  res.cookie(COOKIE, signToken(user.id, updated.tokenVersion), { httpOnly: true, sameSite: 'strict', secure: env.COOKIE_SECURE === 'true', maxAge: env.JWT_EXPIRES_HOURS * 3600_000, path: '/' });
  res.json({ ok: true });
}));
