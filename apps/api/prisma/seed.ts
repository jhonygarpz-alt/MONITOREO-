/**
 * Semilla del sistema.
 *  - Siempre: permisos, roles, parámetros, umbrales, turnos, integraciones (deshabilitadas),
 *    regla inicial de resguardo nocturno (política de la empresa) y usuarios iniciales.
 *  - SEED_DEMO=true: datos de DEMOSTRACIÓN claramente etiquetados ([DEMO], dataSource=DEMO).
 * No se cargan zonas de riesgo, estadísticas ni contactos de emergencia inventados.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PERMISSIONS, ROLES } from '../src/rbac/catalog';
import { DEFAULT_SETTINGS } from '../src/lib/settings';

const prisma = new PrismaClient();
const DEMO = process.env.SEED_DEMO === 'true';
const PASSWORD = process.env.SEED_PASSWORD ?? 'Monitoreo2026!';

async function main() {
  for (const [key, [module, description, critical]] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({ where: { key }, update: { module, description, critical }, create: { key, module, description, critical } });
  }
  const perms = await prisma.permission.findMany();
  const pid = new Map(perms.map((p) => [p.key, p.id]));
  for (const [key, r] of Object.entries(ROLES)) {
    const role = await prisma.role.upsert({ where: { key }, update: { name: r.name, description: r.description }, create: { key, name: r.name, description: r.description, system: true } });
    const existing = await prisma.rolePermission.count({ where: { roleId: role.id } });
    if (!existing) await prisma.rolePermission.createMany({ data: r.perms.map((p) => ({ roleId: role.id, permissionId: pid.get(p)! })), skipDuplicates: true });
  }

  for (const [key, d] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value: d.value as never, critical: d.critical, description: d.description } });
  }

  const thresholds: [string, number, number, number][] = [['TRANSITO', 30, 60, 120], ['CARGA', 120, 180, 300], ['DESCARGA', 120, 180, 300], ['RESGUARDO', 600, 720, 900], ['PATIO', 480, 720, 1440], ['MANTENIMIENTO', 1440, 2880, 4320]];
  for (const [t, w, m, e] of thresholds) await prisma.deadTimeThreshold.upsert({ where: { operationType: t as never }, update: {}, create: { operationType: t as never, warnMinutes: w, maxMinutes: m, escalateMinutes: e } });

  for (const s of [{ name: 'Matutino', startTime: '06:00', endTime: '14:00' }, { name: 'Vespertino', startTime: '14:00', endTime: '22:00' }, { name: 'Nocturno', startTime: '22:00', endTime: '06:00' }]) {
    await prisma.shiftDefinition.upsert({ where: { name: s.name }, update: {}, create: s });
  }

  const integrations = [
    { key: 'gps', name: 'Plataforma GPS / telemetría', kind: 'GPS', notes: 'Pendiente: definir proveedor, API y validar. Mientras tanto las posiciones son manuales o de demostración.' },
    { key: 'cameras', name: 'Plataforma de videovigilancia (DVR/MDVR)', kind: 'CAMERAS', notes: 'Pendiente: integración de estado de canales.' },
    { key: 'immobilizer', name: 'Comandos de inmovilización', kind: 'IMMOBILIZER', notes: 'NO HABILITAR sin validar fabricante, compatibilidad, procedimiento legal y seguridad. Solo bloqueo de siguiente arranque con unidad detenida.' },
    { key: 'traffic', name: 'Sistemas de tráfico', kind: 'TRAFFIC', notes: 'Futuro.' },
    { key: 'optima', name: 'Optima Dual Solutions — Actualización de Estatus', kind: 'FLEET', notes: 'Sincronización de solo lectura de unidades, operadores, estatus, ubicación (texto) y viajes desde flota_estatus.' },
    { key: 'whatsapp', name: 'WhatsApp Business API', kind: 'MESSAGING', notes: 'Actualmente se comparte mediante enlace wa.me desde el dispositivo del usuario.' },
  ];
  for (const i of integrations) await prisma.integration.upsert({ where: { key: i.key }, update: {}, create: { ...i, enabled: false, validated: false } });

  // Regla operativa inicial definida por la empresa
  if (!(await prisma.circulationRule.count())) {
    await prisma.circulationRule.create({ data: { name: 'Resguardo nocturno — rutas foráneas desde Nuevo Laredo más allá de Monterrey', appliesBeyondMonterrey: true, curfewStart: '22:00', curfewEnd: '06:00', warnMinutesBefore: 90, riskAssessmentRef: 'Política corporativa inicial (pendiente de evaluación de riesgos por corredor)' } });
  }

  // Contactos públicos nacionales: se cargan SIN VERIFICAR; deben verificarse antes del uso operativo.
  if (!(await prisma.emergencyContact.count())) {
    await prisma.emergencyContact.createMany({ data: [
      { category: 'EMERGENCIAS_911', name: 'Número Nacional de Emergencias 911', phone: '911', coverage: 'Nacional', schedule: '24 h', procedure: 'Proporcionar ubicación, tipo de emergencia, producto transportado y lesionados. Registrar folio.', status: 'SIN_VERIFICAR' },
    ] });
  }

  const hash = await bcrypt.hash(PASSWORD, 12);
  const users = [
    { email: 'admin@cim.local', fullName: 'Administrador del Sistema', roles: ['ADMIN'] },
    { email: 'gerencia@cim.local', fullName: 'Gerencia de Monitoreo', roles: ['GERENCIA'] },
    { email: 'gerencia2@cim.local', fullName: 'Gerencia Suplente', roles: ['GERENCIA'] },
    { email: 'oe@cim.local', fullName: 'Operaciones Estratégicas', roles: ['OPERACIONES_ESTRATEGICAS'] },
    { email: 'supervisor@cim.local', fullName: 'Supervisor de Turno', roles: ['SUPERVISOR'] },
    { email: 'monitorista1@cim.local', fullName: 'Monitorista Turno A', roles: ['MONITORISTA'] },
    { email: 'monitorista2@cim.local', fullName: 'Monitorista Turno B', roles: ['MONITORISTA'] },
    { email: 'ejecutor@cim.local', fullName: 'Ejecutor Autorizado GPS', roles: ['EJECUTOR_GPS'] },
    { email: 'auditor@cim.local', fullName: 'Auditoría Interna', roles: ['AUDITOR'] },
  ];
  const roles = await prisma.role.findMany();
  const rid = new Map(roles.map((r) => [r.key, r.id]));
  for (const u of users) {
    const exists = await prisma.user.findUnique({ where: { email: u.email } });
    if (!exists) await prisma.user.create({ data: { email: u.email, fullName: u.fullName, passwordHash: hash, mustChangePwd: process.env.NODE_ENV === 'production', roles: { create: u.roles.map((r) => ({ roleId: rid.get(r)! })) } } });
  }
  const g1 = await prisma.user.findUniqueOrThrow({ where: { email: 'gerencia@cim.local' } });
  const g2 = await prisma.user.findUniqueOrThrow({ where: { email: 'gerencia2@cim.local' } });
  const oe = await prisma.user.findUniqueOrThrow({ where: { email: 'oe@cim.local' } });
  if (!(await prisma.escalationMatrixEntry.count())) {
    await prisma.escalationMatrixEntry.createMany({ data: [
      { level: 'GERENCIA', primaryUserId: g1.id, substituteUserId: g2.id, ackTimeoutMinutes: 10 },
      { level: 'OPERACIONES_ESTRATEGICAS', primaryUserId: oe.id, substituteUserId: g1.id, ackTimeoutMinutes: 10 },
    ] });
  }

  if (DEMO) await seedDemo();
  console.log(`Semilla completada${DEMO ? ' (con datos de DEMOSTRACIÓN etiquetados)' : ''}.`);
}

async function seedDemo() {
  if (await prisma.unit.count({ where: { dataSource: 'DEMO' } })) return;
  const nld = await prisma.base.create({ data: { code: 'DEMO-NLD', name: '[DEMO] Base Nuevo Laredo', city: 'Nuevo Laredo', state: 'Tamaulipas' } });
  const mty = await prisma.base.create({ data: { code: 'DEMO-MTY', name: '[DEMO] Base Monterrey', city: 'Monterrey', state: 'Nuevo León' } });
  const corr = await prisma.corridor.create({ data: { code: 'DEMO-NLD-MTY', name: '[DEMO] Corredor Nuevo Laredo – Monterrey', description: 'Corredor de ejemplo para demostración' } });
  const rLocal = await prisma.route.create({ data: { code: 'DEMO-R1', name: '[DEMO] Nuevo Laredo → Monterrey', origin: 'Nuevo Laredo', destination: 'Monterrey', corridorId: corr.id, beyondMonterrey: false } });
  const rFar = await prisma.route.create({ data: { code: 'DEMO-R2', name: '[DEMO] Nuevo Laredo → Destino foráneo (más allá de Monterrey)', origin: 'Nuevo Laredo', destination: 'Destino foráneo de ejemplo', corridorId: corr.id, beyondMonterrey: true } });
  const client = await prisma.client.create({ data: { name: '[DEMO] Cliente de ejemplo', canSeeOperator: false, canSeeApproxLocation: true } });
  const client2 = await prisma.client.create({ data: { name: '[DEMO] Cliente con operador visible', canSeeOperator: true, canSeeApproxLocation: false } });
  await prisma.safeHaven.create({ data: { name: '[DEMO] Patio Base Monterrey (ejemplo, no operativo)', state: 'Nuevo León', lat: 25.75, lng: -100.29, corridorId: corr.id, source: 'Dato de DEMOSTRACIÓN — reemplazar por punto verificado', validation: 'VALIDADO', validatedAt: new Date() } });

  // Posiciones DEMO aproximadas a lo largo del corredor (no representan unidades reales)
  const path: [number, number][] = [[27.45, -99.55], [27.2, -99.75], [26.93, -99.98], [26.5, -100.18], [26.2, -100.25], [25.95, -100.28], [25.72, -100.3], [27.48, -99.52], [25.68, -100.31], [26.7, -100.1], [27.0, -99.9], [25.8, -100.27]];
  const now = Date.now();
  const ages = [3, 8, 12, 25, 4, 70, 2, 5, 200, 6, 9, 1];
  const speeds = [78, 65, 0, 0, 82, 0, 0, 0, 0, 72, 0, 60];
  const statuses = ['EN_TRANSITO', 'EN_TRANSITO', 'DETENIDA', 'DETENIDA', 'EN_TRANSITO', 'EN_TRANSITO', 'RESGUARDADA', 'EN_PATIO', 'MANTENIMIENTO', 'EN_TRANSITO', 'DETENIDA', 'EN_TRANSITO'] as const;
  for (let i = 0; i < 12; i++) {
    const n = String(101 + i);
    const unit = await prisma.unit.create({ data: { economicNumber: `T-${n}`, plates: `DEMO${n}A`, brand: 'Demo', model: 'Tractocamión', year: 2020 + (i % 5), type: 'TRACTOCAMION', baseId: i % 2 ? mty.id : nld.id, opStatus: statuses[i], dataSource: 'DEMO', notes: 'Unidad de DEMOSTRACIÓN' } });
    const tank = await prisma.unit.create({ data: { economicNumber: `TQ-${n}`, plates: `DEMO${n}T`, type: 'TANQUE', baseId: unit.baseId, capacityLiters: 31000, dataSource: 'DEMO', opStatus: statuses[i] } });
    await prisma.unitCoupling.create({ data: { motorId: unit.id, trailerId: tank.id } });
    await prisma.gpsDevice.create({ data: { unitId: unit.id, provider: '[DEMO] Proveedor GPS', identifier: `DEMO-IMEI-${n}`, supportsImmobilizer: i % 3 === 0 } });
    const camLabels = ['Frontal', 'Cabina', 'Lateral'];
    for (let c = 0; c < (i % 4 === 0 ? 3 : 2); c++) {
      const status = i === 2 && c === 1 ? 'SIN_TRANSMISION' : i === 5 && c === 0 ? 'OBSTRUIDA' : 'FUNCIONANDO';
      const cam = await prisma.camera.create({ data: { unitId: unit.id, label: camLabels[c], channel: c + 1, status } });
      if (status !== 'FUNCIONANDO') {
        const op = await prisma.user.findUniqueOrThrow({ where: { email: 'monitorista1@cim.local' } });
        const f = await prisma.cameraFault.create({ data: { cameraId: cam.id, faultStatus: status, openedById: op.id, openedAt: new Date(now - 3 * 3600_000) } });
        await prisma.cameraFaultAction.create({ data: { faultId: f.id, action: 'FALLA_REGISTRADA', notes: '[DEMO] Falla de ejemplo', actorId: op.id } });
      }
    }
    if (i !== 11) {
      const [lat, lng] = path[i];
      await prisma.gpsPosition.create({ data: { unitId: unit.id, lat, lng, speedKph: speeds[i], ignition: speeds[i] > 0, recordedAt: new Date(now - ages[i] * 60000), source: 'DEMO', address: `[DEMO] Tramo ${i + 1}, Nuevo León` } });
    }
    const op = await prisma.operator.create({ data: { employeeNo: `DEMO-${n}`, fullName: `Operador Demo ${String(i + 1).padStart(2, '0')}`, phonePrimary: null, baseId: unit.baseId, dataSource: 'DEMO', authorizedNotes: 'Registro de DEMOSTRACIÓN (sin datos personales reales)' } });
    await prisma.operatorAssignment.create({ data: { operatorId: op.id, unitId: unit.id } });
    if (['EN_TRANSITO', 'DETENIDA'].includes(statuses[i])) {
      await prisma.trip.create({ data: { tripNumber: `DEMO-V${n}`, clientId: i % 3 === 0 ? client2.id : client.id, routeId: i % 2 ? rFar.id : rLocal.id, unitId: unit.id, operatorId: op.id, trailerIds: [`TQ-${n}`], product: 'Producto de ejemplo', origin: 'Nuevo Laredo', destination: i % 2 ? 'Destino foráneo de ejemplo' : 'Monterrey', status: 'EN_TRANSITO', startedAt: new Date(now - 4 * 3600_000) } });
    }
    if (statuses[i] === 'DETENIDA') {
      await prisma.stop.create({ data: { unitId: unit.id, startedAt: new Date(now - (i === 3 ? 95 : i === 10 ? 40 : 15) * 60000), reason: i === 10 ? 'DESCANSO_OBLIGATORIO' : 'DESCONOCIDO', operationType: 'TRANSITO', lat: path[i][0], lng: path[i][1], source: 'DEMO' } });
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
