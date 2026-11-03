import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, Video, PauseCircle, User } from 'lucide-react';
import { useApi, useAction, api } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, Empty, Field, Input, PageHeader, Select, Spinner, StatusBadge, Tabs } from '../components/ui';
import { Freshness, SourceTag } from '../components/DataTag';
import { FormModal } from '../components/forms';
import { label, STOP_REASONS } from '../lib/labels';
import { minutesLabel } from '../lib/format';

interface FU { id: string; economicNumber: string; plates: string; type: string; opStatus: string; base: string | null; freshness: string; minutesSincePosition: number | null; dataSource: string; operator: { fullName: string } | null; position: { recordedAt: string; source: string; speedKph: number | null } | null; camerasWithFault: number; cameras: unknown[]; activeStop: { minutes: number; reason: string } | null; trailers: string[] }

export function FleetPage() {
  const { can } = useAuth();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [f, setF] = useState<'all' | 'attention' | 'EN_TRANSITO' | 'DETENIDA' | 'RESGUARDADA' | 'MANTENIMIENTO'>('all');
  const [create, setCreate] = useState(false);
  const { data, isLoading } = useApi<FU[]>(['fleet', sp.get('q')], `/units/fleet${sp.get('q') ? `?q=${encodeURIComponent(sp.get('q')!)}` : ''}`, { refetchInterval: 30000 });
  const bases = useApi<{ id: string; name: string }[]>(['bases'], can('units.manage') ? '/catalogs/bases' : null);
  const save = useAction((v: Record<string, unknown>) => api.post('/units', v), { invalidate: [['fleet']], success: 'Unidad registrada' });
  const rows = (data ?? []).filter((u) => f === 'all' || (f === 'attention' ? u.freshness !== 'ACTUALIZADA' || u.camerasWithFault || u.activeStop : u.opStatus === f));
  return (
    <>
      <PageHeader title="Flota" subtitle="Estado de unidades motrices con la calidad de cada dato" actions={can('units.manage') && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreate(true)}>Nueva unidad</Button>} />
      <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); setSp(q ? { q } : {}); }}>
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><Input className="pl-9" placeholder="Número económico, placas u operador" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Button type="submit" variant="secondary">Buscar</Button>
      </form>
      <Tabs value={f} onChange={setF} tabs={[{ value: 'all', label: 'Todas' }, { value: 'attention', label: 'Requieren atención' }, { value: 'EN_TRANSITO', label: 'En tránsito' }, { value: 'DETENIDA', label: 'Detenidas' }, { value: 'RESGUARDADA', label: 'Resguardadas' }, { value: 'MANTENIMIENTO', label: 'Mantenimiento' }]} />
      {isLoading ? <Spinner /> : !rows.length ? <Card><Empty title="Sin unidades" /></Card> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {rows.map((u) => (
            <Link to={`/flota/${u.id}`} key={u.id} className="card p-4 transition hover:shadow-pop">
              <div className="flex items-start justify-between"><div><p className="text-lg font-bold">{u.economicNumber}</p><p className="text-xs text-ink-500">{u.plates} · {u.base ?? 'Sin base'}</p></div><StatusBadge value={u.opStatus} /></div>
              <div className="mt-3 flex flex-wrap gap-1.5"><Freshness value={u.freshness} at={u.position?.recordedAt} /><SourceTag source={u.position?.source ?? u.dataSource} /></div>
              <div className="mt-3 space-y-1 text-sm text-ink-600">
                <p className="flex items-center gap-1.5"><User className="h-4 w-4 text-ink-400" />{u.operator?.fullName ?? 'Sin operador'}</p>
                <p className="flex items-center gap-1.5"><Video className="h-4 w-4 text-ink-400" />{u.cameras.length} cámaras{u.camerasWithFault > 0 && <Badge tone="amber">{u.camerasWithFault} con falla</Badge>}</p>
                {u.activeStop && <p className="flex items-center gap-1.5 text-amber-700"><PauseCircle className="h-4 w-4" />Detenida {minutesLabel(u.activeStop.minutes)} · {STOP_REASONS[u.activeStop.reason]}</p>}
                {u.trailers.length > 0 && <p className="text-xs text-ink-500">Acoplados: {u.trailers.join(', ')}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
      <FormModal open={create} onClose={() => setCreate(false)} title="Registrar unidad" initial={{ economicNumber: '', plates: '', type: 'TRACTOCAMION', brand: '', model: '', year: '', vin: '', baseId: '', opStatus: 'EN_PATIO' }}
        onSubmit={(v) => save.mutateAsync({ ...v, year: v.year ? Number(v.year) : null, vin: v.vin || null, baseId: v.baseId || null, brand: v.brand || null, model: v.model || null })}>
        {(v, set) => <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Número económico"><Input value={v.economicNumber} onChange={(e) => set({ economicNumber: e.target.value })} /></Field>
          <Field label="Placas"><Input value={v.plates} onChange={(e) => set({ plates: e.target.value })} /></Field>
          <Field label="Tipo"><Select value={v.type} onChange={(e) => set({ type: e.target.value })} options={['TRACTOCAMION', 'AUTOTANQUE', 'REMOLQUE', 'TANQUE', 'DOLLY'].map((x) => ({ value: x, label: label(x) }))} /></Field>
          <Field label="Base"><Select value={v.baseId} onChange={(e) => set({ baseId: e.target.value })} options={(bases.data ?? []).map((b) => ({ value: b.id, label: b.name }))} placeholder="Sin base" /></Field>
          <Field label="Marca"><Input value={v.brand} onChange={(e) => set({ brand: e.target.value })} /></Field>
          <Field label="Modelo"><Input value={v.model} onChange={(e) => set({ model: e.target.value })} /></Field>
          <Field label="Año"><Input type="number" value={v.year} onChange={(e) => set({ year: e.target.value })} /></Field>
          <Field label="Número de serie (VIN)" hint="17 caracteres"><Input value={v.vin} onChange={(e) => set({ vin: e.target.value })} /></Field>
        </div>}
      </FormModal>
    </>
  );
}
