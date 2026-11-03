import { useState } from 'react';
import { Moon, Clock, AlertTriangle, LogIn, LogOut, Plus, ShieldCheck } from 'lucide-react';
import { useApi, useAction, api } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, Empty, Field, Input, Notice, PageHeader, Select, Spinner, Stat, StatusBadge, Table, Tabs, Textarea } from '../components/ui';
import { Freshness } from '../components/DataTag';
import { FormModal } from '../components/forms';
import { fmtDateTime, minutesLabel, toLocalInput } from '../lib/format';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function HavensPage() {
  const { can, me } = useAuth();
  const [tab, setTab] = useState<'status' | 'arrivals' | 'exceptions' | 'rules'>('status');
  const [modal, setModal] = useState<{ kind: 'arrive' | 'depart' | 'exception' | 'decide' | 'rule'; item?: any } | null>(null);
  const st = useApi<any>(['curfew'], '/route/curfew-status', { refetchInterval: 30000 });
  const arrivals = useApi<any[]>(['arrivals'], '/route/arrivals');
  const exc = useApi<any[]>(['exceptions'], '/route/exceptions');
  const rules = useApi<any[]>(['rules'], '/route/rules');
  const havens = useApi<any[]>(['havens', 'v'], '/route/havens?validated=true');
  const corridors = useApi<any[]>(['corridors'], modal?.kind === 'rule' ? '/catalogs/corridors' : null);
  const routes = useApi<any[]>(['routes'], modal?.kind === 'rule' ? '/catalogs/routes' : null);
  const inv = [['curfew'], ['arrivals'], ['exceptions'], ['fleet']];
  const arrive = useAction((v: any) => api.post('/route/arrivals', v), { invalidate: inv, success: 'Llegada a resguardo registrada' });
  const depart = useAction((v: any) => api.post(`/route/arrivals/${v.id}/depart`, v), { invalidate: inv, success: 'Salida registrada' });
  const reqExc = useAction((v: any) => api.post('/route/exceptions', v), { invalidate: inv, success: 'Excepción solicitada: requiere autorización' });
  const decide = useAction((v: any) => api.post(`/route/exceptions/${v.id}/decide`, v), { invalidate: inv, success: 'Decisión registrada' });
  const rule = useAction((v: any) => (v.id ? api.put(`/route/rules/${v.id}`, v) : api.post('/route/rules', v)), { invalidate: [['rules']], success: 'Cambio solicitado: requiere autorización en Configuración' });
  const items = st.data?.items ?? [];
  const count = (s: string) => items.filter((i: any) => i.state === s).length;
  return (
    <>
      <PageHeader title="Seguridad en ruta y resguardo nocturno" subtitle="Rutas foráneas desde Nuevo Laredo más allá de Monterrey: en resguardo antes de las 22:00 (configurable por corredor y ruta)" actions={<>
        {can('route.manage') && <Button icon={<LogIn className="h-4 w-4" />} onClick={() => setModal({ kind: 'arrive' })}>Registrar llegada</Button>}
        {can('route.exceptions.request') && <Button variant="secondary" onClick={() => setModal({ kind: 'exception' })}>Solicitar excepción</Button>}
      </>} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Incumplimientos" value={count('INCUMPLIMIENTO')} tone={count('INCUMPLIMIENTO') ? 'red' : 'green'} icon={<AlertTriangle className="h-5 w-5" />} />
        <Stat label="Sin evidencia" value={count('SIN_EVIDENCIA')} tone={count('SIN_EVIDENCIA') ? 'red' : 'gray'} />
        <Stat label="Próximas al límite" value={count('ADVERTENCIA')} tone={count('ADVERTENCIA') ? 'amber' : 'gray'} icon={<Clock className="h-5 w-5" />} />
        <Stat label="En resguardo" value={count('EN_RESGUARDO')} tone="green" icon={<Moon className="h-5 w-5" />} />
        <Stat label="Con excepción" value={count('EXCEPCION_AUTORIZADA')} tone="blue" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'status', label: 'Unidades sujetas', count: items.length }, { value: 'arrivals', label: 'Llegadas a resguardo' }, { value: 'exceptions', label: 'Excepciones', count: exc.data?.filter((e) => e.status === 'PENDIENTE').length }, { value: 'rules', label: 'Reglas de circulación' }]} />
      {tab === 'status' && (st.isLoading ? <Spinner /> : !items.length ? <Card><Empty title="No hay unidades en viaje sujetas a reglas de circulación" /></Card> : (
        <Card padded={false}><Table head={['Unidad', 'Viaje', 'Estado', 'Horario límite', 'Próximo resguardo autorizado', 'Dato GPS', '']}>
          {items.map((i: any) => <tr key={i.unit.id}>
            <td className="font-bold">{i.unit.economicNumber}<p className="text-xs font-normal text-ink-500">{i.unit.operator?.fullName}</p></td>
            <td>{i.trip?.tripNumber ?? '—'}<p className="text-xs text-ink-500">{i.trip?.destination}</p></td>
            <td><StatusBadge value={i.state} /><p className="mt-1 max-w-[260px] text-xs text-ink-500">{i.reason}</p></td>
            <td>{i.rule.curfewStart}–{i.rule.curfewEnd}{i.minutesToCurfew > 0 && <p className="text-xs text-ink-500">faltan {minutesLabel(i.minutesToCurfew)}</p>}</td>
            <td>{i.inHaven ? <Badge tone="green">{i.inHaven.name}</Badge> : i.nextHaven ? <>{i.nextHaven.name}{i.nextHaven.distanceKm !== null && <p className="text-xs text-ink-500">~{i.nextHaven.distanceKm} km en línea recta</p>}</> : <span className="text-xs text-red-600">Sin resguardo validado en el corredor</span>}</td>
            <td><Freshness value={i.unit.freshness} /></td>
            <td>{can('route.manage') && !i.inHaven && <Button size="sm" variant="secondary" onClick={() => setModal({ kind: 'arrive', item: { unitId: i.unit.id, tripId: i.trip?.id, havenId: i.nextHaven?.id } })}>Llegada</Button>}</td>
          </tr>)}
        </Table></Card>
      ))}
      {tab === 'arrivals' && <Card padded={false}><Table head={['Unidad', 'Resguardo', 'Llegada', 'Salida', 'Evidencia', '']} empty={!arrivals.data?.length}>{arrivals.data?.map((a) => <tr key={a.id}><td className="font-medium">{a.unit.economicNumber}</td><td>{a.haven.name}</td><td>{fmtDateTime(a.arrivedAt)}</td><td>{a.departedAt ? fmtDateTime(a.departedAt) : <Badge tone="green">En resguardo</Badge>}</td><td className="max-w-xs truncate">{a.evidence}</td><td>{!a.departedAt && can('route.manage') && <Button size="sm" variant="ghost" icon={<LogOut className="h-4 w-4" />} onClick={() => setModal({ kind: 'depart', item: a })}>Salida</Button>}</td></tr>)}</Table></Card>}
      {tab === 'exceptions' && <Card padded={false}><Table head={['Unidad', 'Vigencia', 'Motivo', 'Evaluación de riesgo', 'Estado', '']} empty={!exc.data?.length}>{exc.data?.map((e) => <tr key={e.id}><td className="font-medium">{e.unit.economicNumber}</td><td>{fmtDateTime(e.validFrom)} – {fmtDateTime(e.validUntil)}</td><td>{e.reason}</td><td className="max-w-xs text-xs">{e.riskAssessment}</td><td><StatusBadge value={e.status} /></td><td>{e.status === 'PENDIENTE' && can('route.exceptions.approve') && e.requestedById !== me?.id && <Button size="sm" onClick={() => setModal({ kind: 'decide', item: e })}>Decidir</Button>}</td></tr>)}</Table></Card>}
      {tab === 'rules' && (
        <Card title="Reglas de circulación vigentes" subtitle="Prioridad: ruta específica → corredor → política general. No se asume la misma restricción para todos los tramos." action={can('route.rules.manage') && <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setModal({ kind: 'rule' })}>Nueva regla</Button>} padded={false}>
          <Table head={['Regla', 'Aplica a', 'Horario restringido', 'Aviso previo', 'Evaluación de riesgos', 'Versión', '']} empty={!rules.data?.length}>{rules.data?.map((r) => <tr key={r.id}><td className="font-medium">{r.name} {!r.active && <Badge>Inactiva</Badge>}</td><td>{r.route?.name ?? r.corridor?.name ?? (r.appliesBeyondMonterrey ? 'Rutas foráneas más allá de Monterrey' : '—')}</td><td>{r.curfewStart} – {r.curfewEnd}</td><td>{r.warnMinutesBefore} min</td><td className="max-w-xs text-xs">{r.riskAssessmentRef ?? '—'}</td><td>v{r.version}</td><td>{can('route.rules.manage') && <Button size="sm" variant="ghost" onClick={() => setModal({ kind: 'rule', item: r })}>Modificar</Button>}</td></tr>)}</Table>
        </Card>
      )}

      <FormModal key={JSON.stringify(modal?.item ?? {}) + 'arr'} open={modal?.kind === 'arrive'} onClose={() => setModal(null)} title="Registrar llegada a resguardo" initial={{ unitId: modal?.item?.unitId ?? '', tripId: modal?.item?.tripId ?? '', havenId: modal?.item?.havenId ?? '', arrivedAt: toLocalInput(), evidence: '' }} onSubmit={(v) => arrive.mutateAsync({ ...v, tripId: v.tripId || null, arrivedAt: new Date(v.arrivedAt).toISOString() })}>
        {(v, set) => <>
          <Field label="Unidad"><Select value={v.unitId} onChange={(e) => set({ unitId: e.target.value })} placeholder="Seleccione…" options={items.map((i: any) => ({ value: i.unit.id, label: i.unit.economicNumber }))} /></Field>
          <Field label="Punto de resguardo validado"><Select value={v.havenId} onChange={(e) => set({ havenId: e.target.value })} placeholder="Seleccione…" options={(havens.data ?? []).map((h) => ({ value: h.id, label: h.name }))} /></Field>
          <Field label="Hora de llegada"><Input type="datetime-local" value={v.arrivedAt} onChange={(e) => set({ arrivedAt: e.target.value })} /></Field>
          <Field label="Evidencia de la llegada" hint="Cómo se verificó: GPS, cámara, llamada, fotografía"><Textarea value={v.evidence} onChange={(e) => set({ evidence: e.target.value })} /></Field>
        </>}
      </FormModal>
      <FormModal open={modal?.kind === 'depart'} onClose={() => setModal(null)} title="Registrar salida del resguardo" initial={{ notes: '' }} onSubmit={(v) => depart.mutateAsync({ id: modal!.item.id, ...v })}>
        {(v, set) => <Field label="Observaciones"><Textarea value={v.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>}
      </FormModal>
      <FormModal open={modal?.kind === 'exception'} onClose={() => setModal(null)} title="Solicitar excepción de circulación" initial={{ unitId: '', reason: '', riskAssessment: '', validFrom: toLocalInput(), validUntil: toLocalInput(new Date(Date.now() + 4 * 3600_000)) }} onSubmit={(v) => reqExc.mutateAsync({ ...v, validFrom: new Date(v.validFrom).toISOString(), validUntil: new Date(v.validUntil).toISOString() })}>
        {(v, set) => <>
          <Notice tone="amber">Las excepciones deben documentarse con una evaluación de riesgos y ser autorizadas por otra persona. Máximo 12 horas.</Notice>
          <Field label="Unidad"><Select value={v.unitId} onChange={(e) => set({ unitId: e.target.value })} placeholder="Seleccione…" options={items.map((i: any) => ({ value: i.unit.id, label: i.unit.economicNumber }))} /></Field>
          <Field label="Motivo"><Textarea value={v.reason} onChange={(e) => set({ reason: e.target.value })} /></Field>
          <Field label="Evaluación de riesgos"><Textarea rows={4} value={v.riskAssessment} onChange={(e) => set({ riskAssessment: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Desde"><Input type="datetime-local" value={v.validFrom} onChange={(e) => set({ validFrom: e.target.value })} /></Field><Field label="Hasta"><Input type="datetime-local" value={v.validUntil} onChange={(e) => set({ validUntil: e.target.value })} /></Field></div>
        </>}
      </FormModal>
      <FormModal open={modal?.kind === 'decide'} onClose={() => setModal(null)} title="Autorizar excepción" initial={{ approve: 'false', comment: '' }} onSubmit={(v) => decide.mutateAsync({ id: modal!.item.id, approve: v.approve === 'true', comment: v.comment })}>
        {(v, set) => <><p className="text-sm"><b>Evaluación:</b> {modal?.item?.riskAssessment}</p><Field label="Decisión"><Select value={v.approve} onChange={(e) => set({ approve: e.target.value })} options={{ false: 'Rechazar', true: 'Autorizar' }} /></Field><Field label="Comentario"><Textarea value={v.comment} onChange={(e) => set({ comment: e.target.value })} /></Field></>}
      </FormModal>
      <FormModal key={modal?.item?.id ?? 'newrule'} open={modal?.kind === 'rule'} onClose={() => setModal(null)} title={modal?.item ? 'Modificar regla' : 'Nueva regla de circulación'} initial={{ id: modal?.item?.id ?? '', name: modal?.item?.name ?? '', corridorId: modal?.item?.corridorId ?? '', routeId: modal?.item?.routeId ?? '', appliesBeyondMonterrey: String(modal?.item?.appliesBeyondMonterrey ?? false), curfewStart: modal?.item?.curfewStart ?? '22:00', curfewEnd: modal?.item?.curfewEnd ?? '06:00', warnMinutesBefore: String(modal?.item?.warnMinutesBefore ?? 90), riskAssessmentRef: modal?.item?.riskAssessmentRef ?? '', active: String(modal?.item?.active ?? true), reason: '' }}
        onSubmit={(v) => rule.mutateAsync({ ...v, id: v.id || undefined, corridorId: v.corridorId || null, routeId: v.routeId || null, appliesBeyondMonterrey: v.appliesBeyondMonterrey === 'true', active: v.active === 'true', warnMinutesBefore: Number(v.warnMinutesBefore) })} submitLabel="Solicitar autorización">
        {(v, set) => <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" className="sm:col-span-2"><Input value={v.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Corredor"><Select value={v.corridorId} onChange={(e) => set({ corridorId: e.target.value })} placeholder="—" options={(corridors.data ?? []).map((c) => ({ value: c.id, label: c.name }))} /></Field>
          <Field label="Ruta específica"><Select value={v.routeId} onChange={(e) => set({ routeId: e.target.value })} placeholder="—" options={(routes.data ?? []).map((c) => ({ value: c.id, label: c.name }))} /></Field>
          <Field label="Política general (más allá de Monterrey)"><Select value={v.appliesBeyondMonterrey} onChange={(e) => set({ appliesBeyondMonterrey: e.target.value })} options={{ false: 'No', true: 'Sí' }} /></Field>
          <Field label="Activa"><Select value={v.active} onChange={(e) => set({ active: e.target.value })} options={{ true: 'Sí', false: 'No' }} /></Field>
          <Field label="Inicio de restricción"><Input type="time" value={v.curfewStart} onChange={(e) => set({ curfewStart: e.target.value })} /></Field>
          <Field label="Fin de restricción"><Input type="time" value={v.curfewEnd} onChange={(e) => set({ curfewEnd: e.target.value })} /></Field>
          <Field label="Aviso previo (min)"><Input type="number" value={v.warnMinutesBefore} onChange={(e) => set({ warnMinutesBefore: e.target.value })} /></Field>
          <Field label="Referencia a evaluación de riesgos"><Input value={v.riskAssessmentRef} onChange={(e) => set({ riskAssessmentRef: e.target.value })} /></Field>
          <Field label="Justificación del cambio" className="sm:col-span-2"><Textarea value={v.reason} onChange={(e) => set({ reason: e.target.value })} /></Field>
          <p className="flex items-center gap-1.5 text-xs text-ink-500 sm:col-span-2"><ShieldCheck className="h-4 w-4" />Configuración crítica: se aplica solo cuando otra persona la autoriza.</p>
        </div>}
      </FormModal>
    </>
  );
}
