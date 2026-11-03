import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useApi, useAction, api } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import { Button, Card, Field, Input, Notice, PageHeader, Select, Spinner, StatusBadge, Table, Tabs, Textarea } from '../components/ui';
import { FormModal } from '../components/forms';
import { fmtDateTime } from '../lib/format';
import { ALERT_TYPES } from '../lib/labels';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function IncidentsPage() {
  const { can } = useAuth();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [tab, setTab] = useState(sp.get('status') ?? 'open');
  const [q, setQ] = useState('');
  const [create, setCreate] = useState(sp.get('nueva') === '1');
  useEffect(() => { if (sp.get('nueva')) setCreate(true); }, [sp]);
  const { data, isLoading } = useApi<any[]>(['incidents', tab, q], `/incidents?status=${tab}${q ? `&q=${encodeURIComponent(q)}` : ''}`, { refetchInterval: 30000 });
  const fleet = useApi<any[]>(['fleet', null], create ? '/units/fleet' : null);
  const save = useAction((v: any) => api.post<{ id: string }>('/incidents', v), { invalidate: [['incidents']], success: 'Incidencia abierta', onSuccess: (r) => setTimeout(() => nav(`/incidencias/${r.id}`), 0) });
  return (
    <>
      <PageHeader title="Incidencias" subtitle="Expedientes con historial cronológico inalterable" actions={can('incidents.manage') && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreate(true)}>Reportar incidencia</Button>} />
      <div className="mb-4 flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><Input className="pl-9" placeholder="Folio, título o número económico" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'open', label: 'Abiertas' }, { value: 'PENDIENTE_CIERRE', label: 'Pendientes de cierre' }, { value: 'CERRADA', label: 'Cerradas' }, { value: 'all', label: 'Todas' }]} />
      {isLoading ? <Spinner /> : (
        <Card padded={false}>
          <Table head={['Folio', 'Tipo', 'Unidad', 'Prioridad', 'Estado', 'Responsable', 'Apertura']} empty={!data?.length}>
            {data?.map((i) => (
              <tr key={i.id} className="cursor-pointer hover:bg-ink-50" onClick={() => nav(`/incidencias/${i.id}`)}>
                <td><Link to={`/incidencias/${i.id}`} className="font-semibold text-brand-700">{i.folio}</Link><p className="text-xs text-ink-500">{i.title}</p></td>
                <td>{ALERT_TYPES[i.type]}</td><td>{i.unit?.economicNumber ?? '—'}</td><td><StatusBadge value={i.priority} /></td><td><StatusBadge value={i.status} /></td><td>{i.responsible.fullName}</td><td>{fmtDateTime(i.openedAt)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
      <FormModal open={create} onClose={() => { setCreate(false); setSp({}); }} title="Reportar incidencia" initial={{ type: 'PARADA_SOSPECHOSA', priority: 'ALTA', unitId: sp.get('unitId') ?? '', title: '', description: '' }} onSubmit={(v) => save.mutateAsync({ ...v, unitId: v.unitId || null, title: v.title || ALERT_TYPES[v.type] })} submitLabel="Abrir incidencia">
        {(v, set) => <>
          <Field label="Tipo de evento"><Select value={v.type} onChange={(e) => { const t = e.target.value; set({ type: t, priority: ['POSIBLE_ROBO', 'ACCIDENTE', 'FUGA', 'DERRAME', 'INCENDIO', 'EMERGENCIA_OPERADOR'].includes(t) ? 'CRITICA' : v.priority }); }} options={ALERT_TYPES} /></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Unidad"><Select value={v.unitId} onChange={(e) => set({ unitId: e.target.value })} placeholder="Sin unidad" options={(fleet.data ?? []).map((u) => ({ value: u.id, label: u.economicNumber }))} /></Field><Field label="Prioridad"><Select value={v.priority} onChange={(e) => set({ priority: e.target.value })} options={{ CRITICA: 'Crítica', ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja' }} /></Field></div>
          <Field label="Título breve"><Input value={v.title} onChange={(e) => set({ title: e.target.value })} placeholder={ALERT_TYPES[v.type]} /></Field>
          <Field label="Descripción"><Textarea value={v.description} onChange={(e) => set({ description: e.target.value })} /></Field>
          {v.priority === 'CRITICA' && <Notice tone="red">Las incidencias críticas se escalan de inmediato a Gerencia. Si hay riesgo para personas, llame al 911 sin esperar.</Notice>}
        </>}
      </FormModal>
    </>
  );
}
