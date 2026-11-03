import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ScanLine, Bell, Truck, ClipboardList, Play, Siren, Search, Phone, FileText, RefreshCw, ArrowRight, Info, WifiOff, VideoOff, PauseCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../lib/hooks';
import { Badge, Button, Card, Empty, Notice, Progress, Spinner, Stat, StatusBadge, Tabs } from '../components/ui';
import { Freshness, SourceTag } from '../components/DataTag';
import { ago, fmtTime, greeting, minutesLabel } from '../lib/format';
import { ALERT_TYPES, STOP_REASONS } from '../lib/labels';

interface HomeData {
  dataStatus: { gpsIntegration: string; message: string; demoUnits: number; freshness: Record<string, number> };
  sweep: { cycle: { id: string; startsAt: string; dueAt: string; status: string }; progress: { total: number; done: number; pending: number; percent: number; anomalies: number }; overdueCycles: number };
  alerts: { items: { id: string; type: string; severity: string; status: string; title: string; detectedAt: string; unit?: { economicNumber: string } }[]; nuevas: number; criticas: number; total: number };
  attention: { id: string; economicNumber: string; freshness: string; minutesSincePosition: number | null; camerasWithFault: number; activeStop: { minutes: number; reason: string } | null; operator: string | null; dataSource: string }[];
  attentionTotal: number;
  pending: { tasks: { id: string; title: string; priority: string; dueAt: string | null }[]; handover: { id: string; outgoingUser: { fullName: string }; createdAt: string } | null; myIncidents: { id: string; folio: string; title: string; priority: string; status: string }[] };
}

export function HomePage() {
  const { can } = useAuth();
  const [view, setView] = useState<'monitor' | 'exec'>(can('dashboard.executive') ? 'exec' : 'monitor');
  return (
    <>
      {can('dashboard.executive') && <Tabs value={view} onChange={setView} tabs={[{ value: 'exec', label: 'Vista ejecutiva' }, { value: 'monitor', label: 'Vista de monitorista' }]} />}
      {view === 'exec' ? <ExecutiveHome /> : <MonitorHome />}
    </>
  );
}

function MonitorHome() {
  const { me } = useAuth();
  const nav = useNavigate();
  const { data, isLoading, error } = useApi<HomeData>(['home'], '/dashboard/monitor-home', { refetchInterval: 30000 });
  if (isLoading) return <Spinner />;
  if (error || !data) return <Notice tone="red">No se pudo cargar la información: {(error as Error)?.message}. Los datos NO están actualizados.</Notice>;
  const { sweep, alerts, attention, pending } = data;
  const remaining = Math.round((new Date(sweep.cycle.dueAt).getTime() - Date.now()) / 60000);
  const quick = [
    { label: 'Iniciar barrido', icon: <Play />, to: '/barridos', primary: true },
    { label: 'Reportar incidencia', icon: <Siren />, to: '/incidencias?nueva=1' },
    { label: 'Consultar unidad', icon: <Search />, to: '/flota' },
    { label: 'Contactar operador', icon: <Phone />, to: '/operadores' },
    { label: 'Generar estatus', icon: <FileText />, to: '/estatus' },
    { label: 'Entregar turno', icon: <RefreshCw />, to: '/turnos' },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{greeting()}, {me?.fullName.split(' ')[0]}.</h1>
        <p className="mt-1 text-ink-500">Estas son tus actividades del turno.</p>
      </div>
      {data.dataStatus.gpsIntegration !== 'ACTIVA' && (
        <Notice tone="blue" icon={<Info className="h-5 w-5 shrink-0" />}>{data.dataStatus.message}{data.dataStatus.demoUnits ? ` · ${data.dataStatus.demoUnits} unidades de demostración.` : ''}</Notice>
      )}
      {pending.handover && (
        <Notice tone="amber" icon={<RefreshCw className="h-5 w-5 shrink-0" />}>
          <b>{pending.handover.outgoingUser.fullName}</b> te entregó el turno {ago(pending.handover.createdAt)}. <Link className="font-semibold underline" to={`/turnos/${pending.handover.id}`}>Revisar y confirmar recepción</Link>
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {quick.map((q) => (
          <button key={q.label} onClick={() => nav(q.to)} className={`flex flex-col items-start gap-3 rounded-2xl p-4 text-left font-semibold transition hover:-translate-y-0.5 hover:shadow-pop [&_svg]:h-6 [&_svg]:w-6 ${q.primary ? 'bg-brand-700 text-white shadow-card' : 'card text-ink-800'}`}>
            <span className={q.primary ? '' : 'text-brand-700'}>{q.icon}</span>{q.label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title={<span className="flex items-center gap-2"><ScanLine className="h-5 w-5 text-brand-700" />Barridos de flota</span>} action={<Button size="sm" onClick={() => nav('/barridos')} icon={<Play className="h-4 w-4" />}>Continuar</Button>}>
          <div className="flex items-end justify-between">
            <div><p className="text-4xl font-bold tabular-nums">{sweep.progress.percent}%</p><p className="text-sm text-ink-500">{sweep.progress.done} de {sweep.progress.total} unidades revisadas</p></div>
            <div className="text-right text-sm">
              <p className="text-ink-500">Ciclo {fmtTime(sweep.cycle.startsAt)} – {fmtTime(sweep.cycle.dueAt)}</p>
              <p className={remaining < 30 && sweep.progress.pending ? 'font-semibold text-red-600' : 'font-semibold text-ink-700'}>{remaining > 0 ? `Vence en ${minutesLabel(remaining)}` : 'Vencido'}</p>
            </div>
          </div>
          <div className="mt-4"><Progress value={sweep.progress.percent} tone={remaining < 30 && sweep.progress.pending ? 'red' : 'green'} /></div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="amber">{sweep.progress.pending} pendientes</Badge>
            {sweep.progress.anomalies > 0 && <Badge tone="red">{sweep.progress.anomalies} con anomalía</Badge>}
            {sweep.overdueCycles > 0 && <Badge tone="red">{sweep.overdueCycles} ciclos vencidos (24 h)</Badge>}
          </div>
        </Card>

        <Card title={<span className="flex items-center gap-2"><Bell className="h-5 w-5 text-brand-700" />Alertas</span>} action={<Link to="/alertas" className="flex items-center gap-1 text-sm font-semibold text-brand-700">Bandeja <ArrowRight className="h-4 w-4" /></Link>} padded={false}>
          <div className="grid grid-cols-3 divide-x divide-ink-100 border-b border-ink-100 text-center">
            <div className="p-3"><p className="text-2xl font-bold text-red-600">{alerts.criticas}</p><p className="text-xs text-ink-500">Críticas</p></div>
            <div className="p-3"><p className="text-2xl font-bold">{alerts.nuevas}</p><p className="text-xs text-ink-500">Nuevas</p></div>
            <div className="p-3"><p className="text-2xl font-bold">{alerts.total}</p><p className="text-xs text-ink-500">Por atender</p></div>
          </div>
          {alerts.items.length === 0 ? <Empty title="Sin alertas activas" icon={<CheckCircle2 className="h-6 w-6 text-brand-500" />} /> : (
            <ul className="divide-y divide-ink-100">
              {alerts.items.slice(0, 5).map((a) => (
                <li key={a.id}><Link to="/alertas" className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50">
                  <StatusBadge value={a.severity} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{a.title}</span><span className="text-xs text-ink-500">{ALERT_TYPES[a.type]} · {ago(a.detectedAt)}</span></span>
                  <StatusBadge value={a.status} />
                </Link></li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={<span className="flex items-center gap-2"><Truck className="h-5 w-5 text-brand-700" />Unidades que requieren atención</span>} subtitle={`${data.attentionTotal} unidades`} padded={false}>
          {attention.length === 0 ? <Empty title="Todas las unidades sin novedades" /> : (
            <ul className="divide-y divide-ink-100">
              {attention.map((u) => (
                <li key={u.id}><Link to={`/flota/${u.id}`} className="flex flex-wrap items-center gap-2 px-5 py-3 hover:bg-ink-50">
                  <span className="w-20 font-bold">{u.economicNumber}</span>
                  {u.freshness !== 'ACTUALIZADA' && <span className="flex items-center gap-1 text-xs text-red-600"><WifiOff className="h-3.5 w-3.5" /><Freshness value={u.freshness} /></span>}
                  {u.camerasWithFault > 0 && <Badge tone="amber"><VideoOff className="h-3 w-3" />{u.camerasWithFault} cámara(s)</Badge>}
                  {u.activeStop && <Badge tone={u.activeStop.minutes > 60 ? 'red' : 'amber'}><PauseCircle className="h-3 w-3" />Detenida {minutesLabel(u.activeStop.minutes)} · {STOP_REASONS[u.activeStop.reason]}</Badge>}
                  <span className="ml-auto"><SourceTag source={u.dataSource} /></span>
                </Link></li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={<span className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-brand-700" />Pendientes del turno</span>} padded={false}>
          {!pending.tasks.length && !pending.myIncidents.length ? <Empty title="Sin pendientes asignados" /> : (
            <ul className="divide-y divide-ink-100">
              {pending.myIncidents.map((i) => (
                <li key={i.id}><Link to={`/incidencias/${i.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50"><Siren className="h-4 w-4 text-red-500" /><span className="flex-1 text-sm"><b>{i.folio}</b> · {i.title}</span><StatusBadge value={i.status} /></Link></li>
              ))}
              {pending.tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-5 py-3"><ClipboardList className="h-4 w-4 text-ink-400" /><span className="flex-1 text-sm">{t.title}</span>{t.dueAt && <span className="text-xs text-ink-500">{fmtTime(t.dueAt)}</span>}<StatusBadge value={t.priority} /></li>
              ))}
            </ul>
          )}
          <div className="border-t border-ink-100 px-5 py-3"><Link to="/turnos" className="text-sm font-semibold text-brand-700">Ver pendientes y entrega de turno →</Link></div>
        </Card>
      </div>
    </div>
  );
}

interface Exec {
  operational: { kpis: Record<string, number>; dataStatus: HomeData['dataStatus'] };
  week: { sweeps: { compliancePct: number | null; coveragePct: number | null }; cameras: { availabilityPct: number | null; mttrMinutes: number | null }; gps: { availabilityPct: number | null }; alerts: { firstResponseAvgMin: number | null; escalationAvgMin: number | null; overdue: number }; incidents: { total: number; open: number; byCategory: { key: string; count: number }[] }; curfew: { compliancePct: number | null }; handover: { compliancePct: number | null }; dataQuality: string[] };
  approvals: { immob: number; closures: number; configs: number; communiques: number; exceptions: number; total: number };
}
const pctv = (v: number | null) => (v === null ? 'Sin datos' : `${v}%`);
const toneFor = (v: number | null, good = 95, warn = 85) => (v === null ? 'gray' : v >= good ? 'green' : v >= warn ? 'amber' : 'red');

function ExecutiveHome() {
  const nav = useNavigate();
  const { data, isLoading } = useApi<Exec>(['exec'], '/dashboard/executive', { refetchInterval: 60000 });
  if (isLoading || !data) return <Spinner />;
  const k = data.operational.kpis; const w = data.week; const a = data.approvals;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Panorama ejecutivo</h1><p className="text-ink-500">Situación actual e indicadores de los últimos 7 días.</p></div>
      {a.total > 0 && (
        <Card title="Autorizaciones pendientes" subtitle="Requieren su decisión">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Inmovilizaciones" value={a.immob} tone={a.immob ? 'red' : 'gray'} onClick={() => nav('/inmovilizacion')} />
            <Stat label="Cierres de incidencia" value={a.closures} tone={a.closures ? 'amber' : 'gray'} onClick={() => nav('/incidencias?status=PENDIENTE_CIERRE')} />
            <Stat label="Cambios de configuración" value={a.configs} tone={a.configs ? 'amber' : 'gray'} onClick={() => nav('/configuracion')} />
            <Stat label="Comunicados" value={a.communiques} onClick={() => nav('/comunicados')} />
            <Stat label="Excepciones de circulación" value={a.exceptions} tone={a.exceptions ? 'amber' : 'gray'} onClick={() => nav('/resguardos')} />
          </div>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Incidencias críticas abiertas" value={k.incidenciasCriticas} tone={k.incidenciasCriticas ? 'red' : 'green'} onClick={() => nav('/incidencias')} />
        <Stat label="Alertas activas" value={k.alertasActivas} tone={k.alertasCriticas ? 'red' : 'amber'} hint={`${k.alertasCriticas} críticas · ${k.pendientesEscalamiento} sin escalar a tiempo`} onClick={() => nav('/alertas')} />
        <Stat label="Unidades sin GPS" value={k.sinGps} tone={k.sinGps ? 'red' : 'green'} hint={`de ${k.totalUnits}`} onClick={() => nav('/flota')} />
        <Stat label="Barrido en curso" value={`${k.barridosCompletados}/${k.barridosCompletados + k.barridosPendientes}`} hint={`${k.barridosVencidos} vencidos (24 h)`} tone={k.barridosVencidos ? 'red' : 'green'} onClick={() => nav('/barridos')} />
      </div>
      <Card title="Indicadores semanales" subtitle="Sin datos suficientes se muestra “Sin datos”, nunca un valor supuesto">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Cumplimiento de barridos" value={pctv(w.sweeps.compliancePct)} tone={toneFor(w.sweeps.compliancePct)} />
          <Stat label="Cobertura verificada" value={pctv(w.sweeps.coveragePct)} tone={toneFor(w.sweeps.coveragePct)} />
          <Stat label="Disponibilidad de cámaras" value={pctv(w.cameras.availabilityPct)} tone={toneFor(w.cameras.availabilityPct)} hint={w.cameras.mttrMinutes !== null ? `Recuperación media ${minutesLabel(w.cameras.mttrMinutes)}` : undefined} />
          <Stat label="Disponibilidad GPS" value={pctv(w.gps.availabilityPct)} tone={toneFor(w.gps.availabilityPct)} />
          <Stat label="Primera respuesta" value={w.alerts.firstResponseAvgMin === null ? 'Sin datos' : `${w.alerts.firstResponseAvgMin} min`} />
          <Stat label="Tiempo de escalamiento" value={w.alerts.escalationAvgMin === null ? 'Sin datos' : `${w.alerts.escalationAvgMin} min`} />
          <Stat label="Cumplimiento de resguardo" value={pctv(w.curfew.compliancePct)} tone={toneFor(w.curfew.compliancePct)} />
          <Stat label="Entrega de turno a tiempo" value={pctv(w.handover.compliancePct)} tone={toneFor(w.handover.compliancePct)} />
        </div>
        {w.dataQuality.length > 0 && <div className="mt-4"><Notice tone="gray"><b>Calidad de datos:</b> {w.dataQuality.join(' · ')}</Notice></div>}
        <div className="mt-4"><Button variant="secondary" onClick={() => nav('/reportes')}>Ver reportes completos</Button></div>
      </Card>
    </div>
  );
}
