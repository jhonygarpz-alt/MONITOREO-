import { prisma } from '../lib/prisma';
import { getSetting } from '../lib/settings';
import { localParts, minutesUntilLocal, zonedToUtc } from '../lib/time';
import { notifyRoles, notifyUsers, usersWithRoles } from '../lib/notify';
import { audit } from '../lib/audit';
import { createAlertOnce } from './alerts';
import { closeExpiredCycles, cycleProgress, ensureCurrentCycle, markCompletedCycles } from '../modules/sweeps/service';
import { fleetStatus } from '../modules/fleet';
import { activeStopsEvaluated } from '../modules/operations/service';
import { curfewStatus } from '../modules/route/service';
import { escalate } from '../modules/incidents/escalation';
import { computeKpis } from '../modules/reports/kpis';
import { runOptimaIfEnabled } from '../modules/integrations/optima';

const minuteBucket = (d: Date, min: number) => Math.floor(d.getTime() / (min * 60000));

export interface JobDef { name: string; description: string; key: (now: Date) => string; run: (now: Date) => Promise<unknown> }

export const JOBS: JobDef[] = [
  {
    name: 'optima.sync', description: 'Sincronizar unidades desde la herramienta de estatus de Optima (solo lectura)',
    key: (now) => `optima.sync:${minuteBucket(now, 5)}`,
    run: () => runOptimaIfEnabled(),
  },
  {
    name: 'sweep.generate', description: '1. Generar barridos cada dos horas',
    key: (now) => `sweep.generate:${minuteBucket(now, 5)}`,
    run: async (now) => { const r = await ensureCurrentCycle(now); await markCompletedCycles(); return { cycle: r.cycle.cycleKey, created: r.created }; },
  },
  {
    name: 'sweep.overdue', description: '2. Detectar barridos vencidos o incompletos',
    key: (now) => `sweep.overdue:${minuteBucket(now, 5)}`,
    run: async (now) => {
      const closed = await closeExpiredCycles(now);
      for (const c of closed.filter((x) => x.status === 'VENCIDO')) {
        const a = await createAlertOnce(`sweep-overdue:${c.id}`, { type: 'BARRIDO_VENCIDO', severity: 'ALTA', title: `Barrido vencido: ${c.pending} unidades sin revisar`, description: 'El ciclo cerró con unidades pendientes. El siguiente turno debe atenderlas.' });
        if (a) await notifyRoles(prisma, ['SUPERVISOR', 'GERENCIA'], { type: 'sweep.overdue', title: 'Barrido vencido', body: `${c.pending} unidades sin revisar`, link: '/barridos', severity: 'ALTA', dedupKey: `sweep-overdue:${c.id}` });
      }
      // Advertencia de ciclo incompleto al 75% del tiempo
      const open = await prisma.sweepCycle.findMany({ where: { status: 'EN_CURSO' } });
      for (const c of open) {
        const elapsed = (now.getTime() - c.startsAt.getTime()) / (c.dueAt.getTime() - c.startsAt.getTime());
        if (elapsed < 0.75) continue;
        const p = await cycleProgress(c.id);
        if (p.pending > 0) {
          const a = await createAlertOnce(`sweep-incomplete:${c.id}`, { type: 'BARRIDO_VENCIDO', severity: 'MEDIA', title: `Barrido incompleto: ${p.percent}% avance, ${p.pending} pendientes`, description: 'Restan menos de 30 minutos para el cierre del ciclo.' });
          if (a) await notifyRoles(prisma, ['MONITORISTA', 'SUPERVISOR'], { type: 'sweep.incomplete', title: 'Barrido por vencer', body: `${p.pending} unidades pendientes`, link: '/barridos', severity: 'MEDIA', dedupKey: `sweep-inc:${c.id}` });
        }
      }
      return { closed: closed.length };
    },
  },
  {
    name: 'gps.stale', description: '3. Identificar posiciones GPS desactualizadas y excesos de velocidad',
    key: (now) => `gps.stale:${minuteBucket(now, 5)}`,
    run: async (now) => {
      const fleet = await fleetStatus(now);
      const limit = await getSetting<number>('speed.limitKph');
      let n = 0;
      for (const u of fleet.filter((x) => ['EN_TRANSITO', 'DETENIDA'].includes(x.opStatus))) {
        const src = u.position?.source ?? u.dataSource;
        if (u.freshness === 'SIN_COMUNICACION' || u.freshness === 'NO_DISPONIBLE') {
          const key = `gps-lost:${u.id}:${u.position?.recordedAt.toISOString() ?? 'none'}`;
          if (await createAlertOnce(key, { type: 'PERDIDA_GPS', severity: 'ALTA', unitId: u.id, occurredAt: u.position?.recordedAt ?? null, source: src, title: `${u.economicNumber}: sin comunicación GPS (${u.minutesSincePosition ?? '—'} min)`, description: 'La pérdida de señal no equivale automáticamente a robo. Valide con el operador, el proveedor GPS y las cámaras antes de concluir.', lat: u.position?.lat, lng: u.position?.lng })) n++;
        } else if (u.freshness === 'ATRASADA' && u.opStatus === 'EN_TRANSITO') {
          if (await createAlertOnce(`gps-stale:${u.id}:${u.position!.recordedAt.toISOString()}`, { type: 'POSICION_DESACTUALIZADA', severity: 'MEDIA', unitId: u.id, occurredAt: u.position!.recordedAt, source: src, title: `${u.economicNumber}: posición atrasada (${u.minutesSincePosition} min)` })) n++;
        }
        if (u.freshness === 'ACTUALIZADA' && (u.position?.speedKph ?? 0) > limit) {
          if (await createAlertOnce(`speed:${u.id}:${u.position!.recordedAt.toISOString()}`, { type: 'EXCESO_VELOCIDAD', severity: 'MEDIA', unitId: u.id, occurredAt: u.position!.recordedAt, source: src, title: `${u.economicNumber}: ${u.position!.speedKph} km/h (límite ${limit})`, lat: u.position!.lat, lng: u.position!.lng })) n++;
        }
      }
      return { alerts: n };
    },
  },
  {
    name: 'cameras.alerts', description: '4. Generar alertas de cámaras sin transmisión',
    key: (now) => `cameras.alerts:${minuteBucket(now, 10)}`,
    run: async () => {
      const faults = await prisma.cameraFault.findMany({ where: { status: { not: 'RECUPERADA' }, faultStatus: { in: ['SIN_TRANSMISION', 'DESCONECTADA', 'FALLA_TECNICA'] } }, include: { camera: { include: { unit: true } } } });
      let n = 0;
      for (const f of faults) {
        if (await createAlertOnce(`cam:${f.id}`, { type: 'FALLO_CAMARAS', severity: 'MEDIA', unitId: f.camera.unitId, occurredAt: f.openedAt, title: `${f.camera.unit.economicNumber}: cámara ${f.camera.label} ${f.faultStatus.replace(/_/g, ' ').toLowerCase()}` })) n++;
        // Falla persistente > 24 h sin escalar: escalar a Gerencia
        if (f.status !== 'ESCALADA' && Date.now() - f.openedAt.getTime() > 24 * 3600_000) {
          await prisma.cameraFault.update({ where: { id: f.id }, data: { status: 'ESCALADA', escalatedAt: new Date() } });
          await prisma.cameraFaultAction.create({ data: { faultId: f.id, action: 'ESCALAR_GERENCIA', notes: 'Escalamiento automático: falla persistente > 24 h', actorId: f.openedById } });
          await notifyRoles(prisma, ['GERENCIA'], { type: 'camera.persistent', title: `Falla persistente de cámara: ${f.camera.unit.economicNumber}`, link: '/camaras', severity: 'ALTA', dedupKey: `cam-persist:${f.id}` });
        }
      }
      return { alerts: n };
    },
  },
  {
    name: 'deadtime', description: '5. Detectar tiempos muertos que excedan parámetros',
    key: (now) => `deadtime:${minuteBucket(now, 5)}`,
    run: async (now) => {
      const stops = await activeStopsEvaluated(now);
      let n = 0;
      for (const s of stops) {
        if (s.level === 'EXCEDIDO' || s.level === 'ESCALAR') {
          if (await createAlertOnce(`dead:${s.id}:EXCEDIDO`, { type: 'TIEMPO_MUERTO', severity: 'MEDIA', unitId: s.unitId, occurredAt: s.startedAt, title: `${s.unit.economicNumber}: detenida ${s.minutes} min (${s.operationType.toLowerCase()})`, description: `Motivo registrado: ${s.reason.replace(/_/g, ' ').toLowerCase()}` })) n++;
        }
        if (s.level === 'ESCALAR') {
          const a = await createAlertOnce(`dead:${s.id}:ESCALAR`, { type: 'TIEMPO_MUERTO', severity: 'ALTA', unitId: s.unitId, occurredAt: s.startedAt, title: `${s.unit.economicNumber}: tiempo muerto excesivo ${s.minutes} min — escalado` });
          if (a) {
            await escalate(prisma, { alertId: a.id, from: 'MONITORISTA', to: 'GERENCIA', reason: `Tiempo muerto de ${s.minutes} min supera umbral de escalamiento`, automatic: true, alertType: 'TIEMPO_MUERTO', title: a.title, link: '/seguimiento' });
            await escalate(prisma, { alertId: a.id, from: 'GERENCIA', to: 'OPERACIONES_ESTRATEGICAS', reason: 'Notificación a Operaciones Estratégicas por tiempo muerto excesivo', automatic: true, alertType: 'TIEMPO_MUERTO', title: a.title, link: '/seguimiento' });
            await prisma.alert.update({ where: { id: a.id }, data: { status: 'ESCALADA', escalatedAt: new Date() } });
          }
        }
      }
      return { alerts: n };
    },
  },
  {
    name: 'curfew', description: '6-7. Advertir restricciones de circulación y registrar incumplimientos de resguardo',
    key: (now) => `curfew:${minuteBucket(now, 5)}`,
    run: async (now) => {
      const st = await curfewStatus(now);
      const day = `${st.localNow.y}-${st.localNow.m}-${st.localNow.d}`;
      let n = 0;
      for (const it of st.items) {
        if (it.state === 'ADVERTENCIA') {
          if (await createAlertOnce(`curfew-warn:${it.unit.id}:${day}`, { type: 'RESTRICCION_HORARIA', severity: 'MEDIA', unitId: it.unit.id, title: `${it.unit.economicNumber}: ${it.reason}`, description: it.nextHaven ? `Próximo resguardo autorizado: ${it.nextHaven.name}${it.nextHaven.distanceKm !== null ? ` (~${it.nextHaven.distanceKm} km en línea recta)` : ''}` : 'No hay punto de resguardo validado para el corredor. Coordine con Gerencia.' })) n++;
        }
        if (['INCUMPLIMIENTO', 'SIN_EVIDENCIA', 'RESTRICCION_ACTIVA'].includes(it.state)) {
          const sev = it.state === 'INCUMPLIMIENTO' ? 'ALTA' : 'MEDIA';
          const a = await createAlertOnce(`curfew-breach:${it.unit.id}:${day}:${it.state}`, { type: 'INCUMPLIMIENTO_RESGUARDO', severity: sev, unitId: it.unit.id, title: `${it.unit.economicNumber}: ${it.reason}`, lat: it.unit.position?.lat, lng: it.unit.position?.lng });
          if (a) { n++; if (it.state === 'INCUMPLIMIENTO') await notifyRoles(prisma, ['GERENCIA', 'SUPERVISOR'], { type: 'curfew.breach', title: a.title, link: '/resguardos', severity: 'ALTA', dedupKey: `cb:${a.id}` }); }
        }
      }
      return { evaluated: st.items.length, alerts: n };
    },
  },
  {
    name: 'incidents.reminder', description: '8. Recordar incidencias abiertas sin seguimiento',
    key: (now) => `incidents.reminder:${minuteBucket(now, 10)}`,
    run: async (now) => {
      const mins = await getSetting<number>('incident.reminderMinutes');
      const open = await prisma.incident.findMany({ where: { status: { notIn: ['CERRADA'] } }, include: { events: { orderBy: { seq: 'desc' }, take: 1 } } });
      let n = 0;
      for (const i of open) {
        const last = i.events[0]?.at ?? i.openedAt;
        if (now.getTime() - last.getTime() > mins * 60000) {
          n += await notifyUsers(prisma, [i.responsibleId], { type: 'incident.reminder', title: `Incidencia ${i.folio} sin seguimiento`, body: `Último registro hace ${Math.round((now.getTime() - last.getTime()) / 60000)} min`, link: `/incidencias/${i.id}`, severity: i.priority, dedupKey: `inc-rem:${i.id}:${minuteBucket(now, mins)}` });
        }
      }
      return { reminders: n };
    },
  },
  {
    name: 'docs.expiry', description: '9. Alertar vencimiento de documentos y pólizas',
    key: (now) => `docs.expiry:${now.toISOString().slice(0, 13)}`,
    run: async (now) => {
      const days = await getSetting<number>('docs.expiryWarnDays');
      const limit = new Date(now.getTime() + days * 86400_000);
      const [pols, docs, ops] = await Promise.all([
        prisma.insurancePolicy.findMany({ where: { validTo: { lte: limit } }, include: { unit: true } }),
        prisma.document.findMany({ where: { deletedAt: null, expiresAt: { lte: limit, not: null } } }),
        prisma.operator.findMany({ where: { status: { not: 'BAJA' }, licenseExpiresAt: { lte: limit, not: null } } }),
      ]);
      let n = 0;
      for (const p of pols) if (await createAlertOnce(`doc-pol:${p.id}:${p.validTo < now ? 'vencida' : 'porvencer'}`, { type: 'DOCUMENTO_POR_VENCER', severity: p.validTo < now ? 'ALTA' : 'BAJA', unitId: p.unitId, title: `${p.unit.economicNumber}: póliza ${p.policyNumber} ${p.validTo < now ? 'VENCIDA' : 'por vencer'} (${p.validTo.toISOString().slice(0, 10)})` })) n++;
      for (const d of docs) if (await createAlertOnce(`doc:${d.id}:${d.expiresAt! < now ? 'v' : 'p'}`, { type: 'DOCUMENTO_POR_VENCER', severity: d.expiresAt! < now ? 'MEDIA' : 'BAJA', unitId: d.entityType === 'Unit' ? d.entityId : null, title: `Documento "${d.title}" ${d.expiresAt! < now ? 'vencido' : 'por vencer'} (${d.expiresAt!.toISOString().slice(0, 10)})` })) n++;
      for (const o of ops) if (await createAlertOnce(`lic:${o.id}:${o.licenseExpiresAt! < now ? 'v' : 'p'}`, { type: 'DOCUMENTO_POR_VENCER', severity: o.licenseExpiresAt! < now ? 'ALTA' : 'BAJA', title: `Licencia de ${o.fullName} ${o.licenseExpiresAt! < now ? 'vencida' : 'por vencer'}` })) n++;
      return { alerts: n };
    },
  },
  {
    name: 'handover', description: '10. Recordar entrega de turno y escalar entregas no confirmadas',
    key: (now) => `handover:${minuteBucket(now, 5)}`,
    run: async (now) => {
      const tz = await getSetting<string>('system.timezone');
      const timeout = await getSetting<number>('handover.ackTimeoutMinutes');
      const shifts = await prisma.shiftDefinition.findMany({ where: { active: true } });
      let n = 0;
      for (const s of shifts) {
        let m = minutesUntilLocal(now, s.endTime, tz);
        if (m < -720) m += 1440;
        if (m >= 0 && m <= 30) {
          const lp = localParts(now, tz);
          n += await notifyRoles(prisma, ['MONITORISTA', 'SUPERVISOR'], { type: 'handover.reminder', title: `Fin de turno ${s.name} a las ${s.endTime}`, body: 'Prepare la entrega de turno', link: '/turnos', severity: 'MEDIA', dedupKey: `ho-rem:${s.id}:${lp.y}${lp.m}${lp.d}` });
        }
      }
      const stale = await prisma.shiftHandover.findMany({ where: { status: 'PENDIENTE_CONFIRMACION', createdAt: { lt: new Date(now.getTime() - timeout * 60000) } }, include: { outgoingUser: true } });
      for (const h of stale) {
        await prisma.shiftHandover.update({ where: { id: h.id }, data: { status: 'ESCALADA_SUPERVISION', escalatedAt: now } });
        await audit(prisma, { action: 'handover.escalated', entityType: 'ShiftHandover', entityId: h.id, after: { reason: `Sin confirmación tras ${timeout} min` } });
        await createAlertOnce(`ho-unack:${h.id}`, { type: 'ENTREGA_TURNO_PENDIENTE', severity: 'MEDIA', title: `Entrega de turno de ${h.outgoingUser.fullName} sin confirmar` });
        n += await notifyRoles(prisma, ['SUPERVISOR', 'GERENCIA'], { type: 'handover.unack', title: 'Entrega de turno sin confirmar', body: `${h.outgoingUser.fullName} — ${timeout} min sin recepción`, link: `/turnos/${h.id}`, severity: 'ALTA', dedupKey: `ho-esc:${h.id}` });
      }
      return { notified: n, escalated: stale.length };
    },
  },
  {
    name: 'training.schedule', description: '11. Programar capacitaciones semanales (miércoles 17:00)',
    key: (now) => `training.schedule:${now.toISOString().slice(0, 10)}`,
    run: async (now) => {
      const [weekday, time, tz, confirmed] = await Promise.all([getSetting<number>('training.weekday'), getSetting<string>('training.time'), getSetting<string>('training.timezone'), getSetting<boolean>('training.timezoneConfirmed')]);
      const [h, m] = time.split(':').map(Number);
      const lp = localParts(now, tz);
      let created = 0;
      for (let w = 0; w < 4; w++) {
        const base = new Date(Date.UTC(lp.y, lp.m - 1, lp.d));
        const delta = (weekday - base.getUTCDay() + 7) % 7 + w * 7;
        const day = new Date(base.getTime() + delta * 86400_000);
        const at = zonedToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), h, m, tz);
        if (at < now) continue;
        const autoKey = `weekly:${day.toISOString().slice(0, 10)}`;
        const exists = await prisma.trainingSession.findUnique({ where: { autoKey } });
        if (!exists) {
          await prisma.trainingSession.create({ data: { autoKey, title: 'Sesión semanal de mejora continua', scheduledAt: at, timezone: tz, timezoneConfirmed: confirmed, agenda: 'Revisión de casos de la semana, acuerdos pendientes y desarrollo de capacidades.' } });
          created++;
        }
      }
      // Acuerdos vencidos
      const overdue = await prisma.agreement.updateMany({ where: { status: { in: ['ABIERTO', 'EN_PROCESO'] }, dueDate: { lt: now } }, data: { status: 'VENCIDO' } });
      const today = await prisma.trainingSession.findMany({ where: { status: 'PROGRAMADA', scheduledAt: { gte: now, lte: new Date(now.getTime() + 24 * 3600_000) } } });
      for (const s of today) {
        await notifyRoles(prisma, ['MONITORISTA', 'SUPERVISOR', 'GERENCIA'], { type: 'training.reminder', title: `Capacitación: ${s.title}`, body: `${s.scheduledAt.toISOString()} (${s.timezone}${s.timezoneConfirmed ? '' : ' — zona horaria por confirmar'})`, link: '/capacitacion', dedupKey: `tr-rem:${s.id}` });
      }
      return { created, agreementsOverdue: overdue.count };
    },
  },
  {
    name: 'kpi.consolidate', description: '12. Consolidar indicadores diarios, semanales y mensuales',
    key: (now) => `kpi.consolidate:${now.toISOString().slice(0, 10)}`,
    run: async (now) => {
      const tz = await getSetting<string>('system.timezone');
      const lp = localParts(now, tz);
      const todayStart = zonedToUtc(lp.y, lp.m, lp.d, 0, 0, tz);
      const yStart = new Date(todayStart.getTime() - 86400_000);
      const keyD = yStart.toISOString().slice(0, 10);
      const out: string[] = [];
      const save = async (period: string, periodKey: string, from: Date, to: Date) => {
        const metrics = await computeKpis({ from, to });
        await prisma.kpiSnapshot.upsert({ where: { period_periodKey: { period, periodKey } }, update: { metrics: JSON.parse(JSON.stringify(metrics)) }, create: { period, periodKey, metrics: JSON.parse(JSON.stringify(metrics)) } });
        out.push(`${period}:${periodKey}`);
      };
      await save('daily', keyD, yStart, todayStart);
      if (lp.weekday === 1) await save('weekly', keyD, new Date(todayStart.getTime() - 7 * 86400_000), todayStart);
      if (lp.d === 1) await save('monthly', `${yStart.toISOString().slice(0, 7)}`, zonedToUtc(yStart.getUTCFullYear(), yStart.getUTCMonth() + 1, 1, 0, 0, tz), todayStart);
      return out;
    },
  },
  {
    name: 'alerts.escalation', description: '13. Escalar alertas sin atención según severidad',
    key: (now) => `alerts.escalation:${minuteBucket(now, 2)}`,
    run: async (now) => {
      const escMin = await getSetting<Record<string, number>>('alerts.escalationMinutes');
      const alerts = await prisma.alert.findMany({ where: { status: 'NUEVA' } });
      let n = 0;
      for (const a of alerts) {
        if (now.getTime() - a.detectedAt.getTime() <= (escMin[a.severity] ?? 60) * 60000) continue;
        await prisma.$transaction(async (tx) => {
          await escalate(tx, { alertId: a.id, from: 'MONITORISTA', to: 'GERENCIA', reason: `Alerta sin atención por más de ${escMin[a.severity]} min`, automatic: true, alertType: a.type, title: a.title, link: '/alertas' });
          await tx.alert.update({ where: { id: a.id }, data: { status: 'ESCALADA', escalatedAt: now } });
        });
        n++;
      }
      // Escalamientos no atendidos por el titular: notificar suplentes
      const supervisors = await usersWithRoles(prisma, ['SUPERVISOR']);
      return { escalated: n, supervisors: supervisors.length };
    },
  },
];
