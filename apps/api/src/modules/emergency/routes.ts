import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncH, forbidden } from '../../lib/errors';
import { requirePerm } from '../../middleware/auth';
import { parse, uuid } from '../../lib/http';
import { audit } from '../../lib/audit';

/** Directorio de emergencias: ningún número se precarga como verificado. Solo los VERIFICADOS se sugieren operativamente. */
export const emergencyRouter = Router();
const CAT = z.enum(['EMERGENCIAS_911', 'GUARDIA_NACIONAL', 'AUTORIDAD_ESTATAL', 'AUTORIDAD_MUNICIPAL', 'PROTECCION_CIVIL', 'ASEGURADORA', 'ANRPV', 'PROVEEDOR_GPS', 'GERENCIA', 'OPERACIONES_ESTRATEGICAS', 'CLIENTE', 'OTRO']);
const phone = z.string().trim().regex(/^\+?[0-9\s-]{3,20}$/, 'Teléfono inválido');
const schema = z.object({
  category: CAT, name: z.string().trim().min(3), phone, altPhone: phone.optional().nullable(), altContactName: z.string().optional().nullable(),
  coverage: z.string().trim().min(2), schedule: z.string().optional().nullable(), procedure: z.string().max(3000).optional().nullable(),
});

emergencyRouter.get('/', requirePerm('emergency.view'), asyncH(async (req, res) => {
  const onlyVerified = req.query.verified === 'true';
  res.json(await prisma.emergencyContact.findMany({ where: { ...(onlyVerified ? { status: 'VERIFICADO' } : {}), ...(req.query.category ? { category: req.query.category as never } : {}), status: onlyVerified ? 'VERIFICADO' : { not: 'INACTIVO' } }, orderBy: [{ category: 'asc' }, { name: 'asc' }] }));
}));

emergencyRouter.post('/', requirePerm('emergency.manage'), asyncH(async (req, res) => {
  const b = parse(schema, req.body);
  const c = await prisma.emergencyContact.create({ data: { ...b, status: 'SIN_VERIFICAR' } });
  await audit(prisma, { action: 'emergency.created', entityType: 'EmergencyContact', entityId: c.id, after: b, req });
  res.status(201).json(c);
}));

emergencyRouter.put('/:id', requirePerm('emergency.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(schema.partial(), req.body);
  const before = await prisma.emergencyContact.findUniqueOrThrow({ where: { id } });
  const phoneChanged = (b.phone && b.phone !== before.phone) || (b.altPhone !== undefined && b.altPhone !== before.altPhone);
  const c = await prisma.emergencyContact.update({ where: { id }, data: { ...b, ...(phoneChanged ? { status: 'SIN_VERIFICAR', verifiedAt: null, verifiedById: null } : {}) } });
  await audit(prisma, { action: 'emergency.updated', entityType: 'EmergencyContact', entityId: id, before, after: b, req });
  res.json(c);
}));

emergencyRouter.post('/:id/verify', requirePerm('emergency.verify'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { result, notes } = parse(z.object({ result: z.enum(['VERIFICADO', 'VENCIDO', 'INACTIVO']), notes: z.string().trim().min(10, 'Describa cómo se verificó (llamada de prueba, fuente oficial, fecha)') }), req.body);
  const before = await prisma.emergencyContact.findUniqueOrThrow({ where: { id } });
  if (result === 'VERIFICADO' && before.verifiedById === req.user!.id && before.status === 'VERIFICADO') throw forbidden('Ya verificado por usted');
  const c = await prisma.emergencyContact.update({ where: { id }, data: { status: result, verifiedAt: new Date(), verifiedById: req.user!.id, verificationNotes: notes } });
  await audit(prisma, { action: 'emergency.verified', entityType: 'EmergencyContact', entityId: id, before: { status: before.status }, after: { result, notes }, req });
  res.json(c);
}));
