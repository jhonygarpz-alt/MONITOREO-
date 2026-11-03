import { prisma } from './prisma';

export const DEFAULT_SETTINGS: Record<string, { value: unknown; critical: boolean; description: string }> = {
  'system.timezone': { value: 'America/Monterrey', critical: true, description: 'Zona horaria de visualización y de cálculo de horarios locales' },
  'sweep.intervalMinutes': { value: 120, critical: true, description: 'Periodicidad de barridos de flota (minutos)' },
  'sweep.lockMinutes': { value: 10, critical: false, description: 'Minutos que una unidad queda reservada al abrir su revisión' },
  'gps.staleMinutes': { value: 15, critical: true, description: 'Antigüedad máxima para considerar una posición GPS como actualizada' },
  'gps.lostMinutes': { value: 60, critical: true, description: 'Minutos sin posición para considerar la unidad sin comunicación' },
  'speed.limitKph': { value: 80, critical: true, description: 'Velocidad máxima corporativa (km/h) para alertas de exceso' },
  'handover.ackTimeoutMinutes': { value: 30, critical: false, description: 'Minutos para confirmar recepción de turno antes de escalar a supervisión' },
  'incident.reminderMinutes': { value: 30, critical: false, description: 'Recordatorio de incidencias abiertas sin movimiento (minutos)' },
  'alerts.escalationMinutes': { value: { CRITICA: 5, ALTA: 15, MEDIA: 60, BAJA: 240 }, critical: true, description: 'Minutos sin atención antes de escalar automáticamente por severidad' },
  'docs.expiryWarnDays': { value: 30, critical: false, description: 'Días de anticipación para alertar vencimiento de documentos y pólizas' },
  'training.weekday': { value: 3, critical: false, description: 'Día de la sesión semanal (0=domingo, 3=miércoles)' },
  'training.time': { value: '17:00', critical: false, description: 'Hora local de la sesión semanal' },
  'training.timezone': { value: 'America/Mexico_City', critical: false, description: 'Zona horaria de la sesión (PENDIENTE DE CONFIRMAR: Centro o Pacífico)' },
  'training.timezoneConfirmed': { value: false, critical: false, description: 'Indica si la Gerencia confirmó la zona horaria de la sesión' },
  'operator.maxCallAttempts': { value: 3, critical: false, description: 'Llamadas consecutivas al operador antes de escalar (si no hay indicios de emergencia grave)' },
};

const cache = new Map<string, { v: unknown; t: number }>();

export async function getSetting<T = unknown>(key: string): Promise<T> {
  const c = cache.get(key);
  if (c && Date.now() - c.t < 5000) return c.v as T;
  const row = await prisma.setting.findUnique({ where: { key } });
  const v = (row?.value ?? DEFAULT_SETTINGS[key]?.value) as T;
  cache.set(key, { v, t: Date.now() });
  return v;
}
export function invalidateSettings() {
  cache.clear();
}
