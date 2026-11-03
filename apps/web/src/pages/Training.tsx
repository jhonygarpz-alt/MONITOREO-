import { useState } from 'react';
import { Plus, CalendarDays, AlertTriangle } from 'lucide-react';
import { useApi, useAction, api } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, Check, Empty, Field, Input, Modal, Notice, PageHeader, Select, Spinner, StatusBadge, Table, Tabs, Textarea } from '../components/ui';
import { FormModal } from '../components/forms';
import { fmtDate, fmtDateTime, toLocalInput } from '../lib/format';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function TrainingPage() {
  const { can, me } = useAuth();
  const [tab, setTab] = useState<'sessions' | 'agreements'>('sessions');
  const [modal, setModal] = useState<'' | 'session' | 'agreement'>('');
  const [open, setOpen] = useState<string | null>(null);
  const sessions = useApi<any[]>(['training'], '/training/sessions');
  const agreements = useApi<any[]>(['agreements'], '/training/agreements?open=false');
  const users = useApi<any[]>(['users'], '/admin/users');
  const tzConfirmed = me?.settings.trainingTimezoneConfirmed;
  const inv = [['training'], ['agreements']];
  const createS = useAction((v: any) => api.post('/training/sessions', v), { invalidate: inv, success: 'Sesión programada' });
  const createA = useAction((v: any) => api.post('/training/agreements', v), { invalidate: inv, success: 'Acuerdo registrado y notificado al responsable' });
  const progress = useAction((v: any) => api.post(`/training/agreements/${v.id}/progress`, v), { invalidate: inv, success: 'Avance registrado' });
  return (
    <>
      <PageHeader title="Capacitación y mejora continua" subtitle="Sesión semanal los miércoles a las 17:00 coordinada por Gerencia" actions={can('training.manage') && <><Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setModal('agreement')}>Acuerdo</Button><Button icon={<Plus className="h-4 w-4" />} onClick={() => setModal('session')}>Sesión / simulacro</Button></>} />
      {tzConfirmed === false && <div className="mb-5"><Notice tone="amber" icon={<AlertTriangle className="h-5 w-5 shrink-0" />}>Zona horaria de la sesión <b>pendiente de confirmación</b> (Centro o Pacífico). Gerencia puede confirmarla en Configuración.</Notice></div>}
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'sessions', label: 'Calendario' }, { value: 'agreements', label: 'Acuerdos y compromisos', count: agreements.data?.filter((a) => ['ABIERTO', 'EN_PROCESO', 'VENCIDO'].includes(a.status)).length }]} />
      {tab === 'sessions' && (sessions.isLoading ? <Spinner /> : !sessions.data?.length ? <Card><Empty title="Sin sesiones programadas">El motor de reglas programa automáticamente las próximas cuatro sesiones semanales.</Empty></Card> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sessions.data.map((s) => (
            <button key={s.id} onClick={() => setOpen(s.id)} className="card p-4 text-left hover:shadow-pop">
              <div className="flex items-start justify-between"><CalendarDays className="h-5 w-5 text-brand-700" /><div className="flex gap-1">{s.isDrill && <Badge tone="red">Simulacro</Badge>}<StatusBadge value={s.status} /></div></div>
              <p className="mt-2 font-semibold">{s.title}</p>
              <p className="text-sm text-ink-500">{new Date(s.scheduledAt).toLocaleString('es-MX', { timeZone: s.timezone, weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} ({s.timezone.split('/')[1]?.replace('_', ' ')}{!s.timezoneConfirmed && ', por confirmar'})</p>
              <p className="mt-2 text-xs text-ink-500">{s._count.attendance} asistentes · {s._count.agreements} acuerdos</p>
            </button>
          ))}
        </div>
      ))}
      {tab === 'agreements' && <Card padded={false}><Table head={['Acuerdo', 'Responsable', 'Fecha compromiso', 'Estado', 'Avance', '']} empty={!agreements.data?.length}>{agreements.data?.map((a) => <tr key={a.id}><td className="font-medium">{a.description}<p className="text-xs text-ink-500">{a.session?.title}</p></td><td>{a.responsible.fullName}</td><td>{fmtDate(a.dueDate)}</td><td><StatusBadge value={a.status} /></td><td className="max-w-xs whitespace-pre-line text-xs text-ink-500">{a.progressNotes?.split('\n').slice(-1)[0]}</td><td>{['ABIERTO', 'EN_PROCESO', 'VENCIDO'].includes(a.status) && <Button size="sm" variant="secondary" onClick={() => { const notes = prompt('Avance o evidencia de cumplimiento'); if (notes) progress.mutate({ id: a.id, status: confirm('¿Marcar como CUMPLIDO? (Cancelar = en proceso)') ? 'CUMPLIDO' : 'EN_PROCESO', notes }); }}>Avance</Button>}</td></tr>)}</Table></Card>}
      {open && <SessionModal id={open} onClose={() => setOpen(null)} users={users.data ?? []} />}
      <FormModal open={modal === 'session'} onClose={() => setModal('')} title="Programar sesión" initial={{ title: '', scheduledAt: toLocalInput(), timezone: 'America/Mexico_City', durationMin: '60', agenda: '', topics: '', isDrill: false, drillScenario: '' }} onSubmit={(v) => createS.mutateAsync({ ...v, scheduledAt: new Date(v.scheduledAt).toISOString(), durationMin: Number(v.durationMin), topics: v.topics.split(',').map((x) => x.trim()).filter(Boolean), drillScenario: v.drillScenario || undefined })}>
        {(v, set) => <><Field label="Título"><Input value={v.title} onChange={(e) => set({ title: e.target.value })} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Fecha y hora"><Input type="datetime-local" value={v.scheduledAt} onChange={(e) => set({ scheduledAt: e.target.value })} /></Field><Field label="Zona horaria"><Select value={v.timezone} onChange={(e) => set({ timezone: e.target.value })} options={{ 'America/Mexico_City': 'Centro', 'America/Monterrey': 'Centro (Monterrey)', 'America/Tijuana': 'Pacífico', 'America/Mazatlan': 'Pacífico (Mazatlán)' }} /></Field></div><Field label="Agenda"><Textarea value={v.agenda} onChange={(e) => set({ agenda: e.target.value })} /></Field><Field label="Temas (separados por coma)"><Input value={v.topics} onChange={(e) => set({ topics: e.target.value })} /></Field><Check checked={v.isDrill} onChange={(b) => set({ isDrill: b })} label="Es un simulacro de respuesta ante incidentes" />{v.isDrill && <Field label="Escenario del simulacro"><Textarea value={v.drillScenario} onChange={(e) => set({ drillScenario: e.target.value })} /></Field>}</>}
      </FormModal>
      <FormModal open={modal === 'agreement'} onClose={() => setModal('')} title="Nuevo acuerdo de mejora" initial={{ description: '', responsibleId: '', dueDate: '', sessionId: '' }} onSubmit={(v) => createA.mutateAsync({ ...v, sessionId: v.sessionId || null })}>
        {(v, set) => <><Field label="Acuerdo"><Textarea value={v.description} onChange={(e) => set({ description: e.target.value })} /></Field><Field label="Responsable"><Select value={v.responsibleId} onChange={(e) => set({ responsibleId: e.target.value })} placeholder="Seleccione…" options={(users.data ?? []).filter((u) => u.active).map((u) => ({ value: u.id, label: u.fullName }))} /></Field><Field label="Fecha compromiso"><Input type="date" value={v.dueDate} onChange={(e) => set({ dueDate: e.target.value })} /></Field><Field label="Sesión"><Select value={v.sessionId} onChange={(e) => set({ sessionId: e.target.value })} placeholder="—" options={(sessions.data ?? []).map((s) => ({ value: s.id, label: `${s.title} · ${fmtDate(s.scheduledAt)}` }))} /></Field></>}
      </FormModal>
    </>
  );
}

function SessionModal({ id, onClose, users }: { id: string; onClose: () => void; users: any[] }) {
  const { can } = useAuth();
  const { data: s } = useApi<any>(['session', id], `/training/sessions/${id}`);
  const [att, setAtt] = useState<Record<string, boolean>>({});
  const [summary, setSummary] = useState('');
  const [caseTitle, setCaseTitle] = useState('');
  const inv = [['session', id], ['training']];
  const saveAtt = useAction((v: any) => api.post(`/training/sessions/${id}/attendance`, v), { invalidate: inv, success: 'Asistencia registrada' });
  const update = useAction((v: any) => api.put(`/training/sessions/${id}`, v), { invalidate: inv, success: 'Sesión actualizada' });
  const addCase = useAction((v: any) => api.post(`/training/sessions/${id}/cases`, v), { invalidate: inv, success: 'Caso agregado', onSuccess: () => setCaseTitle('') });
  const evalU = useAction((v: any) => api.post(`/training/sessions/${id}/evaluations`, v), { invalidate: inv, success: 'Evaluación registrada' });
  if (!s) return null;
  const present = (uid: string) => att[uid] ?? s.attendance.find((a: any) => a.userId === uid)?.present ?? false;
  const team = users.filter((u) => u.active && u.roles.some((r: any) => ['MONITORISTA', 'SUPERVISOR', 'GERENCIA'].includes(r.role.key)));
  return (
    <Modal open onClose={onClose} wide title={s.title}>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <p className="text-sm text-ink-500">{fmtDateTime(s.scheduledAt)} · {s.durationMin} min</p>
          {s.agenda && <p className="whitespace-pre-line text-sm">{s.agenda}</p>}
          {s.isDrill && <Notice tone="red">Simulacro: {s.drillScenario}</Notice>}
          <p className="label">Casos analizados</p>
          {s.cases.map((c: any) => <p key={c.id} className="text-sm">• {c.title}</p>)}
          {can('training.manage') && <div className="flex gap-2"><Input value={caseTitle} onChange={(e) => setCaseTitle(e.target.value)} placeholder="Caso / incidente analizado" /><Button variant="secondary" onClick={() => caseTitle && addCase.mutate({ title: caseTitle })}>Agregar</Button></div>}
          {can('training.manage') && <><Field label="Resumen y conclusiones"><Textarea value={summary || s.summary || ''} onChange={(e) => setSummary(e.target.value)} /></Field><Button onClick={() => update.mutate({ status: 'REALIZADA', summary })}>Marcar como realizada</Button></>}
        </div>
        <div>
          <p className="label">Asistencia y evaluación</p>
          <div className="space-y-2">
            {team.map((u) => {
              const ev = s.evaluations.find((e: any) => e.userId === u.id);
              return (
                <div key={u.id} className="flex items-center gap-2 rounded-xl border border-ink-200 p-2">
                  <input type="checkbox" className="h-5 w-5 accent-brand-700" disabled={!can('training.manage')} checked={present(u.id)} onChange={(e) => setAtt({ ...att, [u.id]: e.target.checked })} />
                  <span className="flex-1 text-sm">{u.fullName}</span>
                  {ev ? <Badge tone="green">{ev.score}/{ev.maxScore}</Badge> : can('training.manage') && <Button size="sm" variant="ghost" onClick={() => { const sc = prompt('Calificación (0-100)'); if (sc) evalU.mutate({ userId: u.id, score: Number(sc) }); }}>Evaluar</Button>}
                </div>
              );
            })}
          </div>
          {can('training.manage') && <Button className="mt-3" onClick={() => saveAtt.mutate({ records: team.map((u) => ({ userId: u.id, present: present(u.id) })) })}>Guardar asistencia</Button>}
        </div>
      </div>
    </Modal>
  );
}
