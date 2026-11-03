import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncH, forbidden, notFound, unprocessable } from '../../lib/errors';
import { requirePerm } from '../../middleware/auth';
import { parse, uuid } from '../../lib/http';
import { audit } from '../../lib/audit';
import { nextFolio } from '../../lib/folio';
import { notifyUsers, usersWithPermission } from '../../lib/notify';

export const communiquesRouter = Router();
const TYPE = z.enum(['AVISO_PREVENTIVO', 'REGLA_SEGURIDAD', 'HORARIO_CIRCULACION', 'RECORDATORIO', 'INSTRUCCION_OPERATIVA', 'CAMPANA_SEGURIDAD', 'CAMBIO_PROCEDIMIENTO']);
/** Tipos que siempre requieren aprobación de Gerencia */
const NEEDS_APPROVAL = new Set(['REGLA_SEGURIDAD', 'HORARIO_CIRCULACION', 'INSTRUCCION_OPERATIVA', 'CAMBIO_PROCEDIMIENTO']);

export const TEMPLATES = [
  { key: 'institucional', name: 'Institucional verde', description: 'Encabezado verde con logotipo y franja blanca' },
  { key: 'preventivo', name: 'Aviso preventivo', description: 'Acento ámbar para advertencias' },
  { key: 'critico', name: 'Regla de seguridad', description: 'Acento rojo para reglas obligatorias' },
  { key: 'campana', name: 'Campaña', description: 'Diseño amplio para campañas de seguridad' },
];

communiquesRouter.get('/templates', requirePerm('communiques.view'), (_req, res) => res.json(TEMPLATES));
communiquesRouter.get('/', requirePerm('communiques.view'), asyncH(async (_req, res) => {
  res.json(await prisma.communique.findMany({ include: { distributions: true }, orderBy: { createdAt: 'desc' }, take: 200 }));
}));

communiquesRouter.post('/', requirePerm('communiques.create'), asyncH(async (req, res) => {
  const b = parse(z.object({ type: TYPE, templateKey: z.string().refine((k) => TEMPLATES.some((t) => t.key === k), 'Plantilla inválida'), title: z.string().trim().min(3).max(120), body: z.string().trim().min(10).max(2000) }), req.body);
  const requiresApproval = NEEDS_APPROVAL.has(b.type);
  const c = await prisma.$transaction(async (tx) => {
    const folio = await nextFolio(tx, 'COM', 'communiques');
    const x = await tx.communique.create({ data: { ...b, folio, requiresApproval, status: requiresApproval ? 'PENDIENTE_APROBACION' : 'APROBADO', createdById: req.user!.id, ...(requiresApproval ? {} : { approvedAt: new Date() }) } });
    if (requiresApproval) {
      const ap = (await usersWithPermission(tx, 'communiques.approve')).filter((u) => u !== req.user!.id);
      await notifyUsers(tx, ap, { type: 'communique.approval', title: `Comunicado por aprobar: ${b.title}`, link: '/comunicados', dedupKey: `com-${x.id}` });
    }
    await audit(tx, { action: 'communique.created', entityType: 'Communique', entityId: x.id, after: b, req });
    return x;
  });
  res.status(201).json(c);
}));

communiquesRouter.post('/:id/decide', requirePerm('communiques.approve'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { approve, comment } = parse(z.object({ approve: z.boolean(), comment: z.string().trim().max(500).optional() }), req.body);
  const c = await prisma.communique.findUnique({ where: { id } });
  if (!c) throw notFound('Comunicado');
  if (c.status !== 'PENDIENTE_APROBACION') throw unprocessable('No está pendiente de aprobación');
  if (c.createdById === req.user!.id) throw forbidden('Quien redacta no puede aprobar su propio comunicado');
  const r = await prisma.communique.update({ where: { id }, data: approve ? { status: 'APROBADO', approvedById: req.user!.id, approvedAt: new Date() } : { status: 'RECHAZADO', rejectionReason: comment ?? 'Sin comentario' } });
  await audit(prisma, { action: approve ? 'communique.approved' : 'communique.rejected', entityType: 'Communique', entityId: id, after: { comment }, req });
  res.json(r);
}));

/** Registro de distribución (la app genera la imagen y abre WhatsApp; aquí se deja constancia de quién, cuándo y a quiénes) */
communiquesRouter.post('/:id/distribute', requirePerm('communiques.create'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { channel, recipients } = parse(z.object({ channel: z.enum(['WHATSAPP', 'CORREO', 'IMPRESO', 'PANTALLA', 'OTRO']), recipients: z.string().trim().min(3).max(2000) }), req.body);
  const c = await prisma.communique.findUnique({ where: { id } });
  if (!c) throw notFound('Comunicado');
  if (!['APROBADO', 'PUBLICADO'].includes(c.status)) throw unprocessable('Solo pueden distribuirse comunicados aprobados');
  const r = await prisma.$transaction(async (tx) => {
    const d = await tx.communiqueDistribution.create({ data: { communiqueId: id, channel, recipients, sharedById: req.user!.id } });
    await tx.communique.update({ where: { id }, data: { status: 'PUBLICADO', publishedAt: c.publishedAt ?? new Date() } });
    await audit(tx, { action: 'communique.distributed', entityType: 'Communique', entityId: id, after: { channel, recipients }, req });
    return d;
  });
  res.status(201).json(r);
}));
