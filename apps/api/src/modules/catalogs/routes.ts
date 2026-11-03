import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { asyncH } from '../../lib/errors';
import { requirePerm } from '../../middleware/auth';
import { parse, uuid } from '../../lib/http';
import { audit } from '../../lib/audit';

export const catalogsRouter = Router();

function crud<S extends z.ZodObject<z.ZodRawShape>>(path: string, model: 'base' | 'client' | 'corridor' | 'route', schema: S, viewPerm: Parameters<typeof requirePerm>[0] = 'units.view') {
  const m = prisma[model] as unknown as { findMany: (a: unknown) => Promise<unknown>; create: (a: unknown) => Promise<{ id: string }>; update: (a: unknown) => Promise<{ id: string }>; };
  catalogsRouter.get(`/${path}`, requirePerm(viewPerm, 'admin.catalogs'), asyncH(async (_req, res) => res.json(await m.findMany({ orderBy: { name: 'asc' } }))));
  catalogsRouter.post(`/${path}`, requirePerm('admin.catalogs'), asyncH(async (req, res) => {
    const b = parse(schema, req.body);
    const r = await m.create({ data: b });
    await audit(prisma, { action: `${model}.created`, entityType: model, entityId: r.id, after: b, req });
    res.status(201).json(r);
  }));
  catalogsRouter.put(`/${path}/:id`, requirePerm('admin.catalogs'), asyncH(async (req, res) => {
    const id = parse(uuid, req.params.id);
    const b = parse(schema.partial(), req.body);
    const r = await m.update({ where: { id }, data: b });
    await audit(prisma, { action: `${model}.updated`, entityType: model, entityId: id, after: b, req });
    res.json(r);
  }));
}

crud('bases', 'base', z.object({ code: z.string().trim().min(2), name: z.string().trim().min(2), city: z.string().trim().min(2), state: z.string().trim().min(2), lat: z.number().optional().nullable(), lng: z.number().optional().nullable(), active: z.boolean().optional() }));
crud('clients', 'client', z.object({ name: z.string().trim().min(2), contactName: z.string().optional().nullable(), contactEmail: z.string().email().optional().nullable(), contactPhone: z.string().optional().nullable(), canSeeOperator: z.boolean().default(false), canSeeApproxLocation: z.boolean().default(false), active: z.boolean().optional() }), 'status.view');
crud('corridors', 'corridor', z.object({ code: z.string().trim().min(2), name: z.string().trim().min(2), description: z.string().optional().nullable() }), 'route.view');
crud('routes', 'route', z.object({ code: z.string().trim().min(2), name: z.string().trim().min(2), origin: z.string().trim().min(2), destination: z.string().trim().min(2), corridorId: uuid.optional().nullable(), beyondMonterrey: z.boolean().default(false), distanceKm: z.number().int().optional().nullable(), expectedHours: z.number().optional().nullable(), geometry: z.any().optional(), active: z.boolean().optional() }) as unknown as z.ZodObject<Prisma.RouteCreateInput & z.ZodRawShape>, 'route.view');
