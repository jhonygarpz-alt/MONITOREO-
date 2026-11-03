import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, as, makeUnit, prisma, M1, M2, G1, G2, OE, EX, SUP, AUD } from './helpers';
import { tick } from '../src/engine/scheduler';
import { ensureCurrentCycle } from '../src/modules/sweeps/service';
import { verifyAuditChain } from '../src/lib/audit';

async function resetCycles() {
  await prisma.jobRun.deleteMany();
  await prisma.cameraCheck.updateMany({ data: { sweepReviewId: null } });
  await prisma.sweepReview.deleteMany();
  await prisma.sweepCycle.deleteMany();
}
async function reviewFor(unitId: string) {
  const { cycle } = await ensureCurrentCycle();
  return prisma.sweepReview.findUniqueOrThrow({ where: { cycleId_unitId: { cycleId: cycle.id, unitId } } });
}

describe('Autenticación y permisos', () => {
  it('rechaza credenciales inválidas sin revelar si el usuario existe', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'monitorista1@cim.local', password: 'incorrecta' });
    expect(r.status).toBe(401);
    expect(r.body.error.message).toBe('Correo o contraseña incorrectos');
  });
  it('rechaza peticiones sin sesión', async () => {
    expect((await request(app).get('/api/dashboard/operational')).status).toBe(401);
  });
  it('usuario sin permisos suficientes recibe 403 (monitorista no puede ver auditoría ni autorizar inmovilización)', async () => {
    expect((await as(M1).get('/api/admin/audit')).status).toBe(403);
    expect((await as(M1).post('/api/immobilization/00000000-0000-0000-0000-000000000000/authorize', { decision: 'APROBADA', comment: 'intento indebido' })).status).toBe(403);
    expect((await as(AUD).post('/api/alerts', { type: 'ACCIDENTE' })).status).toBe(403);
  });
  it('exige encabezado anti-CSRF cuando se usa cookie de sesión', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: M1, password: 'Test-Pass-123' });
    const cookie = login.headers['set-cookie'];
    const r = await request(app).post('/api/tasks').set('Cookie', cookie).send({ title: 'x123' });
    expect(r.status).toBe(403);
    const ok = await request(app).post('/api/tasks').set('Cookie', cookie).set('X-CIM-Client', 'web').send({ title: 'Pendiente válido' });
    expect(ok.status).toBe(201);
  });
});

describe('Barridos de flota', () => {
  beforeEach(resetCycles);

  it('dos monitoristas revisando simultáneamente la misma unidad: el segundo es bloqueado', async () => {
    const { unit } = await makeUnit();
    const rv = await reviewFor(unit.id);
    const [a, b] = await Promise.all([as(M1).post(`/api/sweeps/reviews/${rv.id}/open`), as(M2).post(`/api/sweeps/reviews/${rv.id}/open`)]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  it('no permite marcar cámaras como funcionando sin haber visto la imagen', async () => {
    const { unit, cams } = await makeUnit();
    const rv = await reviewFor(unit.id);
    const open = await as(M1).post(`/api/sweeps/reviews/${rv.id}/open`);
    const r = await as(M1).post(`/api/sweeps/reviews/${rv.id}/submit`, { version: open.body.review.version, gpsStatus: 'VERIFICADO', locationVerified: 'VERIFICADO', movementState: 'EN_MOVIMIENTO', cameraChecks: [{ cameraId: cams[0].id, status: 'FUNCIONANDO', imageViewed: false }] });
    expect(r.status).toBe(422);
  });

  it('no permite verificar GPS sin posición registrada (pérdida de GPS)', async () => {
    const { unit, cams } = await makeUnit({ noPosition: true });
    const rv = await reviewFor(unit.id);
    const open = await as(M1).post(`/api/sweeps/reviews/${rv.id}/open`);
    const r = await as(M1).post(`/api/sweeps/reviews/${rv.id}/submit`, { version: open.body.review.version, gpsStatus: 'VERIFICADO', locationVerified: 'VERIFICADO', movementState: 'DESCONOCIDO', cameraChecks: [{ cameraId: cams[0].id, status: 'FUNCIONANDO', imageViewed: true }] });
    expect(r.status).toBe(422);
  });

  it('registra revisión verificada con evidencia y avance del ciclo; cámara sin transmisión abre falla', async () => {
    const { unit, cams } = await makeUnit({ cameras: 2 });
    const rv = await reviewFor(unit.id);
    const open = await as(M1).post(`/api/sweeps/reviews/${rv.id}/open`);
    const r = await as(M1).post(`/api/sweeps/reviews/${rv.id}/submit`, { version: open.body.review.version, gpsStatus: 'VERIFICADO', locationVerified: 'VERIFICADO', movementState: 'DETENIDA', stopReason: 'DESCANSO_OBLIGATORIO', cameraChecks: [{ cameraId: cams[0].id, status: 'FUNCIONANDO', imageViewed: true }, { cameraId: cams[1].id, status: 'SIN_TRANSMISION', imageViewed: false }] });
    expect(r.status).toBe(200);
    expect(r.body.review.status).toBe('CON_ANOMALIA');
    expect(r.body.review.reviewedById).toBeTruthy();
    expect(r.body.review.lastPositionAt).toBeTruthy();
    const fault = await prisma.cameraFault.findFirst({ where: { cameraId: cams[1].id, status: { not: 'RECUPERADA' } } });
    expect(fault).toBeTruthy();
    // genera alerta de cámara sin transmisión en el motor
    await tick(new Date());
    expect(await prisma.alert.count({ where: { type: 'FALLO_CAMARAS', unitId: unit.id } })).toBe(1);
  });

  it('barrido vencido: el ciclo se cierra como VENCIDO, genera una sola alerta y queda visible al siguiente turno', async () => {
    await makeUnit();
    const past = new Date(Date.now() - 2 * 3600_000);
    const { cycle } = await ensureCurrentCycle(past);
    const now = new Date();
    await tick(now);
    await prisma.jobRun.deleteMany();
    await tick(now); // segunda ejecución no duplica la alerta
    const c = await prisma.sweepCycle.findUniqueOrThrow({ where: { id: cycle.id } });
    expect(c.status).toBe('VENCIDO');
    expect(await prisma.alert.count({ where: { dedupKey: `sweep-overdue:${cycle.id}` } })).toBe(1);
    const cur = await as(M2).get('/api/sweeps/current');
    expect(cur.status).toBe(200);
    expect(cur.body.cycle.id).not.toBe(cycle.id);
    expect(cur.body.previousPending.some((p: { id: string }) => p.id === cycle.id)).toBe(true);
  });

  it('motor de reglas no duplica ciclos ni alertas al ejecutarse varias veces (protección contra duplicados)', async () => {
    const { unit } = await makeUnit({ ageMin: 600, opStatus: 'EN_TRANSITO' });
    const t = new Date();
    await Promise.all([tick(t), tick(t), tick(t)]);
    expect(await prisma.sweepCycle.count()).toBe(1);
    expect(await prisma.alert.count({ where: { type: 'PERDIDA_GPS', unitId: unit.id } })).toBe(1);
    const a = await prisma.alert.findFirstOrThrow({ where: { type: 'PERDIDA_GPS', unitId: unit.id } });
    expect(a.type).not.toBe('POSIBLE_ROBO'); // la falta de señal no se asume como robo
    expect(a.description).toMatch(/no equivale automáticamente a robo/);
  });
});

describe('Cámaras', () => {
  it('no permite solicitar revisión física con el vehículo en movimiento y exige ver imagen para recuperar', async () => {
    const { cams } = await makeUnit({ speed: 70 });
    const f = await as(M1).post('/api/cameras/faults', { cameraId: cams[0].id, status: 'SIN_TRANSMISION', notes: 'sin video' });
    expect(f.status).toBe(201);
    const req1 = await as(M1).post(`/api/cameras/faults/${f.body.id}/actions`, { action: 'SOLICITAR_REVISION', notes: 'revisar conector', vehicleStopped: true });
    expect(req1.status).toBe(422);
    const rec = await as(M1).post(`/api/cameras/faults/${f.body.id}/actions`, { action: 'CONFIRMAR_RECUPERACION', notes: 'regresó', imageViewed: false });
    expect(rec.status).toBe(422);
    const ok = await as(M1).post(`/api/cameras/faults/${f.body.id}/actions`, { action: 'CONFIRMAR_RECUPERACION', notes: 'imagen restablecida', imageViewed: true });
    expect(ok.status).toBe(200);
    const av = await as(M1).get('/api/cameras/availability');
    expect(av.body.availabilityPct).not.toBeNull();
  });
});

describe('Control operativo', () => {
  it('unidad detenida por descanso obligatorio: no se permite solicitar movimiento', async () => {
    const { unit } = await makeUnit({ opStatus: 'DETENIDA' });
    const s = await as(M1).post('/api/ops/stops', { unitId: unit.id, reason: 'DESCANSO_OBLIGATORIO', operationType: 'TRANSITO' });
    expect(s.status).toBe(201);
    const r = await as(M1).post(`/api/ops/stops/${s.body.id}/reminders`, { channel: 'LLAMADA', message: 'Favor de continuar', safeConditionsConfirmed: true });
    expect(r.status).toBe(422);
    expect(r.body.error.message).toMatch(/descanso/i);
    // y el tiempo muerto no se considera excedido
    const list = await as(M1).get('/api/ops/stops');
    expect(list.body.find((x: { id: string }) => x.id === s.body.id).level).toBe('NORMAL');
  });
  it('cambiar umbrales de tiempos muertos requiere autorización de otra persona', async () => {
    const r = await as(G1).put('/api/ops/thresholds/TRANSITO', { warnMinutes: 20, maxMinutes: 50, escalateMinutes: 100, reason: 'Ajuste por evaluación de riesgo' });
    expect(r.status).toBe(202);
    expect((await as(G1).post(`/api/admin/change-requests/${r.body.id}/decide`, { approve: true, comment: 'autoaprobación' })).status).toBe(403);
    expect((await as(G2).post(`/api/admin/change-requests/${r.body.id}/decide`, { approve: true, comment: 'aprobado' })).status).toBe(200);
    expect((await prisma.deadTimeThreshold.findUniqueOrThrow({ where: { operationType: 'TRANSITO' } })).warnMinutes).toBe(20);
  });
});

describe('Resguardo nocturno', () => {
  it('aproximación al horario límite genera advertencia; dentro del horario y en movimiento es incumplimiento', async () => {
    const corridor = await prisma.corridor.create({ data: { code: `C-${Date.now()}`, name: 'Corredor prueba' } });
    const route = await prisma.route.create({ data: { code: `R-${Date.now()}`, name: 'Ruta foránea prueba', origin: 'Nuevo Laredo', destination: 'Foráneo', beyondMonterrey: true, corridorId: corridor.id } });
    const client = await prisma.client.create({ data: { name: `Cliente ${Date.now()}` } });
    const { unit } = await makeUnit({ speed: 70 });
    await prisma.trip.create({ data: { tripNumber: `V-${Date.now()}`, clientId: client.id, routeId: route.id, unitId: unit.id, origin: 'NLD', destination: 'Foráneo', status: 'EN_TRANSITO' } });
    const { curfewStatus } = await import('../src/modules/route/service');
    // 21:00 hora de Monterrey (UTC-6) = 03:00 UTC del día siguiente
    const warn = await curfewStatus(new Date('2026-11-04T03:00:00Z'));
    await prisma.gpsPosition.create({ data: { unitId: unit.id, lat: 26, lng: -100, speedKph: 70, recordedAt: new Date('2026-11-04T04:59:00Z'), source: 'MANUAL' } });
    const breach = await curfewStatus(new Date('2026-11-04T05:00:00Z')); // 23:00 local
    expect(warn.items.find((i) => i.unit.id === unit.id)?.state).toBe('ADVERTENCIA');
    expect(breach.items.find((i) => i.unit.id === unit.id)?.state).toBe('INCUMPLIMIENTO');
  });
});

describe('Incidencias, protocolos y escalamiento', () => {
  it('operador que no responde: tras 3 llamadas sin respuesta se escala automáticamente a Gerencia', async () => {
    const { unit } = await makeUnit();
    const inc = await as(M1).post('/api/incidents', { type: 'PARADA_SOSPECHOSA', priority: 'ALTA', unitId: unit.id, title: 'Parada no programada' });
    expect(inc.status).toBe(201);
    for (let i = 0; i < 3; i++) {
      const c = await as(M1).post(`/api/incidents/${inc.body.id}/communications`, { channel: 'LLAMADA_OPERADOR', commType: 'SEGUIMIENTO', result: 'SIN_RESPUESTA', numberUsed: '8110000000' });
      expect(c.status).toBe(201);
      if (i === 2) expect(c.body.autoEscalated).toBe(true);
    }
    const d = await as(M1).get(`/api/incidents/${inc.body.id}`);
    expect(d.body.currentLevel).toBe('GERENCIA');
    expect(d.body.events.some((e: { kind: string }) => e.kind === 'ESCALADA')).toBe(true);
  });

  it('no permite registrar una comunicación como confirmada sin folio o evidencia', async () => {
    const inc = await as(M1).post('/api/incidents', { type: 'DESVIACION_RUTA', priority: 'MEDIA', title: 'Desvío' });
    const c = await as(M1).post(`/api/incidents/${inc.body.id}/communications`, { channel: 'EMERGENCIAS_911', commType: 'LLAMADA_EMERGENCIA', result: 'CONFIRMADA', numberUsed: '911' });
    expect(c.status).toBe(422);
  });

  it('posible robo: escalamiento inmediato, expediente accesible y cierre bloqueado sin pasos críticos y sin segunda persona', async () => {
    const { unit } = await makeUnit();
    const inc = await as(M1).post('/api/incidents', { type: 'POSIBLE_ROBO', priority: 'CRITICA', unitId: unit.id, title: 'Posible robo' });
    expect(inc.body.status).toBe('ESCALADA');
    expect(inc.body.lastKnownLat).toBe(26);
    const dossier = await as(M1).get(`/api/incidents/${inc.body.id}/dossier`);
    expect(dossier.status).toBe(200);
    expect(dossier.body.unit.economicNumber).toBe(unit.economicNumber);
    const close = await as(M1).post(`/api/incidents/${inc.body.id}/request-closure`, { result: 'Unidad localizada', justification: 'Se localizó la unidad y operador sin novedad' });
    expect(close.status).toBe(422);
    for (const k of ['expediente', 'llamada_911', 'guardia_nacional', 'gerencia']) {
      expect((await as(M1).post(`/api/incidents/${inc.body.id}/protocol-step`, { stepKey: k, outcome: 'REALIZADO' })).status).toBe(200);
    }
    expect((await as(M1).post(`/api/incidents/${inc.body.id}/request-closure`, { result: 'Unidad localizada', justification: 'Se localizó la unidad y operador sin novedad' })).status).toBe(200);
    // monitorista no puede aprobar
    expect((await as(M1).post(`/api/incidents/${inc.body.id}/approve-closure`, { approve: true, comment: 'cerrar' })).status).toBe(403);
    expect((await as(G1).post(`/api/incidents/${inc.body.id}/approve-closure`, { approve: true, comment: 'Validado con evidencia' })).status).toBe(200);
  });

  it('el historial de incidencias y la auditoría son inalterables en base de datos', async () => {
    const inc = await as(M1).post('/api/incidents', { type: 'FALLO_CAMARAS', priority: 'BAJA', title: 'Cámara' });
    await expect(prisma.incidentEvent.updateMany({ where: { incidentId: inc.body.id }, data: { message: 'alterado' } })).rejects.toThrow();
    await expect(prisma.incidentEvent.deleteMany({ where: { incidentId: inc.body.id } })).rejects.toThrow();
    await expect(prisma.auditLog.deleteMany({})).rejects.toThrow();
    expect((await verifyAuditChain()).ok).toBe(true);
  });

  it('alertas críticas no pueden ser descartadas por el monitorista', async () => {
    const a = await as(M1).post('/api/alerts', { type: 'INCENDIO' });
    expect(a.body.severity).toBe('CRITICA');
    expect((await as(M1).post(`/api/alerts/${a.body.id}/resolve`, { outcome: 'DESCARTADA', resolution: 'Falsa alarma según operador' })).status).toBe(403);
  });
});

describe('Inmovilización', () => {
  it('bloquea la solicitud con vehículo en movimiento', async () => {
    const { unit } = await makeUnit({ speed: 45 });
    const r = await as(M1).post('/api/immobilization', { unitId: unit.id, reason: 'Posible robo confirmado', riskAssessment: 'Unidad desviada de ruta, operador sin respuesta, evaluación de riesgo documentada', conditions: { vehicleStopped: true, safeLocation: true, noRiskToPeople: true, operatorStatusKnown: false, authoritiesInformed: true } });
    expect(r.status).toBe(422);
    expect(r.body.error.message).toMatch(/movimiento/);
  });

  it('solicitud sin autorización no puede ejecutarse; requiere dos autorizaciones distintas al solicitante y confirmación del proveedor', async () => {
    const { unit } = await makeUnit({ speed: 0 });
    const r = await as(M1).post('/api/immobilization', { unitId: unit.id, reason: 'Posible robo confirmado', riskAssessment: 'Unidad detenida en punto no autorizado, operador sin respuesta, evaluación documentada', conditions: { vehicleStopped: true, safeLocation: true, noRiskToPeople: true, operatorStatusKnown: false, authoritiesInformed: true } });
    expect(r.status).toBe(201);
    const id = r.body.id;
    expect((await as(EX).post(`/api/immobilization/${id}/execution`, { providerConfirmation: 'ABC', executionNotes: 'ejecutado en plataforma', outcome: 'CONFIRMADA' })).status).toBe(422);
    expect((await as(G1).post(`/api/immobilization/${id}/authorize`, { decision: 'APROBADA', comment: 'Autorizo con base en evaluación' })).body.status).toBe('PRIMERA_AUTORIZACION');
    expect((await as(G1).post(`/api/immobilization/${id}/authorize`, { decision: 'APROBADA', comment: 'Segunda vez misma persona' })).status).toBe(403);
    expect((await as(OE).post(`/api/immobilization/${id}/authorize`, { decision: 'APROBADA', comment: 'Autorizo segunda firma' })).body.status).toBe('AUTORIZADA');
    // Intento fallido NO queda como ejecutado
    const fail = await as(EX).post(`/api/immobilization/${id}/execution`, { providerConfirmation: 'N/A', executionNotes: 'El proveedor no confirmó', outcome: 'FALLIDA' });
    expect(fail.body.request.status).toBe('AUTORIZADA');
    expect(fail.body.commandSentBySystem).toBe(false);
    const ok = await as(EX).post(`/api/immobilization/${id}/execution`, { providerConfirmation: 'TICKET-123', executionNotes: 'Bloqueo de siguiente arranque confirmado', outcome: 'CONFIRMADA' });
    expect(ok.body.request.status).toBe('EJECUCION_REGISTRADA');
    // La BD rechaza saltarse las autorizaciones
    const { unit: u2 } = await makeUnit();
    const raw = await prisma.immobilizationRequest.create({ data: { folio: `X-${Date.now()}`, unitId: u2.id, reason: 'x', riskAssessment: 'x', conditions: {}, requestedById: (await prisma.user.findFirstOrThrow({ where: { email: M1 } })).id } });
    await expect(prisma.immobilizationRequest.update({ where: { id: raw.id }, data: { status: 'AUTORIZADA' } })).rejects.toThrow();
  });
});

describe('Entrega de turno', () => {
  it('cambio de turno con incidencias abiertas conserva responsables; sin confirmación se escala a supervisión', async () => {
    const inc = await as(M1).post('/api/incidents', { type: 'DESVIACION_RUTA', priority: 'MEDIA', title: 'Desvío abierto' });
    const m2 = await prisma.user.findFirstOrThrow({ where: { email: M2 } });
    const h = await as(M1).post('/api/handovers', { incomingUserId: m2.id, priorities: 'Dar seguimiento a desvío' });
    expect(h.status).toBe(201);
    const snap = h.body.snapshot;
    expect(snap.incidents.some((i: { id: string }) => i.id === inc.body.id)).toBe(true);
    // el saliente no puede confirmar su propia entrega
    expect((await as(M1).post(`/api/handovers/${h.body.id}/acknowledge`, {})).status).toBe(403);
    // escalamiento por falta de confirmación
    await prisma.$executeRawUnsafe(`UPDATE shift_handovers SET "createdAt" = now() - interval '2 hours' WHERE id = '${h.body.id}'`);
    await prisma.jobRun.deleteMany();
    await tick(new Date());
    expect((await prisma.shiftHandover.findUniqueOrThrow({ where: { id: h.body.id } })).status).toBe('ESCALADA_SUPERVISION');
    const ack = await as(M2).post(`/api/handovers/${h.body.id}/acknowledge`, { withObservations: false });
    expect(ack.status).toBe(200);
    const i2 = await prisma.incident.findUniqueOrThrow({ where: { id: inc.body.id } });
    const m1 = await prisma.user.findFirstOrThrow({ where: { email: M1 } });
    expect(i2.responsibleId).toBe(m1.id); // se conserva el responsable
  });
});

describe('Reportes y privacidad', () => {
  it('reportes con información incompleta devuelven null y notas de calidad (no 0% ni 100%)', async () => {
    const r = await as(G1).get('/api/reports/kpis?from=2020-01-01&to=2020-01-02&period=custom');
    expect(r.status).toBe(200);
    expect(r.body.sweeps.compliancePct).toBeNull();
    expect(r.body.dataQuality.length).toBeGreaterThan(0);
    const x = await as(G1).get('/api/reports/export.xlsx?period=weekly');
    expect(x.status).toBe(200);
  });
  it('contacto de emergencia del operador oculto sin permiso', async () => {
    await prisma.operator.create({ data: { employeeNo: `E-${Date.now()}`, fullName: 'Operador Privacidad', emergencyContactPhone: '5512345678' } });
    const r = await as(EX).get('/api/operators');
    expect(r.status).toBe(403);
    const list = await as(M1).get('/api/operators?q=Privacidad');
    expect(list.body[0].emergencyContactPhone).toMatch(/restringido/);
  });
  it('comanda para cliente no expone operador ni ubicación si el cliente no está autorizado', async () => {
    const client = await prisma.client.create({ data: { name: `Cliente priv ${Date.now()}`, canSeeOperator: false, canSeeApproxLocation: false } });
    const { unit } = await makeUnit();
    const op = await prisma.operator.create({ data: { employeeNo: `OP-${Date.now()}`, fullName: 'Nombre Confidencial' } });
    const trip = await prisma.trip.create({ data: { tripNumber: `VT-${Date.now()}`, clientId: client.id, unitId: unit.id, operatorId: op.id, origin: 'A', destination: 'B', status: 'EN_TRANSITO' } });
    const r = await as(M1).post(`/api/status/trips/${trip.id}/reports`, { includeOperator: true });
    expect(r.status).toBe(201);
    expect(r.body.snapshot.operator).toBeNull();
    expect(JSON.stringify(r.body.snapshot)).not.toMatch(/"lat"|"lng"/);
    expect(r.body.snapshot.currentLocation).toMatch(/no autorizada/);
  });
});

describe('Directorio de emergencias', () => {
  it('los contactos nuevos quedan sin verificar y cambiar el número revoca la verificación', async () => {
    const c = await as(SUP).post('/api/emergency-contacts', { category: 'ASEGURADORA', name: 'Aseguradora prueba', phone: '8000000000', coverage: 'Nacional' });
    expect(c.body.status).toBe('SIN_VERIFICAR');
    expect((await as(G1).post(`/api/emergency-contacts/${c.body.id}/verify`, { result: 'VERIFICADO', notes: 'Llamada de prueba exitosa' })).body.status).toBe('VERIFICADO');
    expect((await as(SUP).put(`/api/emergency-contacts/${c.body.id}`, { phone: '8000000001' })).body.status).toBe('SIN_VERIFICAR');
  });
});
