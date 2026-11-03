import { useNavigate } from 'react-router-dom';
import { Truck, Navigation, PauseCircle, Moon, Wrench, WifiOff, VideoOff, Bell, Siren, ScanLine, CheckCircle2, AlertTriangle, Timer, ArrowUpRight, ClipboardList, Info } from 'lucide-react';
import { useApi } from '../lib/hooks';
import { Card, Notice, Spinner, Stat } from '../components/ui';
import { Freshness, SourceTag } from '../components/DataTag';
import { fmtDateTime, ago } from '../lib/format';

interface Op { generatedAt: string; dataStatus: { gpsIntegration: string; message: string; latestPositionAt: string | null; freshness: { actualizada: number; atrasada: number; sinComunicacion: number; noDisponible: number }; demoUnits: number }; kpis: Record<string, number>; attention: { id: string; economicNumber: string; freshness: string; minutesSincePosition: number | null; dataSource: string }[] }

export function DashboardPage() {
  const nav = useNavigate();
  const { data, isLoading, error, dataUpdatedAt } = useApi<Op>(['operational'], '/dashboard/operational', { refetchInterval: 30000 });
  if (isLoading) return <Spinner />;
  if (error || !data) return <Notice tone="red">Información no disponible: {(error as Error)?.message}</Notice>;
  const k = data.kpis; const f = data.dataStatus.freshness;
  const stale = Date.now() - dataUpdatedAt > 90000;
  const items = [
    { l: 'Total de unidades', v: k.totalUnits, i: <Truck />, to: '/flota' },
    { l: 'En tránsito', v: k.enTransito, i: <Navigation />, to: '/flota' },
    { l: 'Detenidas', v: k.detenidas, i: <PauseCircle />, t: k.detenidas ? 'amber' : 'gray', to: '/seguimiento' },
    { l: 'Resguardadas', v: k.resguardadas, i: <Moon />, t: 'green', to: '/resguardos' },
    { l: 'En mantenimiento', v: k.mantenimiento, i: <Wrench />, to: '/flota' },
    { l: 'Sin comunicación GPS', v: k.sinGps, i: <WifiOff />, t: k.sinGps ? 'red' : 'green', to: '/flota' },
    { l: 'Cámaras con fallas', v: k.camarasFalla, i: <VideoOff />, t: k.camarasFalla ? 'amber' : 'green', to: '/camaras' },
    { l: 'Alertas activas', v: k.alertasActivas, i: <Bell />, t: k.alertasActivas ? 'amber' : 'green', to: '/alertas' },
    { l: 'Incidencias críticas', v: k.incidenciasCriticas, i: <Siren />, t: k.incidenciasCriticas ? 'red' : 'green', to: '/incidencias' },
    { l: 'Barridos pendientes', v: k.barridosPendientes, i: <ScanLine />, t: k.barridosPendientes ? 'amber' : 'green', to: '/barridos' },
    { l: 'Barridos completados (ciclo)', v: k.barridosCompletados, i: <CheckCircle2 />, t: 'green', to: '/barridos' },
    { l: 'Ciclos vencidos (24 h)', v: k.barridosVencidos, i: <AlertTriangle />, t: k.barridosVencidos ? 'red' : 'green', to: '/barridos' },
    { l: 'Tiempos muertos excesivos', v: k.tiemposMuertos, i: <Timer />, t: k.tiemposMuertos ? 'red' : 'green', to: '/seguimiento' },
    { l: 'Pendientes de escalamiento', v: k.pendientesEscalamiento, i: <ArrowUpRight />, t: k.pendientesEscalamiento ? 'red' : 'green', to: '/alertas' },
    { l: 'Actividades pendientes del turno', v: k.pendientesTurno, i: <ClipboardList />, t: k.pendientesTurno ? 'amber' : 'gray', to: '/turnos' },
  ] as const;
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Tablero operativo</h1><p className="text-ink-500">Calculado {fmtDateTime(data.generatedAt)} · se actualiza cada 30 s</p></div>
        {stale && <Notice tone="red">La información no se ha podido actualizar desde {ago(new Date(dataUpdatedAt))}.</Notice>}
      </div>
      <Notice tone={data.dataStatus.gpsIntegration === 'ACTIVA' ? 'green' : 'blue'} icon={<Info className="h-5 w-5 shrink-0" />}>
        <b>Origen de datos:</b> {data.dataStatus.message}. Última posición recibida: {data.dataStatus.latestPositionAt ? fmtDateTime(data.dataStatus.latestPositionAt) : 'ninguna'}.
      </Notice>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 [&_svg]:h-5 [&_svg]:w-5">
        {items.map((x) => <Stat key={x.l} label={x.l} value={x.v} icon={x.i} tone={('t' in x ? x.t : 'gray') as never} onClick={() => nav(x.to)} />)}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Calidad de la información de posición">
          {[['Actualizada', f.actualizada, 'bg-brand-500'], ['Atrasada', f.atrasada, 'bg-amber-500'], ['Sin comunicación', f.sinComunicacion, 'bg-red-500'], ['No disponible', f.noDisponible, 'bg-ink-300']].map(([l, v, c]) => (
            <div key={l as string} className="flex items-center gap-3 py-1.5"><span className={`h-3 w-3 rounded-full ${c}`} /><span className="flex-1 text-sm">{l}</span><span className="font-bold tabular-nums">{v}</span></div>
          ))}
        </Card>
        <Card title="Unidades con información atrasada o no disponible" className="lg:col-span-2" padded={false}>
          <div className="grid gap-px bg-ink-100 sm:grid-cols-2">
            {data.attention.filter((a) => a.freshness !== 'ACTUALIZADA').slice(0, 12).map((a) => (
              <button key={a.id} onClick={() => nav(`/flota/${a.id}`)} className="flex items-center gap-2 bg-white px-5 py-3 text-left hover:bg-ink-50">
                <b className="w-20">{a.economicNumber}</b><Freshness value={a.freshness} /><span className="text-xs text-ink-500">{a.minutesSincePosition !== null ? `${a.minutesSincePosition} min` : ''}</span><span className="ml-auto"><SourceTag source={a.dataSource} /></span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
