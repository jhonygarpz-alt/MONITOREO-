let TZ = 'America/Monterrey';
export const setTimezone = (tz: string) => { TZ = tz; };
export const getTimezone = () => TZ;

const d = (v?: string | Date | null) => (v ? new Date(v) : null);
export function fmtDateTime(v?: string | Date | null) {
  const x = d(v); if (!x) return '—';
  return x.toLocaleString('es-MX', { timeZone: TZ, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}
export function fmtDate(v?: string | Date | null) {
  const x = d(v); if (!x) return '—';
  return x.toLocaleDateString('es-MX', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' });
}
export function fmtTime(v?: string | Date | null) {
  const x = d(v); if (!x) return '—';
  return x.toLocaleTimeString('es-MX', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
}
export function ago(v?: string | Date | null) {
  const x = d(v); if (!x) return '—';
  const m = Math.round((Date.now() - x.getTime()) / 60000);
  if (m < 1) return 'hace un momento';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h ${m % 60} min`;
  return `hace ${Math.floor(h / 24)} d`;
}
export const minutesLabel = (m?: number | null) => (m === null || m === undefined ? '—' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`);
export function greeting() {
  const h = Number(new Date().toLocaleString('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }));
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}
export const toLocalInput = (v: Date = new Date()) => {
  const x = new Date(v.getTime() - v.getTimezoneOffset() * 60000);
  return x.toISOString().slice(0, 16);
};
