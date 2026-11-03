import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, CheckCircle2, Plus } from 'lucide-react';
import { useApi, useAction, api } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, Check, Empty, Field, Input, Notice, PageHeader, Select, Spinner, StatusBadge, Table, Tabs, Textarea } from '../components/ui';
import { FormModal } from '../components/forms';
import { fmtDateTime, fmtTime, minutesLabel } from '../lib/format';
import { label, STOP_REASONS } from '../lib/labels';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function HandoverPage() {
  const { can, me } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<'deliver' | 'history' | 'tasks'>('deliver');
  const [form, setForm] = useState({ incomingUserId: '', priorities: '', instructions: '', notes: '' });
  const [newTask, setNewTask] = useState(false);
  const preview = useApi<any>(['ho-preview'], can('handover.create') && tab === 'deliver' ? '/handovers/preview' : null);
  const list = useApi<any[]>(['handovers'], '/handovers');
  const users = useApi<any[]>(['users'], '/admin/users');
  const tasks = useApi<any[]>(['tasks'], '/tasks');
  const pendingForMe = useApi<any[]>(['ho-mine'], '/handovers/pending-for-me');
  const create = useAction((v: any) => api.post<any>('/handovers', v), { invalidate: [['handovers']], success: 'Turno entregado: pendiente de confirmación del entrante', onSuccess: (r) => nav(`/turnos/${r.id}`) });
  const addTask = useAction((v: any) => api.post('/tasks', v), { invalidate: [['tasks']], success: 'Pendiente registrado' });
  const done = useAction((v: any) => api.post(`/tasks/${v.id}/complete`, v), { invalidate: [['tasks']], success: 'Pendiente cerrado' });
  const monitors = (users.data ?? []).filter((u) => u.active && u.id !== me?.id && u.roles.some((r: any) => ['MONITORISTA', 'SUPERVISOR'].includes(r.role.key)));
  const s = preview.data;
  return (
    <>
      <PageHeader title="Entrega y recepción de turno" subtitle="Bitácora digital con fotografía del estado operativo generada por el sistema" />
      {!!pendingForMe.data?.length && <div className="mb-5"><Notice tone="amber" icon={<RefreshCw className="h-5 w-5 shrink-0" />}>Tiene entregas por confirmar: {pendingForMe.data.map((h) => <Link key={h.id} to={`/turnos/${h.id}`} className="mr-2 font-semibold underline">{h.outgoingUser.fullName} ({fmtTime(h.createdAt)})</Link>)}</Notice></div>}
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'deliver', label: 'Entregar turno' }, { value: 'tasks', label: 'Pendientes', count: tasks.data?.length }, { value: 'history', label: 'Historial' }]} />
      {tab === 'deliver' && (!can('handover.create') ? <Empty title="Sin permiso para entregar turno" /> : preview.isLoading || !s ? <Spinner /> : (
        <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <Snapshot s={s} />
          <Card title="Datos de la entrega">
            <div className="space-y-4">
              <Field label="Monitorista entrante"><Select value={form.incomingUserId} onChange={(e) => setForm({ ...form, incomingUserId: e.target.value })} placeholder="Cualquier monitorista del turno" options={monitors.map((u) => ({ value: u.id, label: u.fullName }))} /></Field>
              <Field label="Actividades prioritarias"><Textarea rows={4} value={form.priorities} onChange={(e) => setForm({ ...form, priorities: e.target.value })} /></Field>
              <Field label="Instrucciones operativas vigentes"><Textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></Field>
              <Field label="Notas"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
              <Button size="lg" className="w-full" loading={create.isPending} onClick={() => create.mutate({ ...form, incomingUserId: form.incomingUserId || null })} icon={<RefreshCw className="h-5 w-5" />}>Entregar turno</Button>
              <p className="text-xs text-ink-500">Las incidencias y pendientes conservan su responsable e historial. Si la entrega no se confirma a tiempo, se escala a supervisión.</p>
            </div>
          </Card>
        </div>
      ))}
      {tab === 'tasks' && (
        <Card title="Pendientes del turno" action={can('tasks.manage') && <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setNewTask(true)}>Agregar</Button>} padded={false}>
          <Table head={['Pendiente', 'Prioridad', 'Responsable', 'Vence', '']} empty={!tasks.data?.length}>
            {tasks.data?.map((t) => <tr key={t.id}><td className="font-medium">{t.title}<p className="text-xs text-ink-500">{t.description}</p></td><td><StatusBadge value={t.priority} /></td><td>{t.assignee?.fullName ?? 'Turno (sin asignar)'}</td><td>{fmtDateTime(t.dueAt)}</td><td>{can('tasks.manage') && <Button size="sm" variant="secondary" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => { const notes = prompt('¿Cómo se completó?'); if (notes) done.mutate({ id: t.id, notes }); }}>Completar</Button>}</td></tr>)}
          </Table>
        </Card>
      )}
      {tab === 'history' && <Card padded={false}><Table head={['Fecha', 'Saliente', 'Entrante', 'Estado', 'Confirmación']} empty={!list.data?.length}>{list.data?.map((h) => <tr key={h.id} className="cursor-pointer hover:bg-ink-50" onClick={() => nav(`/turnos/${h.id}`)}><td>{fmtDateTime(h.createdAt)}</td><td>{h.outgoingUser.fullName}</td><td>{h.incomingUser?.fullName ?? '—'}</td><td><StatusBadge value={h.status} /></td><td>{fmtDateTime(h.acknowledgedAt)}</td></tr>)}</Table></Card>}
      <FormModal open={newTask} onClose={() => setNewTask(false)} title="Nuevo pendiente" initial={{ title: '', description: '', priority: 'MEDIA', assigneeId: '', dueAt: '' }} onSubmit={(v) => addTask.mutateAsync({ ...v, assigneeId: v.assigneeId || null, dueAt: v.dueAt ? new Date(v.dueAt).toISOString() : null })}>
        {(v, set) => <><Field label="Pendiente"><Input value={v.title} onChange={(e) => set({ title: e.target.value })} /></Field><Field label="Detalle"><Textarea value={v.description} onChange={(e) => set({ description: e.target.value })} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Prioridad"><Select value={v.priority} onChange={(e) => set({ priority: e.target.value })} options={{ CRITICA: 'Crítica', ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja' }} /></Field><Field label="Vence"><Input type="datetime-local" value={v.dueAt} onChange={(e) => set({ dueAt: e.target.value })} /></Field></div><Field label="Responsable"><Select value={v.assigneeId} onChange={(e) => set({ assigneeId: e.target.value })} placeholder="Turno (sin asignar)" options={(users.data ?? []).filter((u) => u.active).map((u) => ({ value: u.id, label: u.fullName }))} /></Field></>}
      </FormModal>
    </>
  );
}

function Snapshot({ s }: { s: any }) {
  const List = ({ title, items, render, tone }: { title: string; items: any[]; render: (x: any) => React.ReactNode; tone?: 'red' | 'amber' | 'green' | 'gray' }) => (
    <Card title={<span className="flex items-center gap-2">{title}<Badge tone={items.length ? tone ?? 'gray' : 'gray'}>{items.length}</Badge></span>} padded={false}>
      {items.length ? <ul className="max-h-60 divide-y divide-ink-100 overflow-y-auto">{items.map((x, i) => <li key={x.id ?? i} className="px-5 py-2.5 text-sm">{render(x)}</li>)}</ul> : <p className="px-5 py-4 text-sm text-ink-400">Ninguno</p>}
    </Card>
  );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Barrido vigente" className="md:col-span-2">
        <p className="text-sm">Ciclo {fmtTime(s.sweeps.startsAt)}–{fmtTime(s.sweeps.dueAt)}: <b>{s.sweeps.progress.percent}%</b> ({s.sweeps.progress.pending} pendientes){s.sweeps.overdueCycles24h > 0 && <> · <span className="text-red-600">{s.sweeps.overdueCycles24h} ciclos vencidos en 24 h</span></>}</p>
        {s.sweeps.pendingUnits.length > 0 && <p className="mt-1 text-xs text-ink-500">Pendientes: {s.sweeps.pendingUnits.join(', ')}</p>}
      </Card>
      <List title="Incidencias abiertas" tone="red" items={s.incidents} render={(i) => <><b>{i.folio}</b> {i.title} · <StatusBadge value={i.priority} /> · resp. {i.responsible.fullName}</>} />
      <List title="Eventos críticos (12 h)" tone="red" items={s.criticalEvents} render={(a) => <>{fmtTime(a.detectedAt)} · {a.title} · {label(a.status)}</>} />
      <List title="Unidades detenidas" tone="amber" items={s.units.detenidas} render={(u) => <><b>{u.economicNumber}</b> {u.minutes !== null && `· ${minutesLabel(u.minutes)}`} {u.reason && `· ${STOP_REASONS[u.reason]}`}</>} />
      <List title="Sin comunicación GPS" tone="red" items={s.units.sinComunicacion} render={(u) => <b>{u.economicNumber}</b>} />
      <List title="Cámaras con fallas" tone="amber" items={s.cameraFaults} render={(f) => <><b>{f.camera.unit.economicNumber}</b> {f.camera.label} · {label(f.faultStatus)}</>} />
      <List title="Pendientes abiertos" tone="amber" items={s.tasks} render={(t) => <>{t.title} · {t.assignee?.fullName ?? 'turno'}</>} />
      <List title="En tránsito" items={s.units.enTransito} tone="green" render={(u) => <><b>{u.economicNumber}</b> · {u.operator ?? 'sin operador'}</>} />
      <List title="Resguardadas" items={s.units.resguardadas} tone="green" render={(u) => <b>{u.economicNumber}</b>} />
      <List title="Instrucciones operativas vigentes" items={s.instructions} render={(c) => <>{c.folio} · {c.title}</>} />
    </div>
  );
}

export function HandoverDetailPage() {
  const { id } = useParams();
  const { me, can } = useAuth();
  const { data: h, isLoading } = useApi<any>(['handover', id], `/handovers/${id}`);
  const [obs, setObs] = useState(false);
  const [comments, setComments] = useState('');
  const [assumeTasks, setAssumeTasks] = useState<string[]>([]);
  const [assumeInc, setAssumeInc] = useState<string[]>([]);
  const ack = useAction((v: any) => api.post(`/handovers/${id}/acknowledge`, v), { invalidate: [['handover', id], ['handovers'], ['ho-mine'], ['home']], success: 'Recepción de turno confirmada' });
  if (isLoading || !h) return <Spinner />;
  const canAck = ['PENDIENTE_CONFIRMACION', 'ESCALADA_SUPERVISION'].includes(h.status) && h.outgoingUserId !== me?.id && (!h.incomingUserId || h.incomingUserId === me?.id || can('handover.supervise'));
  return (
    <>
      <Link to="/turnos" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-500"><ArrowLeft className="h-4 w-4" />Turnos</Link>
      <PageHeader title={`Entrega de ${h.outgoingUser.fullName}`} subtitle={`${fmtDateTime(h.createdAt)} · entrante: ${h.incomingUser?.fullName ?? 'por asignar'}`} actions={<StatusBadge value={h.status} />} />
      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <div className="space-y-4">
          <Card title="Actividades prioritarias"><p className="whitespace-pre-line text-sm">{h.priorities}</p>{h.instructions && <><p className="mt-3 text-xs font-semibold uppercase text-ink-500">Instrucciones</p><p className="whitespace-pre-line text-sm">{h.instructions}</p></>}{h.notes && <p className="mt-3 text-sm text-ink-600">{h.notes}</p>}</Card>
          <Snapshot s={h.snapshot} />
        </div>
        <Card title="Recepción">
          {canAck ? (
            <div className="space-y-4">
              {h.snapshot.incidents.length > 0 && <div><p className="label">Incidencias que asumirá (opcional)</p>{h.snapshot.incidents.map((i: any) => <Check key={i.id} checked={assumeInc.includes(i.id)} onChange={(b) => setAssumeInc(b ? [...assumeInc, i.id] : assumeInc.filter((x) => x !== i.id))} label={`${i.folio} · ${i.title}`} hint={`Responsable actual: ${i.responsible.fullName}`} />)}</div>}
              {h.snapshot.tasks.length > 0 && <div><p className="label">Pendientes que asumirá (opcional)</p>{h.snapshot.tasks.map((t: any) => <Check key={t.id} checked={assumeTasks.includes(t.id)} onChange={(b) => setAssumeTasks(b ? [...assumeTasks, t.id] : assumeTasks.filter((x) => x !== t.id))} label={t.title} />)}</div>}
              <Check checked={obs} onChange={setObs} label="Recibo con observaciones" />
              <Field label="Comentarios"><Textarea value={comments} onChange={(e) => setComments(e.target.value)} /></Field>
              <Button size="lg" className="w-full" icon={<CheckCircle2 className="h-5 w-5" />} loading={ack.isPending} onClick={() => ack.mutate({ withObservations: obs, comments: comments || undefined, assumeTaskIds: assumeTasks, assumeIncidentIds: assumeInc })}>Confirmar recepción</Button>
            </div>
          ) : h.acknowledgedAt ? <Notice tone="green">Confirmada {fmtDateTime(h.acknowledgedAt)}{h.receiverComments && ` · ${h.receiverComments}`}</Notice> : <Notice tone="amber">Pendiente de confirmación por el monitorista entrante.</Notice>}
        </Card>
      </div>
    </>
  );
}
