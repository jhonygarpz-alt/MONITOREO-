import type { Request } from 'express';
import type { AlertType, Prisma, Severity } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { audit, incidentEvent } from '../../lib/audit';
import { nextFolio } from '../../lib/folio';
import { actor } from '../../lib/http';
import { latestPositions } from '../fleet';
import { GRAVE_TYPES, protocolFor } from './protocols';
import { escalate } from './escalation';

export async function createIncident(req: Request, b: { type: AlertType; priority: Severity; unitId?: string | null; title: string; description?: string; alertId?: string; tripId?: string | null }) {
  return prisma.$transaction(async (tx) => {
    const folio = await nextFolio(tx, 'INC', 'incidents');
    let operatorId: string | null = null; let tripId = b.tripId ?? null;
    let pos: { lat: number; lng: number; recordedAt: Date; source: 'MANUAL' | 'DEMO' | 'INTEGRATION' } | undefined;
    if (b.unitId) {
      const asg = await tx.operatorAssignment.findFirst({ where: { unitId: b.unitId, endAt: null } });
      operatorId = asg?.operatorId ?? null;
      if (!tripId) tripId = (await tx.trip.findFirst({ where: { unitId: b.unitId, status: { notIn: ['FINALIZADO', 'CANCELADO'] } }, orderBy: { createdAt: 'desc' } }))?.id ?? null;
      pos = (await latestPositions(tx, [b.unitId])).get(b.unitId);
    }
    const protocol = protocolFor(b.type);
    const inc = await tx.incident.create({
      data: {
        folio, type: b.type, priority: b.priority, title: b.title, description: b.description, unitId: b.unitId ?? null, operatorId, tripId,
        lastKnownLat: pos?.lat, lastKnownLng: pos?.lng, lastKnownAt: pos?.recordedAt, lastKnownSource: pos?.source,
        responsibleId: req.user!.id, protocolKey: protocol.key, protocolState: {} as Prisma.InputJsonValue, firstResponseAt: new Date(),
        status: 'EN_ATENCION',
      },
    });
    await incidentEvent(tx, inc.id, 'CREADA', `Incidencia ${folio} abierta: ${b.title}`, actor(req), { type: b.type, priority: b.priority, alertId: b.alertId, lastKnown: pos ?? null });
    if (b.alertId) {
      const a = await tx.alert.update({ where: { id: b.alertId }, data: { status: 'CONVERTIDA_INCIDENCIA', incidentId: inc.id } });
      if (!a.firstResponseAt) await tx.alert.update({ where: { id: b.alertId }, data: { firstResponseAt: new Date() } });
    }
    // Emergencias graves: escalamiento inmediato a Gerencia (no se espera a completar llamadas)
    if (GRAVE_TYPES.includes(b.type) || b.priority === 'CRITICA') {
      await escalate(tx, { incidentId: inc.id, from: 'MONITORISTA', to: 'GERENCIA', reason: `Escalamiento inmediato por ${b.type.replace(/_/g, ' ').toLowerCase()} (prioridad ${b.priority})`, actorId: req.user!.id, automatic: true, alertType: b.type, title: `${folio} ${b.title}`, link: `/incidencias/${inc.id}` });
      await tx.incident.update({ where: { id: inc.id }, data: { currentLevel: 'GERENCIA', status: 'ESCALADA' } });
      await incidentEvent(tx, inc.id, 'ESCALADA', 'Escalamiento automático inmediato a Gerencia por gravedad', null);
    }
    await audit(tx, { action: 'incident.created', entityType: 'Incident', entityId: inc.id, after: { folio, ...b }, req });
    return tx.incident.findUniqueOrThrow({ where: { id: inc.id } });
  });
}
