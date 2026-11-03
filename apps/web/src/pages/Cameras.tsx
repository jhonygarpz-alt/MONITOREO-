import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Video, VideoOff } from 'lucide-react';
import { useApi, useAction, api } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, Check, Empty, Field, PageHeader, Progress, Spinner, Stat, StatusBadge, Table, Tabs, Textarea } from '../components/ui';
import { FormModal } from '../components/forms';
import { ago, fmtDateTime, minutesLabel } from '../lib/format';
import { label } from '../lib/labels';

/* eslint-disable @typescript-eslint/no-explicit-any */
const ACTIONS = { NOTIFICAR_OPERADOR: 'Notificar al operador', SOLICITAR_REVISION: 'Solicitar revisión (vehículo detenido)', SEGUIMIENTO: 'Registrar seguimiento', CONFIRMAR_RECUPERACION: 'Confirmar recuperación', ESCALAR_GERENCIA: 'Escalar a Gerencia' };
const STEPS = ['ABIERTA', 'OPERADOR_NOTIFICADO', 'REVISION_SOLICITADA', 'EN_SEGUIMIENTO', 'RECUPERADA'];

export function CamerasPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<'faults' | 'availability' | 'all' | 'history'>('faults');
  const [act, setAct] = useState<{ fault: any; action: string } | null>(null);
  const faults = useApi<any[]>(['cam-faults'], '/cameras/faults', { refetchInterval: 30000 });
  const hist = useApi<any[]>(['cam-faults-all'], tab === 'history' ? '/cameras/faults?open=false' : null);
  const av = useApi<any>(['cam-av'], '/cameras/availability');
  const cams = useApi<any[]>(['cams'], tab === 'all' ? '/cameras' : null);
  const run = useAction((v: any) => api.post(`/cameras/faults/${v.id}/actions`, v), { invalidate: [['cam-faults'], ['cam-av'], ['cams']], success: 'Acción registrada' });
  return (
    <>
      <PageHeader title="Control de cámaras" subtitle="Fallas, seguimiento y disponibilidad por unidad" />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Disponibilidad (7 días)" value={av.data?.availabilityPct === null || !av.data ? 'Sin datos' : `${av.data.availabilityPct}%`} icon={<Video className="h-5 w-5" />} tone="green" />
        <Stat label="Fallas abiertas" value={faults.data?.length ?? '—'} icon={<VideoOff className="h-5 w-5" />} tone={faults.data?.length ? 'amber' : 'green'} />
        <Stat label="Tiempo medio de recuperación" value={av.data?.mttrMinutes == null ? 'Sin datos' : minutesLabel(av.data.mttrMinutes)} />
        <Stat label="Cámaras registradas" value={av.data?.cameras ?? '—'} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'faults', label: 'Fallas abiertas', count: faults.data?.length }, { value: 'availability', label: 'Disponibilidad por unidad' }, { value: 'all', label: 'Todas las cámaras' }, { value: 'history', label: 'Bitácora histórica' }]} />
      {tab === 'faults' && (faults.isLoading ? <Spinner /> : !faults.data?.length ? <Card><Empty title="Sin fallas abiertas" /></Card> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {faults.data.map((f) => (
            <div key={f.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div><Link to={`/flota/${f.camera.unit.id}`} className="text-lg font-bold">{f.camera.unit.economicNumber}</Link><p className="text-sm text-ink-500">Cámara {f.camera.label} · {label(f.faultStatus)} · abierta {ago(f.openedAt)}</p></div>
                <StatusBadge value={f.status} />
              </div>
              <div className="mt-3 flex gap-1">{STEPS.map((s) => <div key={s} className={`h-1.5 flex-1 rounded-full ${STEPS.indexOf(s) <= STEPS.indexOf(f.status === 'ESCALADA' ? 'EN_SEGUIMIENTO' : f.status) ? 'bg-brand-500' : 'bg-ink-200'}`} />)}</div>
              <ul className="mt-3 space-y-1 text-xs text-ink-600">{f.actions.slice(-3).map((a: any) => <li key={a.id}>{fmtDateTime(a.at)} · {ACTIONS[a.action as keyof typeof ACTIONS] ?? label(a.action)} {a.notes && `— ${a.notes}`}</li>)}</ul>
              {can('cameras.manage') && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {!f.operatorNotifiedAt && <Button size="sm" variant="secondary" onClick={() => setAct({ fault: f, action: 'NOTIFICAR_OPERADOR' })}>Notificar operador</Button>}
                  {!f.reviewRequestedAt && <Button size="sm" variant="secondary" onClick={() => setAct({ fault: f, action: 'SOLICITAR_REVISION' })}>Solicitar revisión</Button>}
                  <Button size="sm" variant="secondary" onClick={() => setAct({ fault: f, action: 'SEGUIMIENTO' })}>Seguimiento</Button>
                  <Button size="sm" onClick={() => setAct({ fault: f, action: 'CONFIRMAR_RECUPERACION' })}>Confirmar recuperación</Button>
                  {f.status !== 'ESCALADA' && <Button size="sm" variant="warning" onClick={() => setAct({ fault: f, action: 'ESCALAR_GERENCIA' })}>Escalar</Button>}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
      {tab === 'availability' && <Card padded={false}><Table head={['Unidad', 'Cámaras', 'Disponibilidad']} empty={!av.data?.byUnit?.length}>{av.data?.byUnit.map((u: any) => <tr key={u.unitId}><td className="font-medium">{u.economicNumber}</td><td>{u.cameras}</td><td className="w-1/2"><div className="flex items-center gap-3"><Progress value={u.availabilityPct} tone={u.availabilityPct >= 95 ? 'green' : u.availabilityPct >= 85 ? 'amber' : 'red'} /><span className="w-14 text-right tabular-nums">{u.availabilityPct}%</span></div></td></tr>)}</Table></Card>}
      {tab === 'all' && <Card padded={false}><Table head={['Unidad', 'Cámara', 'Estado', 'Actualizado']} empty={!cams.data?.length}>{cams.data?.map((c) => <tr key={c.id}><td className="font-medium">{c.unit.economicNumber}</td><td>{c.label}</td><td><StatusBadge value={c.status} /></td><td>{fmtDateTime(c.statusAt)}</td></tr>)}</Table></Card>}
      {tab === 'history' && <Card padded={false}><Table head={['Unidad', 'Cámara', 'Falla', 'Apertura', 'Recuperación', 'Duración']} empty={!hist.data?.length}>{hist.data?.map((f) => <tr key={f.id}><td>{f.camera.unit.economicNumber}</td><td>{f.camera.label}</td><td>{label(f.faultStatus)}</td><td>{fmtDateTime(f.openedAt)}</td><td>{f.recoveredAt ? fmtDateTime(f.recoveredAt) : <Badge tone="amber">Abierta</Badge>}</td><td>{f.recoveredAt ? minutesLabel(Math.round((+new Date(f.recoveredAt) - +new Date(f.openedAt)) / 60000)) : '—'}</td></tr>)}</Table></Card>}
      {act && (
        <FormModal key={act.fault.id + act.action} open onClose={() => setAct(null)} title={ACTIONS[act.action as keyof typeof ACTIONS]} initial={{ notes: '', safe: false, stopped: false, viewed: false }} onSubmit={(v) => run.mutateAsync({ id: act.fault.id, action: act.action, notes: v.notes, safeToContact: v.safe, vehicleStopped: v.stopped, imageViewed: v.viewed })}>
          {(v, set) => <>
            {act.action === 'NOTIFICAR_OPERADOR' && <Check checked={v.safe} onChange={(b) => set({ safe: b })} label="Es seguro contactar al operador en este momento" hint="No distraiga al operador mientras conduce en tramos de riesgo" />}
            {act.action === 'SOLICITAR_REVISION' && <Check checked={v.stopped} onChange={(b) => set({ stopped: b })} label="Confirmo que el vehículo está detenido en un lugar seguro" hint="El sistema valida además la última velocidad registrada" />}
            {act.action === 'CONFIRMAR_RECUPERACION' && <Check checked={v.viewed} onChange={(b) => set({ viewed: b })} label="Vi la imagen restablecida" />}
            <Field label="Detalle"><Textarea value={v.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
          </>}
        </FormModal>
      )}
    </>
  );
}
