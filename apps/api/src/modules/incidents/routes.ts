import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { asyncH, forbidden, notFound, unprocessable } from '../../lib/errors';
import { can, requirePerm } from '../../middleware/auth';
import { actor, parse, uuid } from '../../lib/http';
import { audit, incidentEvent } from '../../lib/audit';
import { getSetting } from '../../lib/settings';
import { notifyUsers, usersWithPermission } from '../../lib/notify';
import { ALERT_TYPE, SEVERITY } from '../alerts/routes';
import { createIncident } from './service';
import { GRAVE_TYPES, PROTOCOLS } from './protocols';
import { escalate, nextLevel } from './escalation';

export const incidentsRouter = Router();
const CHANNEL = z.enum(['LLAMADA_OPERADOR', 'EMERGENCIAS_911', 'GUARDIA_NACIONAL', 'AUTORIDAD_ESTATAL', 'AUTORIDAD_MUNICIPAL', 'PROTECCION_CIVIL', 'ASEGURADORA', 'ANRPV', 'PROVEEDOR_GPS', 'GERENCIA', 'OPERACIONES_ESTRATEGICAS', 'CLIENTE', 'OTRO']);
const COMMTYPE = z.enum(['LLAMADA_EMERGENCIA', 'DENUNCIA_FORMAL', 'RECLAMACION_SEGURO', 'SOLICITUD_APOYO', 'NOTIFICACION', 'SEGUIMIENTO']);
const RESULT = z.enum(['CONFIRMADA', 'SIN_RESPUESTA', 'FALLIDA', 'PENDIENTE_CONFIRMACION', 'OCUPADO']);

incidentsRouter.get('/protocols', requirePerm('incidents.view'), (_req, res) => res.json(PROTOCOLS));

incidentsRouter.get('/', requirePerm('incidents.view'), asyncH(async (req, res) => {
  const where: Prisma.IncidentWhereInput = {};
  if (req.query.status === 'open' || !req.query.status) where.status = { not: 'CERRADA' };
  else if (req.query.status !== 'all') where.status = req.query.status as never;
  if (req.query.priority) where.priority = req.query.priority as never;
  if (req.query.unitId) where.unitId = String(req.query.unitId);
  if (req.query.q) where.OR = [{ folio: { contains: String(req.query.q), mode: 'insensitive' } }, { title: { contains: String(req.query.q), mode: 'insensitive' } }, { unit: { economicNumber: { contains: String(req.query.q), mode: 'insensitive' } } }];
  res.json(await prisma.incident.findMany({
    where, include: { unit: { select: { economicNumber: true, plates: true } }, responsible: { select: { fullName: true } }, operator: { select: { fullName: true } } },
    orderBy: [{ openedAt: 'desc' }], take: 300,
  }));
}));

incidentsRouter.post('/', requirePerm('incidents.manage'), asyncH(async (req, res) => {
  const b = parse(z.object({ type: ALERT_TYPE, priority: SEVERITY, unitId: uuid.optional().nullable(), tripId: uuid.optional().nullable(), title: z.string().trim().min(3).max(200), description: z.string().max(5000).optional() }), req.body);
  res.status(201).json(await createIncident(req, b));
}));

incidentsRouter.get('/:id', requirePerm('incidents.view'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const inc = await prisma.incident.findUnique({
    where: { id },
    include: {
      unit: { select: { id: true, economicNumber: true, plates: true, type: true } }, operator: { select: { id: true, fullName: true, phonePrimary: true, phoneAlt: true } },
      trip: { select: { id: true, tripNumber: true, origin: true, destination: true, status: true, client: { select: { name: true } } } },
      responsible: { select: { id: true, fullName: true } }, events: { orderBy: { seq: 'asc' } },
      communications: { orderBy: { at: 'asc' }, include: { contact: { select: { name: true, status: true } } } },
      escalations: { orderBy: { at: 'asc' } }, alerts: { select: { id: true, title: true, detectedAt: true } },
      immobRequests: { select: { id: true, folio: true, status: true } },
    },
  });
  if (!inc) throw notFound('Incidencia');
  const protocol = PROTOCOLS.find((p) => p.key === inc.protocolKey) ?? null;
  const operatorCalls = inc.communications.filter((c) => c.channel === 'LLAMADA_OPERADOR');
  const maxCalls = await getSetting<number>('operator.maxCallAttempts');
  res.json({ ...inc, protocol, callGuidance: {
    attempts: operatorCalls.length, maxCalls, answered: operatorCalls.some((c) => c.result === 'CONFIRMADA'),
    grave: GRAVE_TYPES.includes(inc.type), escalateNow: GRAVE_TYPES.includes(inc.type) || (operatorCalls.length >= maxCalls && !operatorCalls.some((c) => c.result === 'CONFIRMADA')),
  } });
}));

/** Expediente de incidente (información sensible: requiere permiso específico; acceso auditado) */
incidentsRouter.get('/:id/dossier', requirePerm('incidents.dossier'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const inc = await prisma.incident.findUnique({ where: { id } });
  if (!inc) throw notFound('Incidencia');
  if (!inc.unitId) return res.json({ incident: inc, unit: null });
  const unit = await prisma.unit.findUniqueOrThrow({
    where: { id: inc.unitId },
    include: { devices: true, policies: { orderBy: { validTo: 'desc' } }, couplingsAsMotor: { where: { uncoupledAt: null }, include: { trailer: { select: { economicNumber: true, plates: true, type: true, vin: true } } } }, cameras: true },
  });
  const [photos, operator, trip] = await Promise.all([
    prisma.document.findMany({ where: { entityType: 'Unit', entityId: unit.id, deletedAt: null }, select: { id: true, title: true, category: true, mimeType: true } }),
    inc.operatorId ? prisma.operator.findUnique({ where: { id: inc.operatorId }, select: { id: true, fullName: true, employeeNo: true, phonePrimary: true, phoneAlt: true, licenseNumber: true } }) : null,
    inc.tripId ? prisma.trip.findUnique({ where: { id: inc.tripId }, include: { client: { select: { name: true } }, route: true } }) : null,
  ]);
  const hazardDocs = trip ? await prisma.document.findMany({ where: { entityType: 'Trip', entityId: trip.id, category: 'HOJA_SEGURIDAD', deletedAt: null }, select: { id: true, title: true } }) : [];
  await audit(prisma, { action: 'incident.dossier_viewed', entityType: 'Incident', entityId: id, req });
  res.json({ incident: inc, unit, photos, operator, trip, hazardDocs, lastKnown: { lat: inc.lastKnownLat, lng: inc.lastKnownLng, at: inc.lastKnownAt, source: inc.lastKnownSource } });
}));

incidentsRouter.post('/:id/communications', requirePerm('incidents.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(z.object({
    channel: CHANNEL, commType: COMMTYPE, contactId: uuid.optional().nullable(), numberUsed: z.string().trim().max(40).optional().nullable(),
    folioObtained: z.string().trim().max(100).optional().nullable(), result: RESULT, notes: z.string().trim().max(3000).optional().nullable(), at: z.coerce.date().optional(),
  }), req.body);
  const inc = await prisma.incident.findUnique({ where: { id } });
  if (!inc) throw notFound('Incidencia');
  if (inc.status === 'CERRADA') throw unprocessable('La incidencia está cerrada');
  if (b.result === 'CONFIRMADA' && !b.folioObtained && !(b.notes && b.notes.length >= 5)) {
    throw unprocessable('Para registrar una comunicación como confirmada indique el folio obtenido o el detalle de la confirmación');
  }
  if (b.channel !== 'LLAMADA_OPERADOR' && !b.numberUsed && !b.contactId) throw unprocessable('Indique el número utilizado o el contacto del directorio');
  if (b.at && b.at > new Date()) throw unprocessable('La hora no puede ser futura');
  let contactWarning: string | null = null;
  if (b.contactId) {
    const c = await prisma.emergencyContact.findUnique({ where: { id: b.contactId } });
    if (!c) throw notFound('Contacto');
    if (c.status !== 'VERIFICADO') contactWarning = `El contacto "${c.name}" NO está verificado. Se registra la comunicación, pero el contacto debe verificarse.`;
    b.numberUsed = b.numberUsed ?? c.phone;
  }
  const attemptNo = (await prisma.incidentCommunication.count({ where: { incidentId: id, channel: b.channel } })) + 1;
  const comm = await prisma.$transaction(async (tx) => {
    const c = await tx.incidentCommunication.create({ data: { incidentId: id, channel: b.channel, commType: b.commType, contactId: b.contactId ?? null, numberUsed: b.numberUsed ?? null, folioObtained: b.folioObtained ?? null, result: b.result, notes: b.notes ?? null, attemptNo, actorId: req.user!.id, at: b.at ?? new Date() } });
    await incidentEvent(tx, id, 'COMUNICACION', `${b.channel.replace(/_/g, ' ')} · ${b.commType.replace(/_/g, ' ')} · intento ${attemptNo} · ${b.result.replace(/_/g, ' ')}${b.folioObtained ? ` · folio ${b.folioObtained}` : ''}`, actor(req), { ...b, attemptNo, contactWarning });
    await audit(tx, { action: 'incident.communication', entityType: 'Incident', entityId: id, after: { ...b, attemptNo }, req });
    return c;
  });
  let autoEscalated = false;
  const maxCalls = await getSetting<number>('operator.maxCallAttempts');
  if (b.channel === 'LLAMADA_OPERADOR' && b.result !== 'CONFIRMADA' && attemptNo >= maxCalls && inc.currentLevel === 'MONITORISTA') {
    await prisma.$transaction(async (tx) => {
      await escalate(tx, { incidentId: id, from: 'MONITORISTA', to: 'GERENCIA', reason: `Operador sin respuesta tras ${attemptNo} intentos`, actorId: req.user!.id, automatic: true, alertType: inc.type, title: `${inc.folio} ${inc.title}`, link: `/incidencias/${id}` });
      await tx.incident.update({ where: { id }, data: { currentLevel: 'GERENCIA', status: 'ESCALADA' } });
      await incidentEvent(tx, id, 'ESCALADA', `Escalamiento automático a Gerencia: operador sin respuesta tras ${attemptNo} intentos`, null);
    });
    autoEscalated = true;
  }
  res.status(201).json({ communication: comm, contactWarning, autoEscalated });
}));

incidentsRouter.post('/:id/notes', requirePerm('incidents.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { message } = parse(z.object({ message: z.string().trim().min(3).max(5000) }), req.body);
  const inc = await prisma.incident.findUnique({ where: { id } });
  if (!inc) throw notFound('Incidencia');
  const ev = await prisma.$transaction((tx) => incidentEvent(tx, id, 'ACCION', message, actor(req)));
  res.status(201).json(ev);
}));

incidentsRouter.post('/:id/protocol-step', requirePerm('incidents.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(z.object({ stepKey: z.string().min(1), outcome: z.enum(['REALIZADO', 'NO_APLICA', 'NO_REALIZADO']), notes: z.string().trim().max(2000).optional() }), req.body);
  const inc = await prisma.incident.findUnique({ where: { id } });
  if (!inc) throw notFound('Incidencia');
  const protocol = PROTOCOLS.find((p) => p.key === inc.protocolKey);
  const step = protocol?.steps.find((s) => s.key === b.stepKey);
  if (!step) throw unprocessable('Paso de protocolo inválido');
  if (b.outcome !== 'REALIZADO' && !(b.notes && b.notes.length >= 5)) throw unprocessable('Justifique por qué el paso no aplica o no se realizó');
  const state = { ...((inc.protocolState as Record<string, unknown>) ?? {}), [b.stepKey]: { outcome: b.outcome, notes: b.notes ?? null, by: req.user!.fullName, at: new Date().toISOString() } };
  const r = await prisma.$transaction(async (tx) => {
    const u = await tx.incident.update({ where: { id }, data: { protocolState: state as Prisma.InputJsonValue } });
    await incidentEvent(tx, id, 'PROTOCOLO', `Paso "${step.title}": ${b.outcome.replace('_', ' ')}${b.notes ? ` — ${b.notes}` : ''}`, actor(req), b);
    return u;
  });
  res.json(r);
}));

incidentsRouter.post('/:id/escalate', requirePerm('incidents.escalate'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { reason } = parse(z.object({ reason: z.string().trim().min(5) }), req.body);
  const inc = await prisma.incident.findUnique({ where: { id } });
  if (!inc) throw notFound('Incidencia');
  const to = nextLevel(inc.currentLevel);
  if (!to) throw unprocessable('La incidencia ya está en el nivel máximo de escalamiento');
  const r = await prisma.$transaction(async (tx) => {
    const e = await escalate(tx, { incidentId: id, from: inc.currentLevel, to, reason, actorId: req.user!.id, alertType: inc.type, title: `${inc.folio} ${inc.title}`, link: `/incidencias/${id}` });
    await tx.incident.update({ where: { id }, data: { currentLevel: to, status: 'ESCALADA' } });
    await incidentEvent(tx, id, 'ESCALADA', `Escalada a ${to.replace('_', ' ')}: ${reason} (${e.recipients} destinatarios notificados en la aplicación)`, actor(req));
    await audit(tx, { action: 'incident.escalated', entityType: 'Incident', entityId: id, after: { to, reason }, req });
    return e;
  });
  res.json(r);
}));

incidentsRouter.post('/:id/status', requirePerm('incidents.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { status, notes } = parse(z.object({ status: z.enum(['EN_ATENCION', 'CONTENIDA']), notes: z.string().trim().min(5) }), req.body);
  const inc = await prisma.incident.findUnique({ where: { id } });
  if (!inc) throw notFound('Incidencia');
  if (['CERRADA', 'PENDIENTE_CIERRE'].includes(inc.status)) throw unprocessable('Estado actual no permite el cambio');
  const r = await prisma.$transaction(async (tx) => {
    const u = await tx.incident.update({ where: { id }, data: { status } });
    await incidentEvent(tx, id, 'ESTADO', `Estado: ${status.replace('_', ' ')} — ${notes}`, actor(req));
    return u;
  });
  res.json(r);
}));

incidentsRouter.post('/:id/reassign', requirePerm('incidents.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { userId, notes } = parse(z.object({ userId: uuid, notes: z.string().trim().min(5) }), req.body);
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u?.active) throw unprocessable('Usuario no válido');
  const r = await prisma.$transaction(async (tx) => {
    const x = await tx.incident.update({ where: { id }, data: { responsibleId: userId } });
    await incidentEvent(tx, id, 'REASIGNADA', `Responsable: ${u.fullName} — ${notes}`, actor(req));
    await notifyUsers(tx, [userId], { type: 'incident.assigned', title: `Incidencia ${x.folio} asignada`, body: notes, link: `/incidencias/${id}`, severity: x.priority });
    return x;
  });
  res.json(r);
}));

/** Solicitud de cierre: exige resultado verificado, justificación y aprobación */
incidentsRouter.post('/:id/request-closure', requirePerm('incidents.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(z.object({ result: z.string().trim().min(10, 'Describa el resultado verificado'), justification: z.string().trim().min(20, 'La justificación debe tener al menos 20 caracteres') }), req.body);
  const inc = await prisma.incident.findUnique({ where: { id }, include: { communications: true } });
  if (!inc) throw notFound('Incidencia');
  if (['CERRADA', 'PENDIENTE_CIERRE'].includes(inc.status)) throw unprocessable('La incidencia ya está cerrada o en revisión de cierre');
  const protocol = PROTOCOLS.find((p) => p.key === inc.protocolKey);
  const state = (inc.protocolState as Record<string, { outcome: string }>) ?? {};
  const missing = (protocol?.steps ?? []).filter((s) => s.critical && !state[s.key]);
  if (GRAVE_TYPES.includes(inc.type) && missing.length) {
    throw unprocessable(`No se puede solicitar cierre de una emergencia con pasos críticos sin documentar: ${missing.map((m) => m.title).join('; ')}`);
  }
  const pendingComms = inc.communications.filter((c) => c.result === 'PENDIENTE_CONFIRMACION' && c.channel !== 'LLAMADA_OPERADOR');
  const r = await prisma.$transaction(async (tx) => {
    const u = await tx.incident.update({ where: { id }, data: { status: 'PENDIENTE_CIERRE', result: b.result, closureJustification: b.justification, closureRequestedById: req.user!.id } });
    await incidentEvent(tx, id, 'CIERRE_SOLICITADO', `Cierre solicitado. Resultado: ${b.result}`, actor(req), { ...b, pendingConfirmations: pendingComms.length });
    const approvers = (await usersWithPermission(tx, 'incidents.close.approve')).filter((x) => x !== req.user!.id);
    await notifyUsers(tx, approvers, { type: 'incident.closure', title: `Cierre por aprobar: ${inc.folio}`, body: b.result, link: `/incidencias/${id}`, severity: inc.priority, dedupKey: `close-${id}-${Date.now()}` });
    return u;
  });
  res.json({ incident: r, pendingConfirmations: pendingComms.length });
}));

incidentsRouter.post('/:id/approve-closure', requirePerm('incidents.close.approve'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { approve, comment } = parse(z.object({ approve: z.boolean(), comment: z.string().trim().min(5) }), req.body);
  const inc = await prisma.incident.findUnique({ where: { id } });
  if (!inc) throw notFound('Incidencia');
  if (inc.status !== 'PENDIENTE_CIERRE') throw unprocessable('La incidencia no está pendiente de cierre');
  const selfApproval = inc.closureRequestedById === req.user!.id;
  if (selfApproval && (inc.priority === 'CRITICA' || inc.priority === 'ALTA' || GRAVE_TYPES.includes(inc.type))) {
    throw forbidden('El cierre de incidencias altas, críticas o de emergencia debe aprobarlo una persona distinta a quien lo solicitó');
  }
  if (!can(req, 'incidents.close.approve')) throw forbidden();
  const r = await prisma.$transaction(async (tx) => {
    const u = approve
      ? await tx.incident.update({ where: { id }, data: { status: 'CERRADA', closedAt: new Date(), closureApprovedById: req.user!.id } })
      : await tx.incident.update({ where: { id }, data: { status: 'EN_ATENCION', closureRequestedById: null } });
    await incidentEvent(tx, id, approve ? 'CERRADA' : 'CIERRE_RECHAZADO', approve ? `Cierre aprobado: ${comment}` : `Cierre rechazado: ${comment}`, actor(req));
    await audit(tx, { action: approve ? 'incident.closed' : 'incident.closure_rejected', entityType: 'Incident', entityId: id, after: { comment }, req });
    return u;
  });
  res.json(r);
}));
