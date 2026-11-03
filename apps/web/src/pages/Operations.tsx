import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, MessageSquare, BellRing, Flag, ShieldAlert } from 'lucide-react';
import { useApi, useAction, api } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, Check, Dot, Empty, Field, Input, Notice, PageHeader, Select, Spinner, Table, Tabs, Textarea } from '../components/ui';
import { FormModal } from '../components/forms';
import { fmtDateTime, minutesLabel } from '../lib/format';
import { label, PROTECTED_REASONS, STOP_REASONS, tone } from '../lib/labels';

/* eslint-disable @typescript-eslint/no-explicit-any */
const OPTYPES = { TRANSITO: 'Tránsito', CARGA: 'Carga', DESCARGA: 'Descarga', RESGUARDO: 'Resguardo', PATIO: 'Patio', MANTENIMIENTO: 'Mantenimiento' };

export function OperationsPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<'active' | 'closed' | 'events' | 'thresholds'>('active');
  const [modal, setModal] = useState<{ kind: 'new' | 'follow' | 'remind' | 'end' | 'edit'; stop?: any } | null>(null);
  const stops = useApi<any[]>(['stops'], '/ops/stops', { refetchInterval: 30000 });
  const closed = useApi<any[]>(['stops-closed'], tab === 'closed' ? '/ops/stops?active=false' : null);
  const events = useApi<any[]>(['ops-events'], tab === 'events' ? '/alerts?status=all&type=DESVIACION_RUTA,EXCESO_VELOCIDAD,INCUMPLIMIENTO_OPERATIVO,TIEMPO_MUERTO,PARADA_SOSPECHOSA,INCUMPLIMIENTO_RESGUARDO' : null);
  const th = useApi<any[]>(['thresholds'], '/ops/thresholds');
  const fleet = useApi<any[]>(['fleet', null], modal?.kind === 'new' ? '/units/fleet' : null);
  const inv = [['stops'], ['fleet'], ['home']];
  const create = useAction((v: any) => api.post('/ops/stops', v), { invalidate: inv, success: 'Detención registrada' });
  const follow = useAction((v: any) => api.post(`/ops/stops/${v.id}/followups`, { notes: v.notes }), { invalidate: inv, success: 'Seguimiento registrado' });
  const patch = useAction((v: any) => api.patch(`/ops/stops/${v.id}`, { reason: v.reason, authorized: v.authorized === 'true', notes: v.notes }), { invalidate: inv, success: 'Motivo actualizado' });
  const remind = useAction((v: any) => api.post(`/ops/stops/${v.id}/reminders`, v), { invalidate: inv, success: (r: any) => (r.confirmed ? 'Recordatorio registrado con confirmación del operador' : 'Recordatorio registrado (sin confirmación del operador)') });
  const end = useAction((v: any) => api.post(`/ops/stops/${v.id}/end`, v), { invalidate: inv, success: 'Detención finalizada' });
  const thMap = Object.fromEntries((th.data ?? []).map((t) => [t.operationType, t]));

  return (
    <>
      <PageHeader title="Seguimiento operativo" subtitle="Detenciones, tiempos muertos y cumplimiento operativo" actions={can('ops.manage') && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setModal({ kind: 'new' })}>Registrar detención</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'active', label: 'Detenciones activas', count: stops.data?.length }, { value: 'events', label: 'Eventos operativos' }, { value: 'closed', label: 'Historial' }, { value: 'thresholds', label: 'Umbrales' }]} />
      {tab === 'active' && (stops.isLoading ? <Spinner /> : !stops.data?.length ? <Card><Empty title="No hay unidades detenidas registradas" /></Card> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {stops.data.map((s) => {
            const t = s.threshold;
            return (
              <div key={s.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3"><Dot tone={tone(s.level)} /><div><Link to={`/flota/${s.unitId}`} className="text-lg font-bold">{s.unit.economicNumber}</Link><p className="text-xs text-ink-500">{OPTYPES[s.operationType as keyof typeof OPTYPES]} · desde {fmtDateTime(s.startedAt)}</p></div></div>
                  <div className="text-right"><p className="text-2xl font-bold tabular-nums">{minutesLabel(s.minutes)}</p><Badge tone={tone(s.level)}>{label(s.level)}</Badge></div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone={s.protected ? 'blue' : s.reason === 'NO_AUTORIZADA' ? 'red' : 'gray'}>{STOP_REASONS[s.reason]}</Badge>
                  {s.authorized && <Badge tone="green">Autorizada</Badge>}
                  {t && <span className="text-xs text-ink-500">Umbral: aviso {t.warnMinutes} · máx {t.maxMinutes} · escalar {t.escalateMinutes} min</span>}
                </div>
                {s.protected && <p className="mt-2 flex items-center gap-1.5 text-xs text-sky-800"><ShieldAlert className="h-4 w-4" />Detención protegida: no se solicitará reanudar la marcha.</p>}
                {s.followUps?.[0] && <p className="mt-2 rounded-lg bg-ink-50 p-2 text-xs text-ink-600">Último seguimiento: {s.followUps[0].notes}</p>}
                {can('ops.manage') && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" icon={<MessageSquare className="h-4 w-4" />} onClick={() => setModal({ kind: 'follow', stop: s })}>Seguimiento</Button>
                    <Button size="sm" variant="secondary" onClick={() => setModal({ kind: 'edit', stop: s })}>Motivo</Button>
                    {s.reminderAllowed && <Button size="sm" variant="secondary" icon={<BellRing className="h-4 w-4" />} onClick={() => setModal({ kind: 'remind', stop: s })}>Recordatorio</Button>}
                    <Button size="sm" variant="ghost" icon={<Flag className="h-4 w-4" />} onClick={() => setModal({ kind: 'end', stop: s })}>Finalizar</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
      {tab === 'events' && <Card padded={false}><Table head={['Fecha', 'Unidad', 'Evento', 'Severidad', 'Estado']} empty={!events.data?.length}>{events.data?.map((a) => <tr key={a.id}><td>{fmtDateTime(a.detectedAt)}</td><td className="font-medium">{a.unit?.economicNumber ?? '—'}</td><td>{a.title}</td><td><Badge tone={tone(a.severity)}>{label(a.severity)}</Badge></td><td><Badge tone={tone(a.status)}>{label(a.status)}</Badge></td></tr>)}</Table></Card>}
      {tab === 'closed' && <Card padded={false}><Table head={['Unidad', 'Inicio', 'Fin', 'Motivo']} empty={!closed.data?.length}>{closed.data?.map((s) => <tr key={s.id}><td className="font-medium">{s.unit.economicNumber}</td><td>{fmtDateTime(s.startedAt)}</td><td>{fmtDateTime(s.endedAt)}</td><td>{STOP_REASONS[s.reason]}</td></tr>)}</Table></Card>}
      {tab === 'thresholds' && <Card title="Umbrales por tipo de operación" subtitle="Los cambios se solicitan en Configuración y requieren autorización" padded={false}><Table head={['Operación', 'Advertencia', 'Máximo', 'Escalamiento']}>{(th.data ?? []).map((t) => <tr key={t.id}><td className="font-medium">{OPTYPES[t.operationType as keyof typeof OPTYPES]}</td><td>{t.warnMinutes} min</td><td>{t.maxMinutes} min</td><td>{t.escalateMinutes} min</td></tr>)}</Table></Card>}

      <FormModal open={modal?.kind === 'new'} onClose={() => setModal(null)} title="Registrar detención" initial={{ unitId: '', operationType: 'TRANSITO', reason: 'DESCONOCIDO', locationText: '', notes: '' }} onSubmit={(v) => create.mutateAsync(v)}>
        {(v, set) => <>
          <Field label="Unidad"><Select value={v.unitId} onChange={(e) => set({ unitId: e.target.value })} placeholder="Seleccione…" options={(fleet.data ?? []).map((u) => ({ value: u.id, label: u.economicNumber }))} /></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Tipo de operación"><Select value={v.operationType} onChange={(e) => set({ operationType: e.target.value })} options={OPTYPES} /></Field><Field label="Motivo"><Select value={v.reason} onChange={(e) => set({ reason: e.target.value })} options={STOP_REASONS} /></Field></div>
          <Field label="Ubicación / referencia"><Input value={v.locationText} onChange={(e) => set({ locationText: e.target.value })} /></Field>
          <Field label="Notas"><Textarea value={v.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
        </>}
      </FormModal>
      {modal?.stop && <>
        <FormModal open={modal.kind === 'follow'} onClose={() => setModal(null)} title={`Seguimiento ${modal.stop.unit.economicNumber}`} initial={{ notes: '' }} onSubmit={(v) => follow.mutateAsync({ id: modal.stop.id, ...v })}>
          {(v, set) => <Field label="Seguimiento realizado"><Textarea value={v.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>}
        </FormModal>
        <FormModal open={modal.kind === 'edit'} onClose={() => setModal(null)} title="Actualizar motivo" initial={{ reason: modal.stop.reason, authorized: String(modal.stop.authorized), notes: '' }} onSubmit={(v) => patch.mutateAsync({ id: modal.stop.id, ...v })}>
          {(v, set) => <><Field label="Motivo"><Select value={v.reason} onChange={(e) => set({ reason: e.target.value })} options={STOP_REASONS} /></Field><Field label="¿Parada autorizada?"><Select value={v.authorized} onChange={(e) => set({ authorized: e.target.value })} options={{ false: 'No', true: 'Sí' }} /></Field><Field label="Cómo se confirmó"><Textarea value={v.notes} onChange={(e) => set({ notes: e.target.value })} /></Field></>}
        </FormModal>
        <FormModal open={modal.kind === 'remind'} onClose={() => setModal(null)} title="Recordatorio para continuar" initial={{ channel: 'LLAMADA', message: 'Favor de reanudar el trayecto cuando sea seguro hacerlo.', safe: false, operatorConfirmed: false }} onSubmit={(v) => remind.mutateAsync({ id: modal.stop.id, channel: v.channel, message: v.message, safeConditionsConfirmed: v.safe ? true : undefined, operatorConfirmed: v.operatorConfirmed })}>
          {(v, set) => <>
            {PROTECTED_REASONS.includes(modal.stop.reason) && <Notice tone="red">No permitido para esta detención.</Notice>}
            <Notice tone="amber">No solicite movimiento durante descansos obligatorios, fatiga, emergencias, fallas mecánicas o condiciones inseguras.</Notice>
            <Field label="Canal"><Select value={v.channel} onChange={(e) => set({ channel: e.target.value })} options={{ LLAMADA: 'Llamada', MENSAJE: 'Mensaje', RADIO: 'Radio', APP_GPS: 'Mensaje en plataforma GPS' }} /></Field>
            <Field label="Mensaje"><Textarea value={v.message} onChange={(e) => set({ message: e.target.value })} /></Field>
            <Check checked={v.safe} onChange={(b) => set({ safe: b })} label="Confirmo que es seguro y procedente solicitar la continuación" />
            <Check checked={v.operatorConfirmed} onChange={(b) => set({ operatorConfirmed: b })} label="El operador confirmó haber recibido el mensaje" hint="Déjelo sin marcar si no hubo confirmación" />
          </>}
        </FormModal>
        <FormModal open={modal.kind === 'end'} onClose={() => setModal(null)} title="Finalizar detención" initial={{ notes: '', newStatus: 'EN_TRANSITO' }} onSubmit={(v) => end.mutateAsync({ id: modal.stop.id, ...v })}>
          {(v, set) => <><Field label="Nuevo estado"><Select value={v.newStatus} onChange={(e) => set({ newStatus: e.target.value })} options={['EN_TRANSITO', 'RESGUARDADA', 'EN_PATIO', 'MANTENIMIENTO', 'EN_PENSION'].map((x) => ({ value: x, label: label(x) }))} /></Field><Field label="Cómo se verificó la reanudación"><Textarea value={v.notes} onChange={(e) => set({ notes: e.target.value })} /></Field></>}
        </FormModal>
      </>}
    </>
  );
}
