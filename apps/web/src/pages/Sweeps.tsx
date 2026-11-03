import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ScanLine, MapPin, Video, User, CheckCircle2, AlertTriangle, ChevronRight, Lock, Clock, WifiOff, Eye, History } from 'lucide-react';
import clsx from 'clsx';
import { useApi, useAction, api } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, Check, Empty, Field, Modal, Notice, PageHeader, Progress, Segmented, Select, Spinner, StatusBadge, Tabs, Textarea } from '../components/ui';
import { Freshness, SourceTag } from '../components/DataTag';
import { useToast } from '../components/toast';
import { ApiError } from '../lib/api';
import { ago, fmtDateTime, fmtTime, minutesLabel } from '../lib/format';
import { label, STOP_REASONS } from '../lib/labels';

interface Live {
  id: string; economicNumber: string; plates: string; opStatus: string; freshness: string; minutesSincePosition: number | null; dataSource: string; trailers: string[];
  operator: { fullName: string; phonePrimary: string | null } | null; position: { lat: number; lng: number; speedKph: number | null; recordedAt: string; source: string; address: string | null } | null;
  cameras: { id: string; label: string; status: string }[]; camerasWithFault: number; activeStop: { minutes: number; reason: string } | null; activeTrip: { tripNumber: string; destination: string } | null;
}
interface Review { id: string; status: string; version: number; unitId: string; unit: { economicNumber: string; plates: string; type: string }; reviewedBy?: { fullName: string } | null; reviewedAt: string | null; lockedBy?: { id: string; fullName: string } | null; live?: Live; observations?: string | null }
interface Current { cycle: { id: string; startsAt: string; dueAt: string; status: string }; progress: { total: number; done: number; pending: number; percent: number; anomalies: number; verified: number; inReview: number }; previousPending: { id: string; startsAt: string; status: string; progress: { pending: number } }[] }

export function SweepsPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<'pend' | 'done' | 'anom' | 'all'>('pend');
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [openReview, setOpenReview] = useState<Review | null>(null);
  const cur = useApi<Current>(['sweep-current'], '/sweeps/current', { refetchInterval: 20000 });
  const activeCycle = cycleId ?? cur.data?.cycle.id ?? null;
  const reviews = useApi<Review[]>(['sweep-reviews', activeCycle], activeCycle ? `/sweeps/cycles/${activeCycle}/reviews` : null, { refetchInterval: 20000 });
  const list = useMemo(() => (reviews.data ?? []).filter((r) => tab === 'all' || (tab === 'pend' ? ['PENDIENTE', 'EN_REVISION'].includes(r.status) : tab === 'anom' ? ['CON_ANOMALIA', 'NO_VERIFICABLE'].includes(r.status) : r.status === 'VERIFICADA')), [reviews.data, tab]);
  if (cur.isLoading) return <Spinner />;
  if (!cur.data) return <Notice tone="red">No se pudo cargar el barrido.</Notice>;
  const { cycle, progress } = cur.data;
  const remaining = Math.round((new Date(cycle.dueAt).getTime() - Date.now()) / 60000);
  const viewingPrev = cycleId && cycleId !== cur.data.cycle.id;
  const nextPending = list.find((r) => r.status === 'PENDIENTE');

  return (
    <>
      <PageHeader title="Barridos de flota" subtitle="Revisión de toda la flota cada dos horas, las 24 horas" actions={
        <>
          {can('sweeps.review') && nextPending && !viewingPrev && <Button size="lg" icon={<ScanLine className="h-5 w-5" />} onClick={() => setOpenReview(nextPending)}>Revisar siguiente unidad</Button>}
        </>
      } />
      {cur.data.previousPending.length > 0 && (
        <div className="mb-5"><Notice tone="red" icon={<AlertTriangle className="h-5 w-5 shrink-0" />}>
          Pendientes de ciclos anteriores: {cur.data.previousPending.map((p) => (
            <button key={p.id} onClick={() => setCycleId(p.id)} className="mr-2 font-semibold underline">{fmtTime(p.startsAt)} ({p.progress.pending} sin revisar)</button>
          ))}
          {viewingPrev && <button onClick={() => setCycleId(null)} className="font-semibold">· Volver al ciclo actual</button>}
        </Notice></div>
      )}
      {!viewingPrev && (
        <div className="card mb-5 grid gap-5 p-5 md:grid-cols-[1fr_auto]">
          <div>
            <div className="mb-2 flex flex-wrap items-baseline gap-x-3"><span className="text-4xl font-bold tabular-nums">{progress.percent}%</span><span className="text-ink-500">Ciclo {fmtTime(cycle.startsAt)} – {fmtTime(cycle.dueAt)}</span></div>
            <Progress value={progress.percent} tone={remaining < 30 && progress.pending ? 'red' : 'green'} />
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <Badge tone="green">{progress.verified} verificadas</Badge><Badge tone="red">{progress.anomalies} con anomalía</Badge><Badge tone="amber">{progress.pending} pendientes</Badge>{progress.inReview > 0 && <Badge tone="blue">{progress.inReview} en revisión</Badge>}
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-ink-50 px-5 py-3">
            <Clock className={clsx('h-8 w-8', remaining < 30 && progress.pending ? 'text-red-500' : 'text-brand-600')} />
            <div><p className="text-xs text-ink-500">Tiempo restante</p><p className="text-xl font-bold">{remaining > 0 ? minutesLabel(remaining) : 'Vencido'}</p></div>
          </div>
        </div>
      )}
      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'pend', label: 'Pendientes', count: (reviews.data ?? []).filter((r) => ['PENDIENTE', 'EN_REVISION'].includes(r.status)).length },
        { value: 'anom', label: 'Con anomalía', count: (reviews.data ?? []).filter((r) => ['CON_ANOMALIA', 'NO_VERIFICABLE'].includes(r.status)).length },
        { value: 'done', label: 'Verificadas' }, { value: 'all', label: 'Todas' },
      ]} />
      {reviews.isLoading ? <Spinner /> : list.length === 0 ? <Card><Empty title={tab === 'pend' ? 'Barrido completo: no hay unidades pendientes' : 'Sin registros'} icon={<CheckCircle2 className="h-6 w-6 text-brand-500" />} /></Card> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((r) => <ReviewCard key={r.id} r={r} onOpen={() => setOpenReview(r)} />)}
        </div>
      )}
      {openReview && <ReviewWizard review={openReview} onClose={() => setOpenReview(null)} onNext={() => {
        const idx = list.findIndex((x) => x.id === openReview.id);
        const nx = list.slice(idx + 1).find((x) => x.status === 'PENDIENTE') ?? list.find((x) => x.status === 'PENDIENTE' && x.id !== openReview.id);
        setOpenReview(nx ?? null);
      }} />}
    </>
  );
}

function ReviewCard({ r, onOpen }: { r: Review; onOpen: () => void }) {
  const { me, can } = useAuth();
  const l = r.live;
  const lockedByOther = r.status === 'EN_REVISION' && r.lockedBy && r.lockedBy.id !== me?.id;
  const pending = ['PENDIENTE', 'EN_REVISION'].includes(r.status);
  return (
    <button onClick={onOpen} disabled={!can('sweeps.review') && pending} className={clsx('card flex flex-col gap-3 p-4 text-left transition hover:shadow-pop', lockedByOther && 'opacity-70')}>
      <div className="flex items-center justify-between">
        <div><p className="text-lg font-bold">{r.unit.economicNumber}</p><p className="text-xs text-ink-500">{r.unit.plates} · {label(r.unit.type)}</p></div>
        <StatusBadge value={r.status} />
      </div>
      {l && (
        <div className="flex flex-wrap gap-1.5">
          <Freshness value={l.freshness} at={l.position?.recordedAt} />
          {l.camerasWithFault > 0 && <Badge tone="amber"><Video className="h-3 w-3" />{l.camerasWithFault} con falla</Badge>}
          {l.activeStop && <Badge tone="amber">Detenida {minutesLabel(l.activeStop.minutes)}</Badge>}
          <SourceTag source={l.position?.source ?? l.dataSource} />
        </div>
      )}
      <div className="flex items-center justify-between text-sm text-ink-500">
        {lockedByOther ? <span className="flex items-center gap-1 text-amber-700"><Lock className="h-4 w-4" />{r.lockedBy!.fullName} está revisando</span>
          : r.reviewedBy ? <span>{r.reviewedBy.fullName} · {fmtTime(r.reviewedAt)}</span> : <span>{l?.operator?.fullName ?? 'Sin operador asignado'}</span>}
        {pending && <ChevronRight className="h-5 w-5 text-brand-700" />}
      </div>
    </button>
  );
}

type VS = 'VERIFICADO' | 'NO_VERIFICADO' | 'CON_ANOMALIA';
const CAMS = { FUNCIONANDO: 'Funcionando', SIN_TRANSMISION: 'Sin transmisión', DESCONECTADA: 'Desconectada', OBSTRUIDA: 'Obstruida', IMAGEN_DEFICIENTE: 'Imagen deficiente', FALLA_TECNICA: 'Falla técnica', PENDIENTE_VALIDACION: 'No pude validar' };

function ReviewWizard({ review, onClose, onNext }: { review: Review; onClose: () => void; onNext: () => void }) {
  const toast = useToast();
  const { can } = useAuth();
  const readonly = !['PENDIENTE', 'EN_REVISION'].includes(review.status) || !can('sweeps.review');
  const [step, setStep] = useState(1);
  const [state, setState] = useState<{ version: number; live: Live } | null>(null);
  const [lockErr, setLockErr] = useState<string | null>(null);
  const [gps, setGps] = useState<VS | ''>('');
  const [loc, setLoc] = useState<VS | ''>('');
  const [move, setMove] = useState<'EN_MOVIMIENTO' | 'DETENIDA' | 'APAGADA' | 'DESCONOCIDO' | ''>('');
  const [stopReason, setStopReason] = useState('');
  const [cams, setCams] = useState<Record<string, { status: string; imageViewed: boolean; notes?: string }>>({});
  const [obs, setObs] = useState('');
  const history = useApi<{ id: string; status: string; reviewedAt: string; reviewedBy: { fullName: string }; observations: string | null }[]>(['sweep-hist', review.unitId], readonly ? `/sweeps/units/${review.unitId}/history` : null);

  // Paso 1: abrir (bloquear) la unidad
  const doOpen = useAction(() => api.post<{ review: { version: number }; live: Live }>(`/sweeps/reviews/${review.id}/open`), {
    onSuccess: (r) => {
      setState({ version: r.review.version, live: r.live });
      setMove(r.live.activeStop ? 'DETENIDA' : (r.live.position?.speedKph ?? 0) > 0 && r.live.freshness === 'ACTUALIZADA' ? 'EN_MOVIMIENTO' : '');
      if (r.live.activeStop) setStopReason(r.live.activeStop.reason);
      setStep(2);
    },
  });
  const submit = useAction(() => api.post<{ review: { status: string } }>(`/sweeps/reviews/${review.id}/submit`, {
    version: state!.version, gpsStatus: gps, locationVerified: loc, movementState: move || 'DESCONOCIDO', stopReason: move === 'DETENIDA' ? stopReason || 'DESCONOCIDO' : null,
    cameraChecks: Object.entries(cams).map(([cameraId, c]) => ({ cameraId, ...c })), observations: obs || null,
  }), { invalidate: [['sweep-current'], ['sweep-reviews'], ['home']], success: (r) => `Revisión registrada: ${label(r.review.status)}`, onSuccess: () => onNext() });

  const release = () => { if (state && !submit.isSuccess) api.post(`/sweeps/reviews/${review.id}/release`).catch(() => {}); onClose(); };

  if (readonly) {
    return (
      <Modal open onClose={onClose} title={`Unidad ${review.unit.economicNumber}`} wide>
        <div className="mb-4 flex items-center gap-2"><StatusBadge value={review.status} />{review.reviewedBy && <span className="text-sm text-ink-500">por {review.reviewedBy.fullName} · {fmtDateTime(review.reviewedAt)}</span>}</div>
        {review.observations && <p className="mb-4 rounded-xl bg-ink-50 p-3 text-sm">{review.observations}</p>}
        <h4 className="mb-2 flex items-center gap-2 font-semibold"><History className="h-4 w-4" />Historial de revisiones</h4>
        {history.data?.map((h) => <div key={h.id} className="flex items-center gap-3 border-b border-ink-100 py-2 text-sm"><StatusBadge value={h.status} /><span>{fmtDateTime(h.reviewedAt)}</span><span className="text-ink-500">{h.reviewedBy?.fullName}</span><span className="truncate text-ink-500">{h.observations}</span></div>)}
        <div className="mt-4"><Link to={`/flota/${review.unitId}`} className="text-sm font-semibold text-brand-700">Abrir expediente de la unidad →</Link></div>
      </Modal>
    );
  }

  const live = state?.live;
  const camsList = live?.cameras ?? [];
  const camsComplete = camsList.every((c) => cams[c.id]?.status);
  const camViewViolation = Object.values(cams).some((c) => c.status === 'FUNCIONANDO' && !c.imageViewed);
  const gpsBlocked = live && (live.freshness === 'SIN_COMUNICACION' || live.freshness === 'NO_DISPONIBLE');
  const anomalous = gps === 'CON_ANOMALIA' || loc === 'CON_ANOMALIA' || Object.values(cams).some((c) => !['FUNCIONANDO', 'PENDIENTE_VALIDACION'].includes(c.status)) || stopReason === 'NO_AUTORIZADA';
  const allVerified = gps === 'VERIFICADO' && loc === 'VERIFICADO' && camsComplete && Object.values(cams).every((c) => c.status === 'FUNCIONANDO' && c.imageViewed);

  return (
    <Modal open onClose={release} wide title={<span className="flex items-center gap-3">Unidad {review.unit.economicNumber}<span className="text-sm font-normal text-ink-500">Paso {step} de 3</span></span>}
      footer={step === 1 ? <><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={doOpen.isPending} onClick={() => doOpen.mutate(undefined, { onError: (e) => setLockErr((e as ApiError).message) })}>Abrir unidad</Button></>
        : step === 2 ? <><Button variant="secondary" onClick={release}>Liberar sin registrar</Button><Button disabled={!gps || !loc || !move || !camsComplete || camViewViolation} onClick={() => setStep(3)}>Continuar</Button></>
          : <><Button variant="secondary" onClick={() => setStep(2)}>Regresar</Button>
            <Button variant={anomalous ? 'danger' : allVerified ? 'primary' : 'warning'} loading={submit.isPending} onClick={() => {
              if (!allVerified && !anomalous && !obs.trim()) { toast('Explique en observaciones qué no pudo verificarse', 'warning'); return; }
              submit.mutate(undefined);
            }}>{anomalous ? 'Registrar anomalía' : allVerified ? 'Confirmar revisión' : 'Registrar como no verificable'}</Button></>}>
      <div className="mb-5 flex gap-2">{[1, 2, 3].map((s) => <div key={s} className={clsx('h-1.5 flex-1 rounded-full', s <= step ? 'bg-brand-600' : 'bg-ink-200')} />)}</div>
      {step === 1 && (
        <div className="space-y-3">
          <p className="text-ink-600">Al abrir la unidad quedará reservada a su nombre para evitar que otro monitorista la revise al mismo tiempo.</p>
          {lockErr && <Notice tone="red" icon={<Lock className="h-5 w-5 shrink-0" />}>{lockErr}</Notice>}
        </div>
      )}
      {step === 2 && live && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Info icon={<MapPin />} title="Última posición">
              {live.position ? <><p className="font-mono text-sm">{live.position.lat.toFixed(5)}, {live.position.lng.toFixed(5)}</p><p className="text-xs text-ink-500">{live.position.address ?? 'Sin dirección'}</p><p className="text-xs text-ink-500">{fmtDateTime(live.position.recordedAt)} ({ago(live.position.recordedAt)}) · {live.position.speedKph ?? '—'} km/h</p></> : <p className="text-sm text-red-600">Sin posición registrada</p>}
              <div className="mt-1.5 flex gap-1.5"><Freshness value={live.freshness} /><SourceTag source={live.position?.source} /></div>
            </Info>
            <Info icon={<User />} title="Operador y viaje">
              <p className="text-sm font-medium">{live.operator?.fullName ?? 'Sin operador asignado'}</p>
              <p className="text-xs text-ink-500">{live.activeTrip ? `Viaje ${live.activeTrip.tripNumber} → ${live.activeTrip.destination}` : 'Sin viaje activo'}</p>
              {live.trailers.length > 0 && <p className="text-xs text-ink-500">Remolques/tanques: {live.trailers.join(', ')}</p>}
            </Info>
            <Info icon={<Clock />} title="Estado operativo">
              <p className="text-sm font-medium">{label(live.opStatus)}</p>
              {live.activeStop && <p className="text-xs text-ink-500">Detenida {minutesLabel(live.activeStop.minutes)} · {STOP_REASONS[live.activeStop.reason]}</p>}
            </Info>
          </div>
          {gpsBlocked && <Notice tone="red" icon={<WifiOff className="h-5 w-5 shrink-0" />}>La posición no está actualizada: no puede marcarse el GPS como verificado. Registre la anomalía y valide con el operador o el proveedor GPS. La falta de señal no implica por sí misma un robo.</Notice>}
          <Field label="1. ¿Comprobó el GPS en la plataforma?">
            <Segmented value={gps} onChange={setGps} options={[{ value: 'VERIFICADO', label: 'Comprobado', tone: 'green' }, { value: 'NO_VERIFICADO', label: 'No pude comprobar', tone: 'gray' }, { value: 'CON_ANOMALIA', label: 'Con anomalía', tone: 'red' }].filter((o) => !(gpsBlocked && o.value === 'VERIFICADO')) as never} />
          </Field>
          <Field label="2. ¿La ubicación es coherente con la ruta / sitio esperado?">
            <Segmented value={loc} onChange={setLoc} options={[{ value: 'VERIFICADO', label: 'Coherente', tone: 'green' }, { value: 'NO_VERIFICADO', label: 'No pude validar', tone: 'gray' }, { value: 'CON_ANOMALIA', label: 'Fuera de lo esperado', tone: 'red' }]} />
          </Field>
          <Field label="3. Estado de movimiento">
            <Segmented value={move} onChange={setMove} options={[{ value: 'EN_MOVIMIENTO', label: 'En movimiento', tone: 'green' }, { value: 'DETENIDA', label: 'Detenida', tone: 'amber' }, { value: 'APAGADA', label: 'Apagada', tone: 'gray' }, { value: 'DESCONOCIDO', label: 'Desconocido', tone: 'gray' }]} />
          </Field>
          {move === 'DETENIDA' && <Field label="Motivo de la detención"><Select value={stopReason} onChange={(e) => setStopReason(e.target.value)} options={STOP_REASONS} placeholder="Seleccione…" /></Field>}
          <div>
            <p className="label">4. Cámaras ({camsList.length})</p>
            {camsList.length === 0 && <p className="text-sm text-ink-500">La unidad no tiene cámaras registradas.</p>}
            <div className="space-y-2">
              {camsList.map((c) => {
                const v = cams[c.id] ?? { status: '', imageViewed: false };
                const set = (p: Partial<typeof v>) => setCams((x) => ({ ...x, [c.id]: { ...v, ...p } }));
                return (
                  <div key={c.id} className="rounded-xl border border-ink-200 p-3">
                    <div className="mb-2 flex items-center justify-between"><span className="flex items-center gap-2 font-medium"><Video className="h-4 w-4 text-ink-500" />{c.label}</span><span className="text-xs text-ink-500">Último estado: {label(c.status)}</span></div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Select value={v.status} onChange={(e) => set({ status: e.target.value })} options={CAMS} placeholder="Estado observado…" />
                      <Check checked={v.imageViewed} onChange={(b) => set({ imageViewed: b })} label={<span className="flex items-center gap-1"><Eye className="h-4 w-4" />Vi la imagen en vivo</span>} />
                    </div>
                    {v.status === 'FUNCIONANDO' && !v.imageViewed && <p className="mt-1 text-xs text-red-600">Para marcarla como funcionando debe haber visto la imagen.</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {step === 3 && live && (
        <div className="space-y-4">
          <div className={clsx('flex items-center gap-3 rounded-2xl p-4', anomalous ? 'bg-red-50 text-red-800' : allVerified ? 'bg-brand-50 text-brand-800' : 'bg-amber-50 text-amber-800')}>
            {anomalous ? <AlertTriangle className="h-8 w-8" /> : allVerified ? <CheckCircle2 className="h-8 w-8" /> : <AlertTriangle className="h-8 w-8" />}
            <div><p className="font-semibold">{anomalous ? 'Se registrará una anomalía' : allVerified ? 'Todo fue comprobado' : 'Hay elementos que no pudieron verificarse'}</p><p className="text-sm">La revisión quedará a su nombre con fecha y hora, y una fotografía de la información disponible.</p></div>
          </div>
          <ul className="space-y-1 text-sm">
            <li>GPS: <b>{label(gps)}</b></li><li>Ubicación: <b>{label(loc)}</b></li><li>Movimiento: <b>{label(move)}</b>{move === 'DETENIDA' && ` · ${STOP_REASONS[stopReason] ?? 'Desconocido'}`}</li>
            {camsList.map((c) => <li key={c.id}>Cámara {c.label}: <b>{CAMS[cams[c.id]?.status as keyof typeof CAMS]}</b>{cams[c.id]?.imageViewed ? ' (imagen vista)' : ' (imagen no vista)'}</li>)}
          </ul>
          <Field label={allVerified ? 'Observaciones (opcional)' : 'Observaciones (obligatorio: qué no pudo verificarse y por qué)'}><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></Field>
          {anomalous && <Notice tone="amber">Si la anomalía representa un riesgo, después de registrar abra una incidencia desde Alertas o el botón Emergencia.</Notice>}
        </div>
      )}
    </Modal>
  );
}

function Info({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl bg-ink-50 p-3.5"><p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500 [&_svg]:h-4 [&_svg]:w-4">{icon}{title}</p>{children}</div>;
}
