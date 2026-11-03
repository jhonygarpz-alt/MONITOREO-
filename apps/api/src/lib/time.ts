/** Utilidades de zona horaria sin dependencias: todo se guarda en UTC y se calcula en hora local configurada. */

export function localParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, weekday: 'short',
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute, s: +p.second, weekday: wd };
}

/** Desfase (ms) entre hora local de la zona y UTC en un instante dado. */
function tzOffsetMs(date: Date, timeZone: string) {
  const p = localParts(date, timeZone);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Construye un instante UTC a partir de fecha/hora local en una zona. */
export function zonedToUtc(y: number, m: number, d: number, h: number, min: number, timeZone: string) {
  const guess = new Date(Date.UTC(y, m - 1, d, h, min));
  const off = tzOffsetMs(guess, timeZone);
  const result = new Date(guess.getTime() - off);
  const off2 = tzOffsetMs(result, timeZone);
  return off2 === off ? result : new Date(guess.getTime() - off2);
}

export function parseHHmm(s: string) {
  const [h, m] = s.split(':').map(Number);
  return { h, m };
}

/** Próxima ocurrencia (o la de hoy si aún no pasa) de una hora local HH:mm. */
export function nextLocalTime(now: Date, hhmm: string, timeZone: string) {
  const { h, m } = parseHHmm(hhmm);
  const p = localParts(now, timeZone);
  let t = zonedToUtc(p.y, p.m, p.d, h, m, timeZone);
  if (t.getTime() <= now.getTime() - 12 * 3600_000) t = new Date(t.getTime() + 24 * 3600_000);
  return t;
}

/** ¿El instante está dentro de la ventana local [start, end) que puede cruzar medianoche? */
export function inLocalWindow(now: Date, start: string, end: string, timeZone: string) {
  const p = localParts(now, timeZone);
  const cur = p.h * 60 + p.min;
  const s = parseHHmm(start); const e = parseHHmm(end);
  const a = s.h * 60 + s.m; const b = e.h * 60 + e.m;
  return a <= b ? cur >= a && cur < b : cur >= a || cur < b;
}

/** Minutos que faltan para la hora local HH:mm de hoy (negativo si ya pasó). */
export function minutesUntilLocal(now: Date, hhmm: string, timeZone: string) {
  const p = localParts(now, timeZone);
  const { h, m } = parseHHmm(hhmm);
  return h * 60 + m - (p.h * 60 + p.min);
}

export const minutesBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 60000);
