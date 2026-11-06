import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Plus, AlertTriangle, Link2, Unlink, Crosshair } from 'lucide-react';
import { useApi, useAction, api } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, Empty, Field, Input, Notice, Select, Spinner, StatusBadge, Table, Tabs, Textarea } from '../components/ui';
import { Freshness, SourceTag } from '../components/DataTag';
import { FormModal } from '../components/forms';
import { Documents } from '../components/Documents';
import { fmtDate, fmtDateTime, toLocalInput } from '../lib/format';
import { label } from '../lib/labels';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function UnitDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const [tab, setTab] = useState<'resumen' | 'camaras' | 'docs' | 'polizas' | 'acoples' | 'historial'>('resumen');
  const [modal, setModal] = useState<'' | 'camera' | 'device' | 'policy' | 'couple' | 'position' | 'status' | 'assign'>('');
  const { data: u, isLoading } = useApi<any>(['unit', id], `/units/${id}`);
  const trailers = useApi<any[]>(['units-trailers'], modal === 'couple' ? '/units?type=TANQUE' : null);
  const trailers2 = useApi<any[]>(['units-remolques'], modal === 'couple' ? '/units?type=REMOLQUE' : null);
  const operators = useApi<any[]>(['operators'], modal === 'assign' ? '/operators' : null);
  const inv = [['unit', id], ['fleet']];
  const act = (url: string, msg: string) => useAction((v: any) => api.post(url, v), { invalidate: inv, success: msg });
  const addCam = act(`/units/${id}/cameras`, 'Cámara registrada');
  const addDev = act(`/units/${id}/devices`, 'Dispositivo GPS registrado');
  const addPol = act(`/units/${id}/policies`, 'Póliza registrada');
  const couple = act(`/units/${id}/couple`, 'Acoplamiento registrado');
  const pos = act(`/units/${id}/positions`, 'Posición manual registrada (identificada como captura manual)');
  const status = act(`/units/${id}/status`, 'Estado operativo actualizado');
  const uncouple = useAction((cid: string) => api.post(`/units/couplings/${cid}/uncouple`), { invalidate: inv, success: 'Desacoplado' });
  const assign = useAction((v: any) => api.post(`/operators/${v.operatorId}/assign`, { unitId: id }), { invalidate: inv, success: 'Operador asignado' });
  if (isLoading || !u) return <Spinner />;
  const live = u.live;
  return (
    <>
      <Link to="/flota" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink-800"><ArrowLeft className="h-4 w-4" />Flota</Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3"><h1 className="text-3xl font-bold">{u.economicNumber}</h1><StatusBadge value={u.opStatus} /><SourceTag source={u.dataSource} /></div>
          <p className="mt-1 text-ink-500">{label(u.type)} · {u.plates} · {u.brand ?? ''} {u.model ?? ''} {u.year ?? ''} · Serie {u.vin ?? 'no registrada'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('positions.capture') && <Button variant="secondary" icon={<Crosshair className="h-4 w-4" />} onClick={() => setModal('position')}>Capturar posición</Button>}
          {can('ops.manage', 'units.manage') && <Button variant="secondary" onClick={() => setModal('status')}>Cambiar estado</Button>}
          {can('incidents.manage') && <Link to={`/incidencias?nueva=1&unitId=${u.id}`}><Button variant="danger" icon={<AlertTriangle className="h-4 w-4" />}>Reportar incidencia</Button></Link>}
        </div>
      </div>
      {u.externalSource && (
        <div className="mb-5"><Notice tone="blue">
          <b>Sincronizada desde Optima</b> ({fmtDateTime(u.externalSyncedAt)}): estatus <b>{u.externalStatus ?? '—'}</b>{u.externalLocation && <> · ubicación reportada: <b>{u.externalLocation}</b></>}{u.externalNotes && <> · {u.externalNotes}</>}.
          <span className="block text-xs">La ubicación de Optima es texto capturado; no es una posición GPS.</span>
        </Notice></div>
      )}
      {u.expiring?.length > 0 && <div className="mb-5"><Notice tone="amber">{u.expiring.map((e: any) => `${e.kind} ${e.label}: ${e.expired ? 'VENCIDA' : 'vence'} ${fmtDate(e.expiresAt)}`).join(' · ')}</Notice></div>}
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'resumen', label: 'Resumen' }, { value: 'camaras', label: 'Cámaras y GPS', count: u.cameras.length }, { value: 'docs', label: 'Documentos y fotos', count: u.documents.length }, { value: 'polizas', label: 'Pólizas', count: u.policies.length }, { value: 'acoples', label: 'Remolques / tanques' }, { value: 'historial', label: 'Historial' }]} />
      {tab === 'resumen' && (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card title="Última posición" className="lg:col-span-2">
            {live?.position ? (
              <div className="space-y-2">
                <p className="flex items-center gap-2 font-mono"><MapPin className="h-4 w-4 text-brand-700" />{live.position.lat.toFixed(5)}, {live.position.lng.toFixed(5)}</p>
                <p className="text-sm text-ink-600">{live.position.address ?? 'Sin dirección'} · {live.position.speedKph ?? '—'} km/h</p>
                <p className="text-sm text-ink-500">Registrada {fmtDateTime(live.position.recordedAt)}</p>
                <div className="flex gap-2"><Freshness value={live.freshness} at={live.position.recordedAt} /><SourceTag source={live.position.source} /></div>
                <a className="text-sm font-semibold text-brand-700" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${live.position.lat}&mlon=${live.position.lng}#map=13/${live.position.lat}/${live.position.lng}`}>Ver en mapa →</a>
              </div>
            ) : <Empty title="Sin posición disponible">No existe información de GPS. Capture una posición verificada o valide con el proveedor.</Empty>}
          </Card>
          <Card title="Operador asignado" action={can('operators.manage') && <Button size="sm" variant="secondary" onClick={() => setModal('assign')}>Cambiar</Button>}>
            {live?.operator ? <><p className="font-semibold">{live.operator.fullName}</p>{live.operator.phonePrimary && <a href={`tel:${live.operator.phonePrimary}`} className="text-sm font-semibold text-brand-700">Llamar {live.operator.phonePrimary}</a>}</> : <p className="text-ink-500">Sin operador asignado</p>}
            <p className="mt-4 text-xs font-semibold uppercase text-ink-500">Historial de asignaciones</p>
            {u.assignments.map((a: any) => <p key={a.id} className="text-sm text-ink-600">{a.operator.fullName} · {fmtDate(a.startAt)} – {a.endAt ? fmtDate(a.endAt) : 'vigente'}</p>)}
          </Card>
        </div>
      )}
      {tab === 'camaras' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Cámaras instaladas" action={can('units.manage') && <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setModal('camera')}>Agregar</Button>} padded={false}>
            <Table head={['Cámara', 'Canal', 'Estado', 'Desde']} empty={!u.cameras.length}>{u.cameras.map((c: any) => <tr key={c.id}><td className="font-medium">{c.label}</td><td>{c.channel ?? '—'}</td><td><StatusBadge value={c.status} /></td><td>{fmtDateTime(c.statusAt)}</td></tr>)}</Table>
          </Card>
          <Card title="Dispositivos GPS" action={can('units.manage') && <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setModal('device')}>Agregar</Button>} padded={false}>
            <Table head={['Proveedor', 'Identificador', 'Inmovilizador']} empty={!u.devices.length}>{u.devices.map((d: any) => <tr key={d.id}><td>{d.provider}</td><td className="font-mono text-xs">{d.identifier}</td><td>{d.supportsImmobilizer ? <Badge tone={d.immobilizerIntegrationValidated ? 'green' : 'amber'}>{d.immobilizerIntegrationValidated ? 'Integración validada' : 'Disponible · sin integración'}</Badge> : 'No'}</td></tr>)}</Table>
          </Card>
        </div>
      )}
      {tab === 'docs' && <Card><Documents entityType="Unit" entityId={u.id} defaultCategory="FOTOGRAFIA" /></Card>}
      {tab === 'polizas' && (
        <Card title="Pólizas de seguro" action={can('units.manage') && <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setModal('policy')}>Agregar póliza</Button>} padded={false}>
          <Table head={['Aseguradora', 'Póliza', 'Cobertura', 'Vigencia', 'Siniestros']} empty={!u.policies.length}>{u.policies.map((p: any) => <tr key={p.id}><td>{p.insurer}</td><td className="font-medium">{p.policyNumber}</td><td>{p.coverage ?? '—'}</td><td>{fmtDate(p.validFrom)} – {fmtDate(p.validTo)} {new Date(p.validTo) < new Date() && <Badge tone="red">Vencida</Badge>}</td><td>{p.claimsPhone ?? '—'}</td></tr>)}</Table>
        </Card>
      )}
      {tab === 'acoples' && (
        <Card title="Remolques y tanques acoplados" action={can('units.manage') && ['TRACTOCAMION', 'AUTOTANQUE'].includes(u.type) && <Button size="sm" icon={<Link2 className="h-4 w-4" />} onClick={() => setModal('couple')}>Acoplar</Button>} padded={false}>
          <Table head={['Unidad', 'Tipo', 'Posición', 'Desde', 'Hasta', '']} empty={!u.couplingsAsMotor.length}>{u.couplingsAsMotor.map((c: any) => <tr key={c.id}><td className="font-medium">{c.trailer.economicNumber}</td><td>{label(c.trailer.type)}</td><td>{c.position}</td><td>{fmtDateTime(c.coupledAt)}</td><td>{c.uncoupledAt ? fmtDateTime(c.uncoupledAt) : <Badge tone="green">Vigente</Badge>}</td><td>{!c.uncoupledAt && can('units.manage') && <Button size="sm" variant="ghost" icon={<Unlink className="h-4 w-4" />} onClick={() => uncouple.mutate(c.id)}>Desacoplar</Button>}</td></tr>)}</Table>
        </Card>
      )}
      {tab === 'historial' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Incidencias" padded={false}><Table head={['Folio', 'Título', 'Estado', 'Fecha']} empty={!u.incidents.length}>{u.incidents.map((i: any) => <tr key={i.id}><td><Link className="font-semibold text-brand-700" to={`/incidencias/${i.id}`}>{i.folio}</Link></td><td>{i.title}</td><td><StatusBadge value={i.status} /></td><td>{fmtDate(i.openedAt)}</td></tr>)}</Table></Card>
          <Card title="Posiciones recientes" padded={false}><Table head={['Fecha', 'Coordenadas', 'Vel.', 'Origen']} empty={!u.positions.length}>{u.positions.map((p: any) => <tr key={p.id}><td>{fmtDateTime(p.recordedAt)}</td><td className="font-mono text-xs">{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</td><td>{p.speedKph ?? '—'}</td><td><SourceTag source={p.source} /></td></tr>)}</Table></Card>
        </div>
      )}

      <FormModal open={modal === 'camera'} onClose={() => setModal('')} title="Agregar cámara" initial={{ label: '', channel: '' }} onSubmit={(v) => addCam.mutateAsync({ label: v.label, channel: v.channel ? Number(v.channel) : undefined })}>
        {(v, set) => <><Field label="Ubicación / nombre"><Input value={v.label} onChange={(e) => set({ label: e.target.value })} placeholder="Frontal, Cabina…" /></Field><Field label="Canal"><Input type="number" value={v.channel} onChange={(e) => set({ channel: e.target.value })} /></Field></>}
      </FormModal>
      <FormModal open={modal === 'device'} onClose={() => setModal('')} title="Agregar dispositivo GPS" initial={{ provider: '', identifier: '', model: '', supportsImmobilizer: 'false' }} onSubmit={(v) => addDev.mutateAsync({ ...v, supportsImmobilizer: v.supportsImmobilizer === 'true' })}>
        {(v, set) => <><Field label="Proveedor GPS"><Input value={v.provider} onChange={(e) => set({ provider: e.target.value })} /></Field><Field label="Identificador (IMEI / ID)"><Input value={v.identifier} onChange={(e) => set({ identifier: e.target.value })} /></Field><Field label="Modelo"><Input value={v.model} onChange={(e) => set({ model: e.target.value })} /></Field><Field label="¿El equipo cuenta con función de inmovilización?" hint="Dato del fabricante. No habilita comandos."><Select value={v.supportsImmobilizer} onChange={(e) => set({ supportsImmobilizer: e.target.value })} options={{ false: 'No', true: 'Sí' }} /></Field></>}
      </FormModal>
      <FormModal open={modal === 'policy'} onClose={() => setModal('')} title="Registrar póliza" initial={{ insurer: '', policyNumber: '', coverage: '', validFrom: '', validTo: '', claimsPhone: '' }} onSubmit={(v) => addPol.mutateAsync(v)}>
        {(v, set) => <div className="grid gap-4 sm:grid-cols-2"><Field label="Aseguradora"><Input value={v.insurer} onChange={(e) => set({ insurer: e.target.value })} /></Field><Field label="Número de póliza"><Input value={v.policyNumber} onChange={(e) => set({ policyNumber: e.target.value })} /></Field><Field label="Vigencia desde"><Input type="date" value={v.validFrom} onChange={(e) => set({ validFrom: e.target.value })} /></Field><Field label="Vigencia hasta"><Input type="date" value={v.validTo} onChange={(e) => set({ validTo: e.target.value })} /></Field><Field label="Cobertura"><Input value={v.coverage} onChange={(e) => set({ coverage: e.target.value })} /></Field><Field label="Teléfono de siniestros (verificado)"><Input value={v.claimsPhone} onChange={(e) => set({ claimsPhone: e.target.value })} /></Field></div>}
      </FormModal>
      <FormModal open={modal === 'couple'} onClose={() => setModal('')} title="Acoplar remolque o tanque" initial={{ trailerId: '', position: '1' }} onSubmit={(v) => couple.mutateAsync({ trailerId: v.trailerId, position: Number(v.position) })}>
        {(v, set) => <><Field label="Remolque / tanque"><Select value={v.trailerId} onChange={(e) => set({ trailerId: e.target.value })} placeholder="Seleccione…" options={[...(trailers.data ?? []), ...(trailers2.data ?? [])].map((t) => ({ value: t.id, label: `${t.economicNumber} (${label(t.type)})` }))} /></Field><Field label="Posición"><Select value={v.position} onChange={(e) => set({ position: e.target.value })} options={{ 1: '1 (primero)', 2: '2 (full)', 3: '3' }} /></Field></>}
      </FormModal>
      <FormModal open={modal === 'position'} onClose={() => setModal('')} title="Capturar posición verificada" initial={{ lat: '', lng: '', speedKph: '0', recordedAt: toLocalInput(), address: '', verification: '' }} onSubmit={(v) => pos.mutateAsync({ lat: Number(v.lat), lng: Number(v.lng), speedKph: Number(v.speedKph), recordedAt: new Date(v.recordedAt).toISOString(), address: v.address || undefined, verification: v.verification })}>
        {(v, set) => <><Notice tone="blue">Se registrará como <b>captura manual</b>, nunca como dato en vivo.</Notice><div className="grid gap-4 sm:grid-cols-2"><Field label="Latitud"><Input value={v.lat} onChange={(e) => set({ lat: e.target.value })} /></Field><Field label="Longitud"><Input value={v.lng} onChange={(e) => set({ lng: e.target.value })} /></Field><Field label="Velocidad (km/h)"><Input type="number" value={v.speedKph} onChange={(e) => set({ speedKph: e.target.value })} /></Field><Field label="Hora de la posición"><Input type="datetime-local" value={v.recordedAt} onChange={(e) => set({ recordedAt: e.target.value })} /></Field></div><Field label="Referencia"><Input value={v.address} onChange={(e) => set({ address: e.target.value })} /></Field><Field label="¿Cómo se verificó?"><Textarea value={v.verification} onChange={(e) => set({ verification: e.target.value })} placeholder="Plataforma del proveedor, llamada con el operador…" /></Field></>}
      </FormModal>
      <FormModal open={modal === 'status'} onClose={() => setModal('')} title="Cambiar estado operativo" initial={{ opStatus: u.opStatus, notes: '' }} onSubmit={(v) => status.mutateAsync(v)}>
        {(v, set) => <><Field label="Estado"><Select value={v.opStatus} onChange={(e) => set({ opStatus: e.target.value })} options={['EN_TRANSITO', 'DETENIDA', 'RESGUARDADA', 'EN_PATIO', 'EN_PENSION', 'MANTENIMIENTO', 'FUERA_DE_SERVICIO'].map((x) => ({ value: x, label: label(x) }))} /></Field><Field label="Motivo"><Textarea value={v.notes} onChange={(e) => set({ notes: e.target.value })} /></Field></>}
      </FormModal>
      <FormModal open={modal === 'assign'} onClose={() => setModal('')} title="Asignar operador" initial={{ operatorId: '' }} onSubmit={(v) => assign.mutateAsync(v)}>
        {(v, set) => <Field label="Operador" hint="La asignación anterior se cierra y queda en el historial"><Select value={v.operatorId} onChange={(e) => set({ operatorId: e.target.value })} placeholder="Seleccione…" options={(operators.data ?? []).filter((o) => o.status !== 'BAJA').map((o) => ({ value: o.id, label: `${o.fullName} (${o.employeeNo})` }))} /></Field>}
      </FormModal>
    </>
  );
}
