import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { logger } from './logger';

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}
export const badRequest = (msg: string, details?: unknown) => new AppError(400, 'BAD_REQUEST', msg, details);
export const unauthorized = (msg = 'Sesión no válida') => new AppError(401, 'UNAUTHORIZED', msg);
export const forbidden = (msg = 'No cuenta con permisos para esta operación') => new AppError(403, 'FORBIDDEN', msg);
export const notFound = (what = 'Registro') => new AppError(404, 'NOT_FOUND', `${what} no encontrado`);
export const conflict = (msg: string, details?: unknown) => new AppError(409, 'CONFLICT', msg, details);
export const unprocessable = (msg: string, details?: unknown) => new AppError(422, 'RULE_VIOLATION', msg, details);

export const asyncH =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { code: 'VALIDATION', message: 'Datos inválidos', details: err.flatten().fieldErrors },
    });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return res.status(409).json({ error: { code: 'DUPLICATE', message: 'Ya existe un registro con esos datos', details: err.meta } });
    if (err.code === 'P2025') return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Registro no encontrado' } });
    if (err.code === 'P2003') return res.status(409).json({ error: { code: 'FK', message: 'Referencia inválida o registro en uso' } });
  }
  const msg = (err as Error)?.message ?? '';
  // Violaciones de reglas de integridad en BD (triggers / CHECK)
  if (/Registro inalterable|autorizaciones distintas|propia solicitud|ejecutor autorizado|violates check constraint/i.test(msg)) {
    return res.status(422).json({ error: { code: 'INTEGRITY', message: 'Operación rechazada por reglas de integridad', details: msg.split('\n').pop() } });
  }
  logger.error({ err, path: req.path }, 'Error no controlado');
  return res.status(500).json({ error: { code: 'INTERNAL', message: 'Error interno. La operación NO se completó.' } });
}
