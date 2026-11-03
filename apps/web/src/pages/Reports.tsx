import { useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { useApi } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import { Button, Card, Field, Input, Notice, PageHeader, Progress, Select, Spinner, Stat, Table } from '../components/ui';
import { qs } from '../lib/api';
import { ALERT_TYPES } from '../lib/labels';

/* eslint-disable @typescript-eslint/no-explicit-any */
const p = (v: number | null) => (v === null ? 'Sin datos' : `${v}%`);
const m = (v: number | null) => (v === null ? 'Sin datos' : `${v} min`);
const t = (v: number | null): 'green' | 'amber' | 'red' | 'gray' => (v === null ? 'gray' : v >= 95 ? 'green' : v >= 85 ? 'amber' : 'red');

export function ReportsPage() {
  const { can } = useAuth();
  const [f, setF] = useState({ period: 'weekly', from: '', to: '', unitId: '', monitoristaId: '', baseId: '', clientId: '', incidentType: '' });
  const query = qs({ ...f, from: f.period === 'custom' ? f.from : undefined, to: f.period === 'custom' ? f.to : undefined });
  const { data: k, isLoading, error } = useApi<any>(['kpis', query], `/reports/kpis${query}`);
  const units = useApi<any[]>(['units-all'], '/units');
  const users = useApi<any[]>(['users'], '/admin/users');
  const bases = useApi<any[]>(['bases'], '/catalogs/bases');
  const clients = useApi<any[]>(['clients'], '/catalogs/clients');
  const Bars = ({ rows }: { rows: { key: string; count: number }[] }) => {
    const max = Math.max(1, ...rows.map((r) => r.count));
    return rows.length ? <div className="space-y-2">{rows.slice(0, 8).map((r) => <div key={r.key} className="text-sm"><div className="flex justify-between"><span>{ALERT_TYPES[r.key] ?? r.key}</span><b>{r.count}</b></div><Progress value={(r.count / max) * 100} /></div>)}</div> : <p className="text-sm text-ink-400">Sin registros</p>;
  };
  return (
    <>
      <PageHeader title="Indicadores y reportes de Gerencia" subtitle="Reportes diarios, semanales y mensuales con filtros" actions={can('reports.export') && <>
        <a href={`/api/reports/export.xlsx${query}`}><Button variant="secondary" icon={<FileSpreadsheet className="h-4 w-4" />}>Excel</Button></a>
        <a href={`/api/reports/export.pdf${query}`}><Button variant="secondary" icon={<Download className="h-4 w-4" />}>PDF</Button></a>
      </>} />
      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <Field label="Periodo"><Select value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })} options={{ daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual', custom: 'Personalizado' }} /></Field>
          {f.period === 'custom' && <><Field label="Desde"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field><Field label="Hasta"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field></>}
          <Field label="Unidad"><Select value={f.unitId} onChange={(e) => setF({ ...f, unitId: e.target.value })} placeholder="Todas" options={(units.data ?? []).map((u) => ({ value: u.id, label: u.economicNumber }))} /></Field>
          <Field label="Monitorista"><Select value={f.monitoristaId} onChange={(e) => setF({ ...f, monitoristaId: e.target.value })} placeholder="Todos" options={(users.data ?? []).map((u) => ({ value: u.id, label: u.fullName }))} /></Field>
          <Field label="Base"><Select value={f.baseId} onChange={(e) => setF({ ...f, baseId: e.target.value })} placeholder="Todas" options={(bases.data ?? []).map((b) => ({ value: b.id, label: b.name }))} /></Field>
          <Field label="Cliente"><Select value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })} placeholder="Todos" options={(clients.data ?? []).map((c) => ({ value: c.id, label: c.name }))} /></Field>
          <Field label="Tipo de incidencia"><Select value={f.incidentType} onChange={(e) => setF({ ...f, incidentType: e.target.value })} placeholder="Todos" options={ALERT_TYPES} /></Field>
        </div>
      </Card>
      {isLoading ? <Spinner /> : error || !k ? <Notice tone="red">{(error as Error)?.message}</Notice> : (
        <div className="space-y-5">
          {k.dataQuality.length > 0 && <Notice tone="gray"><b>Calidad de datos:</b> {k.dataQuality.join(' · ')}</Notice>}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Cumplimiento de barridos" value={p(k.sweeps.compliancePct)} tone={t(k.sweeps.compliancePct)} hint={`${k.sweeps.completedCycles}/${k.sweeps.closedCycles} ciclos`} />
            <Stat label="Cobertura verificada" value={p(k.sweeps.coveragePct)} tone={t(k.sweeps.coveragePct)} hint={`${k.sweeps.reviewed}/${k.sweeps.reviews} revisiones`} />
            <Stat label="Disponibilidad de cámaras" value={p(k.cameras.availabilityPct)} tone={t(k.cameras.availabilityPct)} hint={`MTTR ${m(k.cameras.mttrMinutes)}`} />
            <Stat label="Disponibilidad de GPS" value={p(k.gps.availabilityPct)} tone={t(k.gps.availabilityPct)} hint={k.gps.basis} />
            <Stat label="Tiempo de detección" value={m(k.alerts.detectionAvgMin)} />
            <Stat label="Primera respuesta" value={m(k.alerts.firstResponseAvgMin)} />
            <Stat label="Tiempo de escalamiento" value={m(k.alerts.escalationAvgMin)} />
            <Stat label="Alertas vencidas" value={k.alerts.overdue} tone={k.alerts.overdue ? 'red' : 'green'} hint={`de ${k.alerts.total}`} />
            <Stat label="Casos pendientes" value={k.pendingCases} tone={k.pendingCases ? 'amber' : 'green'} />
            <Stat label="Tiempo muerto operativo" value={`${k.deadTime.totalMinutes} min`} hint={`${k.deadTime.stops} paradas · excluye ${k.deadTime.protectedStopsExcluded} protegidas`} />
            <Stat label="Cumplimiento de resguardo" value={p(k.curfew.compliancePct)} tone={t(k.curfew.compliancePct)} hint={`${k.curfew.breaches} incumplimientos`} />
            <Stat label="Entrega de turno" value={p(k.handover.compliancePct)} tone={t(k.handover.compliancePct)} hint={`${k.handover.unconfirmed} sin confirmar`} />
            <Stat label="Asistencia a capacitación" value={p(k.training.attendancePct)} tone={t(k.training.attendancePct)} hint={`${k.training.held}/${k.training.sessions} sesiones`} />
            <Stat label="Acuerdos cumplidos" value={p(k.training.agreementsMetPct)} tone={t(k.training.agreementsMetPct)} />
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            <Card title="Incidencias por categoría"><Bars rows={k.incidents.byCategory} /></Card>
            <Card title="Incidencias por unidad"><Bars rows={k.incidents.byUnit} /></Card>
            <Card title="Incidencias por operador"><Bars rows={k.incidents.byOperator} /></Card>
            <Card title="Alertas por tipo"><Bars rows={k.alerts.byType} /></Card>
            <Card title="Revisiones por monitorista"><Bars rows={k.monitoristas.map((x: any) => ({ key: x.name, count: x.count }))} /></Card>
            <Card title="Cámaras con menor disponibilidad" padded={false}><Table head={['Unidad', '%']} empty={!k.cameras.worstUnits.length}>{k.cameras.worstUnits.map((u: any) => <tr key={u.unitId}><td>{u.economicNumber}</td><td>{u.availabilityPct}%</td></tr>)}</Table></Card>
          </div>
        </div>
      )}
    </>
  );
}
