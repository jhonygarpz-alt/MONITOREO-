import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useApi, useAction, api } from '../lib/hooks';
import { Badge, Button, Card, Field, Input, PageHeader, Select, Table, Tabs, Textarea } from '../components/ui';
import { FormModal } from '../components/forms';

/* eslint-disable @typescript-eslint/no-explicit-any */
type K = 'bases' | 'clients' | 'corridors' | 'routes' | 'shifts';
const DEF: Record<K, { title: string; cols: [string, (r: any) => React.ReactNode][]; initial: Record<string, any> }> = {
  bases: { title: 'Bases operativas', cols: [['Código', (r) => r.code], ['Nombre', (r) => r.name], ['Ciudad', (r) => `${r.city}, ${r.state}`]], initial: { code: '', name: '', city: '', state: '' } },
  clients: { title: 'Clientes', cols: [['Nombre', (r) => r.name], ['Contacto', (r) => r.contactName ?? '—'], ['Ve operador', (r) => (r.canSeeOperator ? <Badge tone="green">Sí</Badge> : 'No')], ['Ve ubicación aprox.', (r) => (r.canSeeApproxLocation ? <Badge tone="green">Sí</Badge> : 'No')]], initial: { name: '', contactName: '', contactEmail: '', contactPhone: '', canSeeOperator: 'false', canSeeApproxLocation: 'false' } },
  corridors: { title: 'Corredores carreteros', cols: [['Código', (r) => r.code], ['Nombre', (r) => r.name], ['Descripción', (r) => r.description ?? '—']], initial: { code: '', name: '', description: '' } },
  routes: { title: 'Rutas', cols: [['Código', (r) => r.code], ['Nombre', (r) => r.name], ['Origen → destino', (r) => `${r.origin} → ${r.destination}`], ['Más allá de Monterrey', (r) => (r.beyondMonterrey ? <Badge tone="amber">Sí · resguardo nocturno</Badge> : 'No')]], initial: { code: '', name: '', origin: 'Nuevo Laredo', destination: '', corridorId: '', beyondMonterrey: 'false', distanceKm: '' } },
  shifts: { title: 'Turnos', cols: [['Nombre', (r) => r.name], ['Inicio', (r) => r.startTime], ['Fin', (r) => r.endTime]], initial: { name: '', startTime: '06:00', endTime: '14:00' } },
};

export function CatalogsPage() {
  const [tab, setTab] = useState<K>('bases');
  const [edit, setEdit] = useState<any>(null);
  const url = tab === 'shifts' ? '/admin/shifts' : `/catalogs/${tab}`;
  const { data } = useApi<any[]>([tab], url);
  const corridors = useApi<any[]>(['corridors'], '/catalogs/corridors');
  const save = useAction((v: any) => (v.id ? api.put(`${url}/${v.id}`, v.body) : api.post(url, v.body)), { invalidate: [[tab]], success: 'Catálogo actualizado' });
  const d = DEF[tab];
  const toBody = (v: any) => {
    const b: any = { ...v }; delete b.id;
    ['canSeeOperator', 'canSeeApproxLocation', 'beyondMonterrey'].forEach((k) => { if (k in b) b[k] = b[k] === 'true' || b[k] === true; });
    if ('distanceKm' in b) b.distanceKm = b.distanceKm ? Number(b.distanceKm) : null;
    if ('corridorId' in b) b.corridorId = b.corridorId || null;
    Object.keys(b).forEach((k) => { if (b[k] === '') b[k] = null; });
    ['contactEmail'].forEach((k) => { if (b[k] === null) delete b[k]; });
    return b;
  };
  return (
    <>
      <PageHeader title="Catálogos" subtitle="Información maestra de la operación" actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({ ...d.initial })}>Agregar</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={(Object.keys(DEF) as K[]).map((k) => ({ value: k, label: DEF[k].title }))} />
      <Card padded={false}><Table head={[...d.cols.map((c) => c[0]), '']} empty={!data?.length}>{data?.map((r) => <tr key={r.id}>{d.cols.map(([h, f]) => <td key={h}>{f(r)}</td>)}<td>{tab !== 'shifts' && <Button size="sm" variant="ghost" onClick={() => setEdit({ id: r.id, ...Object.fromEntries(Object.keys(d.initial).map((k) => [k, typeof r[k] === 'boolean' ? String(r[k]) : r[k] ?? ''])) })}>Editar</Button>}</td></tr>)}</Table></Card>
      {edit && <FormModal key={edit.id ?? 'new' + tab} open onClose={() => setEdit(null)} title={`${edit.id ? 'Editar' : 'Agregar'} · ${d.title}`} initial={edit} onSubmit={(v) => save.mutateAsync({ id: edit.id, body: toBody(v) })}>
        {(v, set) => <div className="grid gap-4 sm:grid-cols-2">{Object.keys(d.initial).map((k) => (
          <Field key={k} label={k}>
            {['canSeeOperator', 'canSeeApproxLocation', 'beyondMonterrey'].includes(k) ? <Select value={v[k]} onChange={(e) => set({ [k]: e.target.value })} options={{ false: 'No', true: 'Sí' }} />
              : k === 'corridorId' ? <Select value={v[k]} onChange={(e) => set({ [k]: e.target.value })} placeholder="—" options={(corridors.data ?? []).map((c) => ({ value: c.id, label: c.name }))} />
                : k === 'description' ? <Textarea value={v[k]} onChange={(e) => set({ [k]: e.target.value })} />
                  : <Input type={k.endsWith('Time') ? 'time' : 'text'} value={v[k]} onChange={(e) => set({ [k]: e.target.value })} />}
          </Field>
        ))}</div>}
      </FormModal>}
    </>
  );
}
