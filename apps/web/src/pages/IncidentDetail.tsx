import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Phone, ArrowUpRight, FolderOpen, CheckCircle2, Circle, MinusCircle, AlertTriangle, Lock, PhoneCall, MessageSquarePlus, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import { useApi, useAction, api } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, Field, Input, Modal, Notice, Select, Spinner, StatusBadge, Textarea } from '../components/ui';
import { SourceTag } from '../components/DataTag';
import { FormModal } from '../components/forms';
import { fmtDateTime, toLocalInput } from '../lib/format';
import { ALERT_TYPES, CHANNELS, COMM_TYPES, label } from '../lib/labels';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function IncidentDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const [modal, setModal] = useState<'' | 'comm' | 'escalate' | 'note' | 'closure' | 'approve' | 'dossier' | 'status' | 'step'>('');
  const [stepKey, setStepKey] = useState<{ key: string; title: string; channel?: string; action?: string } | null>(null);
  const [commPreset, setCommPreset] = useState<{ channel: string; commType: string }>({ channel: 'LLAMADA_OPERADOR', commType: 'SEGUIMIENTO' });
  const { data: inc, isLoading } = useApi<any>(['incident', id], `/incidents/${id}`, { refetchInterval: 20000 });
  const contacts = useApi<any[]>(['emergency'], modal === 'comm' ? '/emergency-contacts' : null);
  const dossier = useApi<any>(['dossier', id], modal === 'dossier' ? `/incidents/${id}/dossier` : null);
  const inv = [['incident', id], ['incidents']];
  const comm = useAction((v: any) => api.post<any>(`/incidents/${id}/communications`, v), { invalidate: inv, success: (r) => (r.autoEscalated ? 'Comunicación registrada. Se escaló automáticamente a Gerencia.' : r.contactWarning ?? 'Comunicación registrada') });
  const escalate = useAction((v: any) => api.post<any>(`/incidents/${id}/escalate`, v), { invalidate: inv, success: (r) => `Escalada (${r.recipients} destinatarios notificados en la aplicación)` });
  const note = useAction((v: any) => api.post(`/incidents/${id}/notes`, v), { invalidate: inv, success: 'Acción registrada en el historial' });
  const step = useAction((v: any) => api.post(`/incidents/${id}/protocol-step`, v), { invalidate: inv, success: 'Paso del protocolo registrado' });
  const status = useAction((v: any) => api.post(`/incidents/${id}/status`, v), { invalidate: inv, success: 'Estado actualizado' });
  const closure = useAction((v: any) => api.post(`/incidents/${id}/request-closure`, v), { invalidate: inv, success: 'Cierre solicitado: pendiente de aprobación' });
  const approve = useAction((v: any) => api.post(`/incidents/${id}/approve-closure`, v), { invalidate: inv, success: 'Decisión registrada' });
  if (isLoading || !inc) return <Spinner />;
  const closed = inc.status === 'CERRADA';
  const state = (inc.protocolState ?? {}) as Record<string, { outcome: string; notes?: string; by: string; at: string }>;
  const g = inc.callGuidance;
  const openComm = (channel: string, commType: string) => { setCommPreset({ channel, commType }); setModal('comm'); };

  return (
    <>
      <Link to="/incidencias" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink-800"><ArrowLeft className="h-4 w-4" />Incidencias</Link>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">{inc.folio}</h1><StatusBadge value={inc.priority} /><StatusBadge value={inc.status} /><Badge tone="blue">Nivel: {label(inc.currentLevel)}</Badge></div>
          <p className="mt-1 text-lg text-ink-700">{inc.title}</p>
          <p className="text-sm text-ink-500">{ALERT_TYPES[inc.type]} · abierta {fmtDateTime(inc.openedAt)} · responsable {inc.responsible.fullName}</p>
        </div>
        {!closed && (
          <div className="flex flex-wrap gap-2">
            {can('incidents.dossier') && <Button variant="secondary" icon={<FolderOpen className="h-4 w-4" />} onClick={() => setModal('dossier')}>Expediente</Button>}
            {can('incidents.manage') && <Button variant="secondary" icon={<MessageSquarePlus className="h-4 w-4" />} onClick={() => setModal('note')}>Registrar acción</Button>}
            {can('incidents.escalate') && inc.currentLevel !== 'OPERACIONES_ESTRATEGICAS' && <Button variant="warning" icon={<ArrowUpRight className="h-4 w-4" />} onClick={() => setModal('escalate')}>Escalar</Button>}
            {can('immob.request') && inc.unit && <Link to={`/inmovilizacion?unitId=${inc.unit.id}&incidentId=${inc.id}`}><Button variant="secondary" icon={<Lock className="h-4 w-4" />}>Inmovilización</Button></Link>}
          </div>
        )}
      </div>

      {g.escalateNow && !closed && inc.currentLevel === 'MONITORISTA' && <div className="mb-5"><Notice tone="red" icon={<AlertTriangle className="h-5 w-5 shrink-0" />}>{g.grave ? 'Indicios de emergencia grave: solicite apoyo y escale de inmediato, sin esperar las tres llamadas.' : `El operador no respondió tras ${g.attempts} intentos: escale a Gerencia.`}</Notice></div>}
      {inc.protocol?.warning && <div className="mb-5"><Notice tone="amber" icon={<ShieldCheck className="h-5 w-5 shrink-0" />}>{inc.protocol.warning}</Notice></div>}

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          {inc.protocol && (
            <Card title={`Protocolo: ${inc.protocol.name}`} subtitle="Registre cada paso conforme se realiza" padded={false}>
              <ol className="divide-y divide-ink-100">
                {inc.protocol.steps.map((s: any, i: number) => {
                  const done = state[s.key];
                  return (
                    <li key={s.key} className="flex gap-3 px-5 py-4">
                      <span className="mt-0.5">{done ? done.outcome === 'REALIZADO' ? <CheckCircle2 className="h-6 w-6 text-brand-600" /> : <MinusCircle className="h-6 w-6 text-ink-400" /> : <Circle className={clsx('h-6 w-6', s.critical ? 'text-red-400' : 'text-ink-300')} />}</span>
                      <div className="flex-1">
                        <p className="font-semibold">{i + 1}. {s.title} {s.critical && <Badge tone="red">Crítico</Badge>}</p>
                        <p className="text-sm text-ink-600">{s.detail}</p>
                        {done && <p className="mt-1 text-xs text-ink-500">{label(done.outcome)} por {done.by} · {fmtDateTime(done.at)}{done.notes ? ` — ${done.notes}` : ''}</p>}
                        {!done && !closed && can('incidents.manage') && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {s.action === 'CALL_OPERATOR' && <Button size="sm" variant="secondary" icon={<Phone className="h-4 w-4" />} onClick={() => openComm('LLAMADA_OPERADOR', 'SEGUIMIENTO')}>Registrar llamada</Button>}
                            {(s.action === 'CALL_911' || s.action === 'NOTIFY') && <Button size="sm" variant={s.action === 'CALL_911' ? 'danger' : 'secondary'} icon={<PhoneCall className="h-4 w-4" />} onClick={() => openComm(s.channel ?? 'OTRO', s.action === 'CALL_911' ? 'LLAMADA_EMERGENCIA' : s.channel === 'ASEGURADORA' ? 'RECLAMACION_SEGURO' : s.channel === 'AUTORIDAD_ESTATAL' ? 'DENUNCIA_FORMAL' : 'SOLICITUD_APOYO')}>Registrar comunicación</Button>}
                            {s.action === 'ESCALATE' && <Button size="sm" variant="warning" onClick={() => setModal('escalate')}>Escalar</Button>}
                            {s.action === 'DOSSIER' && can('incidents.dossier') && <Button size="sm" variant="secondary" onClick={() => setModal('dossier')}>Abrir expediente</Button>}
                            <Button size="sm" onClick={() => { setStepKey(s); setModal('step'); }}>Marcar paso</Button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>
          )}
          <Card title="Historial cronológico" subtitle="Inalterable · cada evento queda encadenado criptográficamente" padded={false}>
            <ol className="relative px-5 py-4">
              {inc.events.map((e: any) => (
                <li key={e.id} className="relative border-l-2 border-ink-200 pb-5 pl-5 last:pb-0">
                  <span className={clsx('absolute -left-[7px] top-1 h-3 w-3 rounded-full', e.kind === 'ESCALADA' ? 'bg-amber-500' : e.kind === 'CERRADA' ? 'bg-brand-600' : e.kind === 'COMUNICACION' ? 'bg-sky-500' : 'bg-ink-400')} />
                  <p className="text-xs text-ink-500">{fmtDateTime(e.at)} · {e.actorName} · {e.kind}</p>
                  <p className="text-sm text-ink-800">{e.message}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <div className="space-y-5">
          <Card title="Unidad y operador">
            {inc.unit ? <Link to={`/flota/${inc.unit.id}`} className="text-lg font-bold text-brand-700">{inc.unit.economicNumber}</Link> : <p className="text-ink-500">Sin unidad</p>}
            {inc.unit && <p className="text-sm text-ink-500">{inc.unit.plates}</p>}
            {inc.operator && <div className="mt-3"><p className="font-medium">{inc.operator.fullName}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {inc.operator.phonePrimary && <a href={`tel:${inc.operator.phonePrimary}`}><Button size="sm" icon={<Phone className="h-4 w-4" />}>Llamar {inc.operator.phonePrimary}</Button></a>}
                {inc.operator.phoneAlt && <a href={`tel:${inc.operator.phoneAlt}`}><Button size="sm" variant="secondary">Alterno</Button></a>}
              </div>
              <p className="mt-2 text-sm text-ink-600">Llamadas registradas: <b>{g.attempts}</b> de {g.maxCalls}{g.answered && ' · operador respondió'}</p>
            </div>}
            <div className="mt-4 rounded-xl bg-ink-50 p-3 text-sm">
              <p className="text-xs font-semibold uppercase text-ink-500">Última posición conocida</p>
              {inc.lastKnownLat ? <><p className="font-mono">{inc.lastKnownLat.toFixed(5)}, {inc.lastKnownLng.toFixed(5)}</p><p className="text-xs text-ink-500">{fmtDateTime(inc.lastKnownAt)} <SourceTag source={inc.lastKnownSource} /></p></> : <p className="text-ink-500">No disponible</p>}
            </div>
            {inc.trip && <p className="mt-3 text-sm text-ink-600">Viaje {inc.trip.tripNumber} · {inc.trip.client.name} · {inc.trip.origin} → {inc.trip.destination}</p>}
          </Card>
          <Card title="Comunicaciones" action={!closed && can('incidents.manage') && <Button size="sm" onClick={() => openComm('LLAMADA_OPERADOR', 'SEGUIMIENTO')}>Registrar</Button>} padded={false}>
            {!inc.communications.length ? <p className="p-5 text-sm text-ink-500">Sin comunicaciones registradas</p> : (
              <ul className="divide-y divide-ink-100">{inc.communications.map((c: any) => (
                <li key={c.id} className="px-5 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2"><b>{CHANNELS[c.channel]}</b><StatusBadge value={c.result} /></div>
                  <p className="text-xs text-ink-500">{COMM_TYPES[c.commType]} · intento {c.attemptNo} · {fmtDateTime(c.at)}{c.numberUsed && ` · ${c.numberUsed}`}</p>
                  {c.folioObtained && <p className="text-xs">Folio: <b>{c.folioObtained}</b></p>}
                  {c.contact && c.contact.status !== 'VERIFICADO' && <p className="text-xs text-amber-700">Contacto sin verificar</p>}
                </li>
              ))}</ul>
            )}
          </Card>
          <Card title="Estado y cierre">
            <div className="space-y-2">
              {!closed && inc.status !== 'PENDIENTE_CIERRE' && can('incidents.manage') && <>
                <Button className="w-full" variant="secondary" onClick={() => setModal('status')}>Actualizar estado</Button>
                <Button className="w-full" onClick={() => setModal('closure')}>Solicitar cierre</Button>
              </>}
              {inc.status === 'PENDIENTE_CIERRE' && <Notice tone="amber">Resultado propuesto: {inc.result}<br />Justificación: {inc.closureJustification}</Notice>}
              {inc.status === 'PENDIENTE_CIERRE' && can('incidents.close.approve') && <Button className="w-full" onClick={() => setModal('approve')}>Revisar cierre</Button>}
              {closed && <Notice tone="green">Cerrada {fmtDateTime(inc.closedAt)}. Resultado: {inc.result}</Notice>}
            </div>
          </Card>
        </div>
      </div>

      <FormModal key={commPreset.channel + modal} open={modal === 'comm'} onClose={() => setModal('')} title="Registrar comunicación" initial={{ channel: commPreset.channel, commType: commPreset.commType, contactId: '', numberUsed: inc.operator?.phonePrimary && commPreset.channel === 'LLAMADA_OPERADOR' ? inc.operator.phonePrimary : '', folioObtained: '', result: '', notes: '', at: toLocalInput() }}
        onSubmit={(v) => comm.mutateAsync({ ...v, contactId: v.contactId || null, numberUsed: v.numberUsed || null, folioObtained: v.folioObtained || null, notes: v.notes || null, at: new Date(v.at).toISOString(), result: v.result || undefined })}>
        {(v, set) => {
          const options = (contacts.data ?? []).filter((c) => c.category === v.channel);
          return <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Destinatario"><Select value={v.channel} onChange={(e) => set({ channel: e.target.value, contactId: '' })} options={CHANNELS} /></Field>
              <Field label="Tipo de comunicación" hint="La llamada de emergencia, la denuncia formal y la reclamación se registran por separado"><Select value={v.commType} onChange={(e) => set({ commType: e.target.value })} options={COMM_TYPES} /></Field>
            </div>
            {v.channel !== 'LLAMADA_OPERADOR' && (
              <Field label="Contacto del directorio" hint={options.length ? undefined : 'No hay contactos cargados para esta categoría: capture el número utilizado'}>
                <Select value={v.contactId} onChange={(e) => { const c = options.find((x) => x.id === e.target.value); set({ contactId: e.target.value, numberUsed: c?.phone ?? v.numberUsed }); }} placeholder="Seleccione…" options={options.map((c) => ({ value: c.id, label: `${c.name} — ${c.phone}${c.status !== 'VERIFICADO' ? ' (SIN VERIFICAR)' : ''}` }))} />
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Número utilizado"><Input value={v.numberUsed} onChange={(e) => set({ numberUsed: e.target.value })} /></Field>
              <Field label="Hora"><Input type="datetime-local" value={v.at} onChange={(e) => set({ at: e.target.value })} /></Field>
            </div>
            <Field label="Resultado real"><Select value={v.result} onChange={(e) => set({ result: e.target.value })} placeholder="Seleccione el resultado…" options={{ CONFIRMADA: 'Confirmada (atendió / recibió)', SIN_RESPUESTA: 'Sin respuesta', OCUPADO: 'Ocupado', FALLIDA: 'Fallida (no se pudo comunicar)', PENDIENTE_CONFIRMACION: 'Pendiente de confirmación' }} /></Field>
            <Field label="Folio obtenido" hint="Obligatorio para registrar como confirmada (o detalle en notas)"><Input value={v.folioObtained} onChange={(e) => set({ folioObtained: e.target.value })} /></Field>
            <Field label="Notas"><Textarea value={v.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
            {v.channel !== 'LLAMADA_OPERADOR' && v.numberUsed && <a href={`tel:${v.numberUsed}`} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><PhoneCall className="h-4 w-4" />Marcar {v.numberUsed} desde este dispositivo</a>}
          </>;
        }}
      </FormModal>
      <FormModal open={modal === 'escalate'} onClose={() => setModal('')} title={`Escalar a ${inc.currentLevel === 'MONITORISTA' ? 'Gerencia' : 'Operaciones Estratégicas'}`} initial={{ reason: '' }} onSubmit={(v) => escalate.mutateAsync(v)} submitLabel="Escalar">
        {(v, set) => <><Field label="Situación, hallazgos e intentos de contacto"><Textarea rows={4} value={v.reason} onChange={(e) => set({ reason: e.target.value })} /></Field><p className="text-xs text-ink-500">Se notifica en la aplicación al titular y su suplente según la matriz de escalamiento. Confirme además por teléfono.</p></>}
      </FormModal>
      <FormModal open={modal === 'note'} onClose={() => setModal('')} title="Registrar acción" initial={{ message: '' }} onSubmit={(v) => note.mutateAsync(v)}>
        {(v, set) => <Field label="Acción realizada"><Textarea rows={4} value={v.message} onChange={(e) => set({ message: e.target.value })} /></Field>}
      </FormModal>
      <FormModal key={stepKey?.key} open={modal === 'step'} onClose={() => setModal('')} title={stepKey?.title ?? ''} initial={{ outcome: 'REALIZADO', notes: '' }} onSubmit={(v) => step.mutateAsync({ stepKey: stepKey!.key, ...v, notes: v.notes || undefined })}>
        {(v, set) => <><Field label="Resultado"><Select value={v.outcome} onChange={(e) => set({ outcome: e.target.value })} options={{ REALIZADO: 'Realizado', NO_APLICA: 'No aplica', NO_REALIZADO: 'No se pudo realizar' }} /></Field><Field label={v.outcome === 'REALIZADO' ? 'Notas (opcional)' : 'Justificación (obligatoria)'}><Textarea value={v.notes} onChange={(e) => set({ notes: e.target.value })} /></Field></>}
      </FormModal>
      <FormModal open={modal === 'status'} onClose={() => setModal('')} title="Actualizar estado" initial={{ status: 'CONTENIDA', notes: '' }} onSubmit={(v) => status.mutateAsync(v)}>
        {(v, set) => <><Field label="Estado"><Select value={v.status} onChange={(e) => set({ status: e.target.value })} options={{ EN_ATENCION: 'En atención', CONTENIDA: 'Contenida' }} /></Field><Field label="Evidencia"><Textarea value={v.notes} onChange={(e) => set({ notes: e.target.value })} /></Field></>}
      </FormModal>
      <FormModal open={modal === 'closure'} onClose={() => setModal('')} title="Solicitar cierre" initial={{ result: '', justification: '' }} onSubmit={(v) => closure.mutateAsync(v)}>
        {(v, set) => <><Notice tone="amber">El cierre requiere aprobación. No cierre emergencias sin documentar los pasos críticos ni indique que la unidad está segura sin evidencia.</Notice><Field label="Resultado verificado"><Textarea value={v.result} onChange={(e) => set({ result: e.target.value })} /></Field><Field label="Justificación (mín. 20 caracteres)"><Textarea value={v.justification} onChange={(e) => set({ justification: e.target.value })} /></Field></>}
      </FormModal>
      <FormModal open={modal === 'approve'} onClose={() => setModal('')} title="Aprobar cierre" initial={{ approve: 'true', comment: '' }} onSubmit={(v) => approve.mutateAsync({ approve: v.approve === 'true', comment: v.comment })}>
        {(v, set) => <><p className="text-sm">Resultado: <b>{inc.result}</b></p><p className="text-sm">Justificación: {inc.closureJustification}</p><Field label="Decisión"><Select value={v.approve} onChange={(e) => set({ approve: e.target.value })} options={{ true: 'Aprobar cierre', false: 'Rechazar y regresar a atención' }} /></Field><Field label="Comentario"><Textarea value={v.comment} onChange={(e) => set({ comment: e.target.value })} /></Field></>}
      </FormModal>
      <Modal open={modal === 'dossier'} onClose={() => setModal('')} title="Expediente del incidente" wide>
        {!dossier.data ? <Spinner /> : <Dossier d={dossier.data} />}
      </Modal>
    </>
  );
}

function Dossier({ d }: { d: any }) {
  const u = d.unit;
  if (!u) return <p>La incidencia no tiene unidad asociada.</p>;
  const pol = u.policies[0];
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex justify-between gap-3 border-b border-ink-100 py-2 text-sm"><span className="text-ink-500">{k}</span><span className="text-right font-medium">{v ?? '—'}</span></div>;
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h4 className="mb-2 font-semibold">Identificación de la unidad</h4>
        <Row k="Número económico" v={u.economicNumber} /><Row k="Placas" v={u.plates} /><Row k="Número de serie" v={u.vin} /><Row k="Marca / modelo / año" v={`${u.brand ?? ''} ${u.model ?? ''} ${u.year ?? ''}`} />
        <Row k="Remolques / tanques" v={u.couplingsAsMotor.map((c: any) => `${c.trailer.economicNumber} (${c.trailer.plates})`).join(', ') || '—'} />
        <Row k="Proveedor GPS" v={u.devices.map((x: any) => `${x.provider} · ${x.identifier}`).join(', ')} />
        <Row k="Póliza" v={pol ? `${pol.insurer} ${pol.policyNumber} (vence ${new Date(pol.validTo).toLocaleDateString('es-MX')})` : 'No registrada'} />
        <Row k="Tel. siniestros" v={pol?.claimsPhone} />
        <h4 className="mb-2 mt-5 font-semibold">Fotografías y documentos</h4>
        {d.photos.length ? d.photos.map((p: any) => <a key={p.id} href={`/api/documents/${p.id}/download`} target="_blank" rel="noreferrer" className="block text-sm font-semibold text-brand-700">{p.title}</a>) : <p className="text-sm text-ink-500">Sin fotografías cargadas</p>}
      </div>
      <div>
        <h4 className="mb-2 font-semibold">Operador</h4>
        <Row k="Nombre" v={d.operator?.fullName} /><Row k="No. empleado" v={d.operator?.employeeNo} /><Row k="Teléfono" v={d.operator?.phonePrimary} /><Row k="Licencia" v={d.operator?.licenseNumber} />
        <h4 className="mb-2 mt-5 font-semibold">Carga y ruta</h4>
        <Row k="Viaje" v={d.trip?.tripNumber} /><Row k="Cliente" v={d.trip?.client?.name} /><Row k="Producto" v={d.trip?.product} /><Row k="Número ONU" v={d.trip?.unNumber} /><Row k="Volumen" v={d.trip?.volumeLiters ? `${d.trip.volumeLiters} L` : null} /><Row k="Ruta" v={d.trip?.route?.name ?? (d.trip ? `${d.trip.origin} → ${d.trip.destination}` : null)} />
        <Row k="Última ubicación" v={d.lastKnown.lat ? `${d.lastKnown.lat.toFixed(5)}, ${d.lastKnown.lng.toFixed(5)} · ${new Date(d.lastKnown.at).toLocaleString('es-MX')}` : 'No disponible'} />
        {d.hazardDocs.length > 0 && <><h4 className="mb-2 mt-5 font-semibold">Información de emergencia del producto</h4>{d.hazardDocs.map((h: any) => <a key={h.id} href={`/api/documents/${h.id}/download`} target="_blank" rel="noreferrer" className="block text-sm font-semibold text-brand-700">{h.title}</a>)}<p className="mt-1 text-xs text-ink-500">No sustituye los procedimientos técnicos ni las indicaciones de las autoridades.</p></>}
      </div>
    </div>
  );
}
