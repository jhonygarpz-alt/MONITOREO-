import { Badge } from './ui';
import { label } from '../lib/labels';
import { ago } from '../lib/format';

/** Indicador de calidad del dato: distingue actualizado / atrasado / no disponible y su origen (nunca "en vivo" si no lo es). */
export function Freshness({ value, at }: { value: string; at?: string | null }) {
  const t = value === 'ACTUALIZADA' ? 'green' : value === 'ATRASADA' ? 'amber' : 'red';
  return <Badge tone={t}>{label(value)}{at ? ` · ${ago(at)}` : ''}</Badge>;
}
export function SourceTag({ source }: { source?: string | null }) {
  if (!source) return null;
  if (source === 'DEMO') return <Badge tone="blue">DEMO</Badge>;
  if (source === 'MANUAL') return <Badge tone="gray">Manual</Badge>;
  return <Badge tone="green">Integración</Badge>;
}
