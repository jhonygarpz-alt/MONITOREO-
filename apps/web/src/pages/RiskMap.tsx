import { useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Polygon, Popup, Tooltip } from 'react-leaflet';
import { Plus, Upload, ShieldCheck, Info } from 'lucide-react';
import { useApi, useAction, api } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, Empty, Field, Input, Notice, PageHeader, Select, Spinner, StatusBadge, Table, Tabs, Textarea } from '../components/ui';
import { FormModal } from '../components/forms';
import { useToast } from '../components/toast';
import { fmtDate } from '../lib/format';

/* eslint-disable @typescript-eslint/no-explicit-any */
const KIND = { TRAMO_ALTO_RIESGO: 'Tramo de alto riesgo', ZONA_INCIDENCIAS: 'Zona con incidencias', PARADA_PERMITIDA: 'Parada permitida', PARADA_RESTRINGIDA: 'Parada restringida', RUTA_ALTERNA: 'Ruta alterna verificada' };
const CAT = { RIESGO_DOCUMENTADO: 'Riesgo documentado', INCIDENTE_INTERNO: 'Incidente interno', RESTRICCION_PREVENTIVA: 'Restricción preventiva corporativa' };
const LEVEL = { BAJO: 'Bajo', MEDIO: 'Medio', ALTO: 'Alto', MUY_ALTO: 'Muy alto' };
const levelColor = (l: string) => ({ BAJO: '#43A86F', MEDIO: '#F59E0B', ALTO: '#EA580C', MUY_ALTO: '#DC2626' }[l] ?? '#66707A');

export function RiskMapPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<'map' | 'catalog'>('map');
  const [layers, setLayers] = useState({ features: true, havens: true, units: true, pending: false });
  const [create, setCreate] = useState(false);
  const [validate, setValidate] = useState<{ kind: 'feature' | 'haven'; item: any } | null>(null);
  const [haven, setHaven] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const features = useApi<any[]>(['risk'], '/risk/features');
  const havens = useApi<any[]>(['havens'], '/route/havens');
  const fleet = useApi<any[]>(['fleet', null], '/units/fleet');
  const corridors = useApi<any[]>(['corridors'], '/catalogs/corridors');
  const inv = [['risk'], ['havens']];
  const save = useAction((v: any) => api.post('/risk/features', v), { invalidate: inv, success: 'Registro capturado: pendiente de validación' });
  const saveHaven = useAction((v: any) => api.post('/route/havens', v), { invalidate: inv, success: 'Punto de resguardo capturado: pendiente de validación' });
  const val = useAction((v: any) => api.post(v.kind === 'feature' ? `/risk/features/${v.id}/validate` : `/route/havens/${v.id}/validate`, v), { invalidate: inv, success: 'Validación registrada' });
  const imp = useAction((fc: any) => api.post<{ imported: number }>('/risk/import', fc), { invalidate: inv, success: (r) => `${r.imported} registros importados (pendientes de validación)` });
  const visibleFeatures = useMemo(() => (features.data ?? []).filter((f) => layers.pending || f.validation === 'VALIDADO'), [features.data, layers.pending]);
  const visibleHavens = (havens.data ?? []).filter((h) => layers.pending || h.validation === 'VALIDADO');

  return (
    <>
      <PageHeader title="Mapa nacional de riesgos" subtitle="Solo información verificada y con fuente. Nada se precarga ni se infiere." actions={can('risk.manage') && <>
        <Button variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => file.current?.click()}>Importar GeoJSON</Button>
        <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setHaven(true)}>Punto de resguardo</Button>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreate(true)}>Zona o tramo</Button>
        <input ref={file} type="file" accept=".json,.geojson,application/json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { imp.mutate(JSON.parse(await f.text())); } catch { toast('Archivo GeoJSON inválido', 'error'); } e.target.value = ''; }} />
      </>} />
      <div className="mb-4"><Notice tone="blue" icon={<Info className="h-5 w-5 shrink-0" />}>Se distinguen <b>riesgos documentados</b> (fuente externa), <b>incidentes internos</b> y <b>restricciones preventivas corporativas</b>. Cada registro requiere fuente, fecha y validación antes de mostrarse operativamente.</Notice></div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'map', label: 'Mapa' }, { value: 'catalog', label: 'Catálogo', count: (features.data?.length ?? 0) + (havens.data?.length ?? 0) }]} />
      {tab === 'map' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <div className="card overflow-hidden p-0" style={{ height: '68vh' }}>
            <MapContainer center={[25.9, -100.2]} zoom={7} style={{ height: '100%', width: '100%' }}>
              <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {layers.features && visibleFeatures.map((f) => <FeatureShape key={f.id} f={f} />)}
              {layers.havens && visibleHavens.map((h) => (
                <CircleMarker key={h.id} center={[h.lat, h.lng]} radius={9} pathOptions={{ color: '#0F6B3A', fillColor: '#ffffff', fillOpacity: 1, weight: 4, dashArray: h.validation === 'VALIDADO' ? undefined : '4' }}>
                  <Popup><b>{h.name}</b><br />Resguardo · {h.validation}<br />Fuente: {h.source}</Popup>
                </CircleMarker>
              ))}
              {layers.units && (fleet.data ?? []).filter((u) => u.position).map((u) => (
                <CircleMarker key={u.id} center={[u.position.lat, u.position.lng]} radius={6} pathOptions={{ color: u.freshness === 'ACTUALIZADA' ? '#167A45' : u.freshness === 'ATRASADA' ? '#D97706' : '#DC2626', fillOpacity: 0.9 }}>
                  <Tooltip>{u.economicNumber} · {u.position.source === 'DEMO' ? 'DEMO' : u.position.source === 'MANUAL' ? 'Manual' : 'GPS'} · {u.freshness}</Tooltip>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
          <Card title="Capas">
            <div className="space-y-2 text-sm">
              {([['features', 'Zonas, tramos y paradas'], ['havens', 'Puntos de resguardo'], ['units', 'Unidades (última posición)'], ['pending', 'Incluir registros no validados']] as const).map(([k, l]) => (
                <label key={k} className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-brand-700" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} />{l}</label>
              ))}
            </div>
            <div className="mt-5 space-y-1.5 text-xs">{Object.entries(LEVEL).map(([k, l]) => <p key={k} className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: levelColor(k) }} />Riesgo {l.toLowerCase()}</p>)}</div>
            {!visibleFeatures.length && <p className="mt-5 text-xs text-ink-500">No hay zonas validadas. Capture o importe información verificada.</p>}
          </Card>
        </div>
      )}
      {tab === 'catalog' && (
        <div className="space-y-5">
          <Card title="Zonas, tramos y paradas" padded={false}>
            {features.isLoading ? <Spinner /> : !features.data?.length ? <Empty title="Sin registros">Capture o importe información verificada con su fuente.</Empty> : (
              <Table head={['Nombre', 'Tipo', 'Categoría', 'Estado / carretera', 'Nivel', 'Fuente', 'Actualizado', 'Validación', '']}>
                {features.data.map((f) => <tr key={f.id}><td className="font-medium">{f.name}<p className="text-xs text-ink-500">{f.reason}</p></td><td>{KIND[f.kind as keyof typeof KIND]}</td><td>{CAT[f.category as keyof typeof CAT]}</td><td>{f.state}{f.highway && ` · ${f.highway}`}</td><td><Badge tone={f.level === 'BAJO' ? 'green' : f.level === 'MEDIO' ? 'amber' : 'red'}>{LEVEL[f.level as keyof typeof LEVEL]}</Badge></td><td className="max-w-[180px] truncate">{f.source}</td><td>{fmtDate(f.updatedAt)}</td><td><StatusBadge value={f.validation} /></td><td>{can('risk.validate') && <Button size="sm" variant="ghost" icon={<ShieldCheck className="h-4 w-4" />} onClick={() => setValidate({ kind: 'feature', item: f })}>Validar</Button>}</td></tr>)}
              </Table>
            )}
          </Card>
          <Card title="Puntos de resguardo autorizados" padded={false}>
            <Table head={['Nombre', 'Estado', 'Carretera', 'Coordenadas', 'Fuente', 'Validación', '']} empty={!havens.data?.length}>
              {havens.data?.map((h) => <tr key={h.id}><td className="font-medium">{h.name}</td><td>{h.state}</td><td>{h.highway ?? '—'} {h.kmMarker && `km ${h.kmMarker}`}</td><td className="font-mono text-xs">{h.lat.toFixed(4)}, {h.lng.toFixed(4)}</td><td className="max-w-[200px] truncate">{h.source}</td><td><StatusBadge value={h.validation} /></td><td>{can('risk.validate') && <Button size="sm" variant="ghost" onClick={() => setValidate({ kind: 'haven', item: h })}>Validar</Button>}</td></tr>)}
            </Table>
          </Card>
        </div>
      )}
      <FormModal open={create} onClose={() => setCreate(false)} wide title="Capturar zona, tramo o parada" initial={{ kind: 'TRAMO_ALTO_RIESGO', category: 'RIESGO_DOCUMENTADO', name: '', state: '', highway: '', corridorId: '', level: 'ALTO', reason: '', source: '', sourceDate: '', preventiveMeasures: '', circulationHours: '', coords: '' }}
        onSubmit={(v) => {
          const pts = v.coords.trim().split(/\n|;/).map((l) => l.split(',').map((x) => Number(x.trim()))).filter((p) => p.length === 2 && p.every((n) => !isNaN(n))).map(([lat, lng]) => [lng, lat]);
          const geometry = pts.length === 1 ? { type: 'Point', coordinates: pts[0] } : v.kind === 'ZONA_INCIDENCIAS' && pts.length >= 3 ? { type: 'Polygon', coordinates: [[...pts, pts[0]]] } : { type: 'LineString', coordinates: pts };
          return save.mutateAsync({ ...v, geometry, coords: undefined, corridorId: v.corridorId || null, sourceDate: v.sourceDate || null });
        }}>
        {(v, set) => <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo"><Select value={v.kind} onChange={(e) => set({ kind: e.target.value })} options={KIND} /></Field>
          <Field label="Categoría"><Select value={v.category} onChange={(e) => set({ category: e.target.value })} options={CAT} /></Field>
          <Field label="Nombre"><Input value={v.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Nivel de riesgo"><Select value={v.level} onChange={(e) => set({ level: e.target.value })} options={LEVEL} /></Field>
          <Field label="Estado"><Input value={v.state} onChange={(e) => set({ state: e.target.value })} /></Field>
          <Field label="Carretera o tramo"><Input value={v.highway} onChange={(e) => set({ highway: e.target.value })} /></Field>
          <Field label="Corredor"><Select value={v.corridorId} onChange={(e) => set({ corridorId: e.target.value })} placeholder="—" options={(corridors.data ?? []).map((c) => ({ value: c.id, label: c.name }))} /></Field>
          <Field label="Horario de circulación establecido"><Input value={v.circulationHours} onChange={(e) => set({ circulationHours: e.target.value })} /></Field>
          <Field label="Fuente de información (obligatoria)" className="sm:col-span-2"><Input value={v.source} onChange={(e) => set({ source: e.target.value })} placeholder="Documento, autoridad o registro interno" /></Field>
          <Field label="Fecha de la fuente"><Input type="date" value={v.sourceDate} onChange={(e) => set({ sourceDate: e.target.value })} /></Field>
          <Field label="Motivo"><Input value={v.reason} onChange={(e) => set({ reason: e.target.value })} /></Field>
          <Field label="Coordenadas (lat, lng por línea)" hint="1 punto = ubicación; 2+ = tramo; 3+ en zona = polígono" className="sm:col-span-2"><Textarea value={v.coords} onChange={(e) => set({ coords: e.target.value })} /></Field>
          <Field label="Medidas preventivas" className="sm:col-span-2"><Textarea value={v.preventiveMeasures} onChange={(e) => set({ preventiveMeasures: e.target.value })} /></Field>
        </div>}
      </FormModal>
      <FormModal open={haven} onClose={() => setHaven(false)} title="Capturar punto de resguardo" initial={{ name: '', state: '', municipality: '', highway: '', kmMarker: '', lat: '', lng: '', corridorId: '', hours: '', contactPhone: '', source: '' }} onSubmit={(v) => saveHaven.mutateAsync({ ...v, lat: Number(v.lat), lng: Number(v.lng), corridorId: v.corridorId || null })}>
        {(v, set) => <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" className="sm:col-span-2"><Input value={v.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Estado"><Input value={v.state} onChange={(e) => set({ state: e.target.value })} /></Field><Field label="Municipio"><Input value={v.municipality} onChange={(e) => set({ municipality: e.target.value })} /></Field>
          <Field label="Carretera"><Input value={v.highway} onChange={(e) => set({ highway: e.target.value })} /></Field><Field label="Km"><Input value={v.kmMarker} onChange={(e) => set({ kmMarker: e.target.value })} /></Field>
          <Field label="Latitud"><Input value={v.lat} onChange={(e) => set({ lat: e.target.value })} /></Field><Field label="Longitud"><Input value={v.lng} onChange={(e) => set({ lng: e.target.value })} /></Field>
          <Field label="Corredor"><Select value={v.corridorId} onChange={(e) => set({ corridorId: e.target.value })} placeholder="—" options={(corridors.data ?? []).map((c) => ({ value: c.id, label: c.name }))} /></Field><Field label="Horario"><Input value={v.hours} onChange={(e) => set({ hours: e.target.value })} /></Field>
          <Field label="Fuente / verificación" className="sm:col-span-2"><Input value={v.source} onChange={(e) => set({ source: e.target.value })} /></Field>
        </div>}
      </FormModal>
      {validate && <FormModal key={validate.item.id} open onClose={() => setValidate(null)} title={`Validar: ${validate.item.name}`} initial={{ decision: 'VALIDADO', notes: '' }} onSubmit={(v) => val.mutateAsync({ kind: validate.kind, id: validate.item.id, ...v })}>
        {(v, set) => <><p className="text-sm">Fuente: <b>{validate.item.source}</b></p><Field label="Decisión"><Select value={v.decision} onChange={(e) => set({ decision: e.target.value })} options={validate.kind === 'feature' ? { VALIDADO: 'Validado', RECHAZADO: 'Rechazado', VENCIDO: 'Vencido' } : { VALIDADO: 'Validado', RECHAZADO: 'Rechazado' }} /></Field><Field label="Cómo se validó"><Textarea value={v.notes} onChange={(e) => set({ notes: e.target.value })} /></Field></>}
      </FormModal>}
    </>
  );
}

function FeatureShape({ f }: { f: any }) {
  const color = f.kind === 'PARADA_PERMITIDA' || f.kind === 'RUTA_ALTERNA' ? '#167A45' : levelColor(f.level);
  const popup = <Popup><b>{f.name}</b><br />{KIND[f.kind as keyof typeof KIND]} · {CAT[f.category as keyof typeof CAT]}<br />Nivel {f.level} · {f.reason}<br />Fuente: {f.source}{f.preventiveMeasures && <><br />Medidas: {f.preventiveMeasures}</>}{f.validation !== 'VALIDADO' && <><br /><b>NO VALIDADO</b></>}</Popup>;
  const g = f.geometry;
  const dash = f.validation === 'VALIDADO' ? undefined : '6';
  if (g.type === 'Point') return <CircleMarker center={[g.coordinates[1], g.coordinates[0]]} radius={8} pathOptions={{ color, fillOpacity: 0.6, dashArray: dash }}>{popup}</CircleMarker>;
  if (g.type === 'LineString') return <Polyline positions={g.coordinates.map((c: number[]) => [c[1], c[0]])} pathOptions={{ color, weight: 6, dashArray: dash }}>{popup}</Polyline>;
  return <Polygon positions={g.coordinates[0].map((c: number[]) => [c[1], c[0]])} pathOptions={{ color, fillOpacity: 0.2, dashArray: dash }}>{popup}</Polygon>;
}
