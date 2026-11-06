import { forwardRef, useRef, useState } from 'react';
import { Plus, FileText, Download, Share2, Mail, Info } from 'lucide-react';
import { useApi, useAction, api } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import { Button, Card, Check, Empty, Field, Input, Notice, PageHeader, Select, Spinner, StatusBadge, Table, Textarea } from '../components/ui';
import { FormModal } from '../components/forms';
import { exportPdf, exportPng, shareImage } from '../lib/export';
import { fmtDateTime, toLocalInput } from '../lib/format';
import { label } from '../lib/labels';
import logo from '../logo.svg';

/* eslint-disable @typescript-eslint/no-explicit-any */
const TRIP_STATUS = ['PROGRAMADO', 'EN_TRASLADO_A_CARGA', 'EN_CARGA', 'CARGADO', 'EN_TRANSITO', 'EN_RESGUARDO', 'EN_DESCARGA', 'DESCARGADO', 'FINALIZADO', 'CON_INCIDENCIA'];

const Comanda = forwardRef<HTMLDivElement, { s: any }>(({ s }, ref) => {
  const Row = ({ k, v }: { k: string; v: any }) => <div className="flex justify-between gap-4 border-b border-ink-100 py-2 text-sm"><span className="text-ink-500">{k}</span><span className="text-right font-semibold text-ink-900">{v ?? '—'}</span></div>;
  return (
    <div ref={ref} className="force-light w-full max-w-[520px] overflow-hidden rounded-3xl bg-surface ring-1 ring-ink-200" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="flex items-center gap-3 bg-gradient-to-br from-brand-700 to-brand-900 px-6 py-5 text-white"><img src={logo} className="h-9 w-9" alt="" /><div><p className="text-sm font-bold">Reporte de estatus de servicio</p><p className="text-xs text-brand-100">Centro Inteligente de Monitoreo</p></div></div>
      <div className="px-6 py-5">
        <div className="mb-3 flex items-center justify-between"><p className="text-lg font-bold">{s.client}</p><span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-800">{label(s.status)}</span></div>
        <Row k="Número de viaje" v={s.tripNumber} /><Row k="Tractocamión" v={s.economicNumber} /><Row k="Tanques / remolques" v={s.trailers?.join(', ') || '—'} />
        {s.operator && <Row k="Operador" v={s.operator} />}
        <Row k="Origen" v={s.origin} /><Row k="Destino" v={s.destination} /><Row k="Ubicación" v={s.currentLocation} />
        <Row k="Última actualización" v={fmtDateTime(s.lastUpdate)} /><Row k="Hora estimada de llegada" v={s.eta ? fmtDateTime(s.eta) : 'Sin información suficiente'} />
        {s.observations && <p className="mt-3 rounded-xl bg-ink-50 p-3 text-sm text-ink-700">{s.observations}</p>}
      </div>
      <div className="flex justify-between bg-ink-50 px-6 py-3 text-[11px] text-ink-500"><span>{s.folio ?? 'Vista previa'}</span><span>Información confidencial para el cliente</span></div>
    </div>
  );
});

export function StatusReportsPage() {
  const { can } = useAuth();
  const [trip, setTrip] = useState<any>(null);
  const [opts, setOpts] = useState({ includeOperator: false, observations: '' });
  const [report, setReport] = useState<any>(null);
  const [modal, setModal] = useState<'' | 'trip' | 'status' | 'shared'>('');
  const [sharedVia, setSharedVia] = useState('WHATSAPP');
  const ref = useRef<HTMLDivElement>(null);
  const trips = useApi<any[]>(['trips'], '/status/trips');
  const [pv, setPv] = useState<any>(null);
  const clients = useApi<any[]>(['clients'], modal === 'trip' ? '/catalogs/clients' : null);
  const routes = useApi<any[]>(['routes'], modal === 'trip' ? '/catalogs/routes' : null);
  const fleet = useApi<any[]>(['fleet', null], modal === 'trip' ? '/units/fleet' : null);
  const ops = useApi<any[]>(['operators', '', ''], modal === 'trip' ? '/operators' : null);
  const load = async (t: any, o = opts) => { setTrip(t); setReport(null); setPv(await api.post(`/status/trips/${t.id}/preview`, o)); };
  const gen = useAction((v: any) => api.post<any>(`/status/trips/${trip.id}/reports`, v), { success: (r) => `Comanda ${r.folio} generada`, onSuccess: (r) => setReport(r) });
  const shared = useAction((v: any) => api.post(`/status/reports/${report.id}/shared`, v), { success: 'Envío registrado' });
  const createTrip = useAction((v: any) => api.post('/status/trips', v), { invalidate: [['trips']], success: 'Viaje registrado' });
  const setStatus = useAction((v: any) => api.post(`/status/trips/${trip.id}/status`, v), { invalidate: [['trips']], success: 'Estado del viaje actualizado', onSuccess: () => load(trip) });
  const snap = report?.snapshot ?? pv?.snapshot;
  const text = snap ? `*Estatus de servicio ${snap.folio ?? ''}*\nCliente: ${snap.client}\nViaje: ${snap.tripNumber}\nUnidad: ${snap.economicNumber}\nEstado: ${label(snap.status)}\nUbicación: ${snap.currentLocation}\nÚltima actualización: ${fmtDateTime(snap.lastUpdate)}\nETA: ${snap.eta ? fmtDateTime(snap.eta) : 'Sin información suficiente'}${snap.observations ? `\nObservaciones: ${snap.observations}` : ''}` : '';
  return (
    <>
      <PageHeader title="Estatus para clientes" subtitle="Comandas estandarizadas sin datos sensibles de seguridad" actions={can('trips.manage') && <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setModal('trip')}>Nuevo viaje</Button>} />
      <div className="grid gap-5 xl:grid-cols-[1fr_560px]">
        <Card title="Viajes activos" padded={false}>
          {trips.isLoading ? <Spinner /> : <Table head={['Viaje', 'Cliente', 'Unidad', 'Ruta', 'Estado', '']} empty={!trips.data?.length}>
            {trips.data?.map((t) => <tr key={t.id} className={trip?.id === t.id ? 'bg-brand-50' : ''}><td className="font-semibold">{t.tripNumber}</td><td>{t.client.name}</td><td>{t.unit.economicNumber}</td><td>{t.origin} → {t.destination}</td><td><StatusBadge value={t.status} /></td><td>{can('status.create') && <Button size="sm" variant="secondary" icon={<FileText className="h-4 w-4" />} onClick={() => load(t)}>Comanda</Button>}</td></tr>)}
          </Table>}
        </Card>
        <div>
          {!trip ? <Card><Empty title="Seleccione un viaje para generar su comanda" /></Card> : (
            <Card title={`Comanda · ${trip.tripNumber}`} action={<Button size="sm" variant="ghost" onClick={() => setModal('status')}>Actualizar estado</Button>}>
              {pv && <div className="mb-4 space-y-3">
                {!pv.permissions.canSeeApproxLocation && <Notice tone="blue" icon={<Info className="h-5 w-5 shrink-0" />}>Este cliente no está autorizado para ver ubicación.</Notice>}
                {pv.permissions.canSeeOperator ? <Check checked={opts.includeOperator} onChange={(b) => { const o = { ...opts, includeOperator: b }; setOpts(o); load(trip, o); }} label="Incluir nombre del operador" /> : <p className="text-xs text-ink-500">El cliente no está autorizado para ver el nombre del operador.</p>}
                <Field label="Observaciones para el cliente"><Textarea value={opts.observations} onChange={(e) => setOpts({ ...opts, observations: e.target.value })} onBlur={() => load(trip)} /></Field>
              </div>}
              {snap && <div className="flex justify-center"><Comanda ref={ref} s={snap} /></div>}
              <div className="mt-4 flex flex-wrap gap-2">
                {!report ? <Button loading={gen.isPending} onClick={() => gen.mutate(opts)}>Generar comanda oficial</Button> : <>
                  <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => ref.current && exportPng(ref.current, `${report.folio}.png`)}>PNG</Button>
                  <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => ref.current && exportPdf(ref.current, `${report.folio}.pdf`)}>PDF</Button>
                  <Button icon={<Share2 className="h-4 w-4" />} onClick={async () => { if (ref.current) { await shareImage(ref.current, `${report.folio}.png`, text); setSharedVia('WHATSAPP'); setModal('shared'); } }}>WhatsApp</Button>
                  <a href={`mailto:?subject=${encodeURIComponent(`Estatus de servicio ${snap.tripNumber}`)}&body=${encodeURIComponent(text.replace(/\*/g, ''))}`} onClick={() => { setSharedVia('CORREO'); setTimeout(() => setModal('shared'), 300); }}><Button variant="secondary" icon={<Mail className="h-4 w-4" />}>Correo</Button></a>
                </>}
              </div>
            </Card>
          )}
        </div>
      </div>
      <FormModal open={modal === 'shared'} onClose={() => setModal('')} title="¿A quién se envió?" initial={{ to: '' }} onSubmit={(v) => shared.mutateAsync({ via: sharedVia, to: v.to })} submitLabel="Registrar envío">
        {(v, set) => <><p className="text-sm text-ink-500">Registre el envío solo si efectivamente se realizó.</p><Field label="Destinatario"><Input value={v.to} onChange={(e) => set({ to: e.target.value })} /></Field></>}
      </FormModal>
      <FormModal key={trip?.id ?? 's'} open={modal === 'status'} onClose={() => setModal('')} title="Estado del viaje" initial={{ status: trip?.status ?? 'EN_TRANSITO', eta: '', etaSource: '', observations: '' }} onSubmit={(v) => setStatus.mutateAsync({ status: v.status, eta: v.eta ? new Date(v.eta).toISOString() : null, etaSource: v.etaSource || null, observations: v.observations || undefined })}>
        {(v, set) => <><Field label="Estado"><Select value={v.status} onChange={(e) => set({ status: e.target.value })} options={TRIP_STATUS.map((s) => ({ value: s, label: label(s) }))} /></Field><Field label="Hora estimada de llegada (opcional)"><Input type="datetime-local" value={v.eta} onChange={(e) => set({ eta: e.target.value })} /></Field>{v.eta && <Field label="Base del cálculo (obligatoria)"><Input value={v.etaSource} onChange={(e) => set({ etaSource: e.target.value })} placeholder="Distancia restante y velocidad promedio…" /></Field>}<Field label="Observaciones"><Textarea value={v.observations} onChange={(e) => set({ observations: e.target.value })} /></Field></>}
      </FormModal>
      <FormModal open={modal === 'trip'} onClose={() => setModal('')} wide title="Registrar viaje" initial={{ tripNumber: '', clientId: '', routeId: '', unitId: '', operatorId: '', trailerIds: '', product: '', unNumber: '', volumeLiters: '', origin: 'Nuevo Laredo', destination: '', scheduledStart: toLocalInput() }}
        onSubmit={(v) => createTrip.mutateAsync({ ...v, routeId: v.routeId || null, operatorId: v.operatorId || null, trailerIds: v.trailerIds.split(',').map((x) => x.trim()).filter(Boolean), unNumber: v.unNumber || null, volumeLiters: v.volumeLiters ? Number(v.volumeLiters) : undefined, product: v.product || undefined, scheduledStart: new Date(v.scheduledStart).toISOString() })}>
        {(v, set) => <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Número de viaje"><Input value={v.tripNumber} onChange={(e) => set({ tripNumber: e.target.value })} /></Field>
          <Field label="Cliente"><Select value={v.clientId} onChange={(e) => set({ clientId: e.target.value })} placeholder="Seleccione…" options={(clients.data ?? []).map((c) => ({ value: c.id, label: c.name }))} /></Field>
          <Field label="Unidad"><Select value={v.unitId} onChange={(e) => set({ unitId: e.target.value })} placeholder="Seleccione…" options={(fleet.data ?? []).map((u) => ({ value: u.id, label: u.economicNumber }))} /></Field>
          <Field label="Operador"><Select value={v.operatorId} onChange={(e) => set({ operatorId: e.target.value })} placeholder="—" options={(ops.data ?? []).map((o) => ({ value: o.id, label: o.fullName }))} /></Field>
          <Field label="Ruta"><Select value={v.routeId} onChange={(e) => set({ routeId: e.target.value })} placeholder="—" options={(routes.data ?? []).map((r) => ({ value: r.id, label: r.name }))} /></Field>
          <Field label="Tanques / remolques" hint="Separados por coma"><Input value={v.trailerIds} onChange={(e) => set({ trailerIds: e.target.value })} /></Field>
          <Field label="Origen"><Input value={v.origin} onChange={(e) => set({ origin: e.target.value })} /></Field>
          <Field label="Destino"><Input value={v.destination} onChange={(e) => set({ destination: e.target.value })} /></Field>
          <Field label="Producto"><Input value={v.product} onChange={(e) => set({ product: e.target.value })} /></Field>
          <Field label="Número ONU"><Input value={v.unNumber} onChange={(e) => set({ unNumber: e.target.value })} placeholder="UN1203" /></Field>
          <Field label="Volumen (L)"><Input type="number" value={v.volumeLiters} onChange={(e) => set({ volumeLiters: e.target.value })} /></Field>
          <Field label="Salida programada"><Input type="datetime-local" value={v.scheduledStart} onChange={(e) => set({ scheduledStart: e.target.value })} /></Field>
        </div>}
      </FormModal>
    </>
  );
}
