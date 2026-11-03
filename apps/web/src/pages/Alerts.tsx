import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Check as CheckIcon, ArrowUpRight, FileWarning, XCircle } from 'lucide-react';
import { useApi, useAction, api } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, Empty, Field, Notice, PageHeader, Select, Spinner, StatusBadge, Tabs, Textarea } from '../components/ui';
import { SourceTag } from '../components/DataTag';
import { FormModal } from '../components/forms';
import { ago, fmtDateTime } from '../lib/format';
import { ALERT_TYPES } from '../lib/labels';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function AlertsPage() {
  const { can } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<'open' | 'CRITICA' | 'all'>('open');
  const [modal, setModal] = useState<{ kind: 'new' | 'resolve' | 'escalate'; a?: any } | null>(null);
  const url = tab === 'all' ? '/alerts?status=all' : tab === 'CRITICA' ? '/alerts?severity=CRITICA' : '/alerts';
  const { data, isLoading } = useApi<any[]>(['alerts', tab], url, { refetchInterval: 20000 });
  const fleet = useApi<any[]>(['fleet', null], modal?.kind === 'new' ? '/units/fleet' : null);
  const inv = [['alerts'], ['home']];
  const ack = useAction((id: string) => api.post(`/alerts/${id}/ack`), { invalidate: inv, success: 'Alerta en atención' });
  const convert = useAction((id: string) => api.post<{ id: string }>(`/alerts/${id}/convert`), { invalidate: inv, success: 'Incidencia abierta', onSuccess: (r) => nav(`/incidencias/${r.id}`) });
  const resolve = useAction((v: any) => api.post(`/alerts/${v.id}/resolve`, v), { invalidate: inv, success: 'Alerta cerrada con justificación' });
  const escalate = useAction((v: any) => api.post(`/alerts/${v.id}/escalate`, v), { invalidate: inv, success: (r: any) => `Escalada a Gerencia (${r.recipients} destinatarios notificados en la aplicación)` });
  const create = useAction((v: any) => api.post('/alerts', v), { invalidate: inv, success: 'Alerta registrada' });
  return (
    <>
      <PageHeader title="Alertas" subtitle="Bandeja única ordenada por criticidad" actions={can('alerts.manage') && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setModal({ kind: 'new' })}>Registrar alerta</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'open', label: 'Por atender' }, { value: 'CRITICA', label: 'Críticas' }, { value: 'all', label: 'Todas' }]} />
      {isLoading ? <Spinner /> : !data?.length ? <Card><Empty title="Sin alertas" /></Card> : (
        <div className="space-y-2">
          {data.map((a) => (
            <div key={a.id} className={`card flex flex-col gap-3 p-4 md:flex-row md:items-center ${a.severity === 'CRITICA' && ['NUEVA', 'EN_ATENCION', 'ESCALADA'].includes(a.status) ? 'border-l-4 border-l-red-500' : ''}`}>
              <div className="flex flex-1 items-start gap-3">
                <StatusBadge value={a.severity} />
                <div className="min-w-0">
                  <p className="font-semibold">{a.title}</p>
                  <p className="text-sm text-ink-500">{ALERT_TYPES[a.type] ?? a.type} · {fmtDateTime(a.detectedAt)} ({ago(a.detectedAt)}){a.unit && ` · ${a.unit.economicNumber}`}</p>
                  {a.description && <p className="mt-1 text-sm text-ink-600">{a.description}</p>}
                  {a.resolution && <p className="mt-1 text-sm text-ink-500">Resolución: {a.resolution}</p>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SourceTag source={a.source} /><StatusBadge value={a.status} />
                {a.incident && <Badge tone="blue">{a.incident.folio}</Badge>}
                {can('alerts.manage') && ['NUEVA', 'ESCALADA'].includes(a.status) && <Button size="sm" variant="secondary" icon={<CheckIcon className="h-4 w-4" />} onClick={() => ack.mutate(a.id)}>Atender</Button>}
                {can('incidents.manage') && !a.incident && ['NUEVA', 'EN_ATENCION', 'ESCALADA'].includes(a.status) && <Button size="sm" icon={<FileWarning className="h-4 w-4" />} onClick={() => convert.mutate(a.id)}>Abrir incidencia</Button>}
                {can('incidents.escalate') && ['NUEVA', 'EN_ATENCION'].includes(a.status) && <Button size="sm" variant="warning" icon={<ArrowUpRight className="h-4 w-4" />} onClick={() => setModal({ kind: 'escalate', a })}>Escalar</Button>}
                {can('alerts.manage') && ['NUEVA', 'EN_ATENCION', 'ESCALADA'].includes(a.status) && (a.severity !== 'CRITICA' || can('incidents.close.approve')) && <Button size="sm" variant="ghost" icon={<XCircle className="h-4 w-4" />} onClick={() => setModal({ kind: 'resolve', a })}>Cerrar</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
      <FormModal open={modal?.kind === 'new'} onClose={() => setModal(null)} title="Registrar alerta" initial={{ type: 'PARADA_SOSPECHOSA', unitId: '', description: '' }} onSubmit={(v) => create.mutateAsync({ ...v, unitId: v.unitId || null })}>
        {(v, set) => <><Field label="Tipo"><Select value={v.type} onChange={(e) => set({ type: e.target.value })} options={ALERT_TYPES} /></Field><Field label="Unidad"><Select value={v.unitId} onChange={(e) => set({ unitId: e.target.value })} placeholder="Sin unidad" options={(fleet.data ?? []).map((u) => ({ value: u.id, label: u.economicNumber }))} /></Field><Field label="Descripción"><Textarea value={v.description} onChange={(e) => set({ description: e.target.value })} /></Field></>}
      </FormModal>
      <FormModal open={modal?.kind === 'resolve'} onClose={() => setModal(null)} title="Cerrar alerta" initial={{ outcome: 'RESUELTA', resolution: '' }} onSubmit={(v) => resolve.mutateAsync({ id: modal!.a.id, ...v })}>
        {(v, set) => <><Notice tone="amber">Solo cierre la alerta si comprobó la situación. No indique que la unidad está segura sin evidencia.</Notice><Field label="Resultado"><Select value={v.outcome} onChange={(e) => set({ outcome: e.target.value })} options={{ RESUELTA: 'Resuelta (verificada)', DESCARTADA: 'Descartada (falsa alarma comprobada)' }} /></Field><Field label="Verificación realizada" hint="Mínimo 15 caracteres"><Textarea value={v.resolution} onChange={(e) => set({ resolution: e.target.value })} /></Field></>}
      </FormModal>
      <FormModal open={modal?.kind === 'escalate'} onClose={() => setModal(null)} title="Escalar a Gerencia" initial={{ reason: '' }} onSubmit={(v) => escalate.mutateAsync({ id: modal!.a.id, ...v })} submitLabel="Escalar">
        {(v, set) => <Field label="Motivo y hallazgos"><Textarea value={v.reason} onChange={(e) => set({ reason: e.target.value })} /></Field>}
      </FormModal>
    </>
  );
}
