import type { Request } from 'express';
import { z, type ZodTypeAny } from 'zod';

export const parse = <T extends ZodTypeAny>(schema: T, data: unknown): z.infer<T> => schema.parse(data);
export const actor = (req: Request) => ({ id: req.user!.id, fullName: req.user!.fullName });
export const uuid = z.string().uuid();
export const optStr = z.string().trim().max(5000).optional().nullable();
export const reqStr = (min = 1, max = 5000) => z.string().trim().min(min).max(max);
export const isoDate = z.coerce.date();
export const page = (q: Request['query']) => {
  const take = Math.min(Math.max(Number(q.take ?? 50), 1), 500);
  const skip = Math.max(Number(q.skip ?? 0), 0);
  return { take, skip };
};
