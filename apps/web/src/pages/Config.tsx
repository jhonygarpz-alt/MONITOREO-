import { useState } from 'react';
import { ShieldCheck, Plug, Users as UsersIcon, Settings } from 'lucide-react';
import { useApi, useAction, api } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, Field, Input, Notice, PageHeader, Select, StatusBadge, Table, Tabs, Textarea } from '../components/ui';
import { FormModal } from '../components/forms';
import { fmtDateTime } from '../lib/format';
import { label } from '../lib/labels';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function ConfigPage() {
  const { can, me } = useAuth();
  const [tab, setTab] = useState<'params' | 'changes' | 'thresholds' | 'matrix' | 'integrations' | 'roles' | 'jobs'>('params');
  const [edit, setEdit] = useState<any>(null);
  const [decide, setDecide] = useState<any>(null);
  const [th, setTh] = useState<any>(null);
  const [mx, setMx] = useState(false);
  const [integ, setInteg] = useState<any>(null);
  const [role, setRole] = useState<any>(null);
  const settings = useApi<any[]>(['settings'], '/admin/settings');
  const changes = useApi<any[]>(['changes'], '/admin/change-requests');
  const thresholds = useApi<any[]>(['thresholds'], '/ops/thresholds');
  const matrix = useApi<any[]>(['matrix'], tab === 'matrix' ? '/admin/escalation-matrix' : null);
  const users = useApi<any[]>(['users'], tab === 'matrix' ? '/admin/users' : null);
  const integrations = useApi<any[]>(['integrations'], tab === 'integrations' ? '/admin/integrations' : null);
  const roles = useApi<any[]>(['roles'], tab === 'roles' && can('admin.roles') ? '/admin/roles' : null);
  const perms = useApi<any[]>(['perms'], tab === 'roles' && can('admin.roles') ? '/admin/permissions' : null);
  const jobs = useApi<any[]>(['jobs'], tab === 'jobs' ? '/admin/jobs' : null);
  const inv = [['settings'], ['changes'], ['thresholds'], ['matrix'], ['integrations'], ['roles']];
  const reqSetting = useAction((v: any) => api.put(`/admin/settings/${v.key}`, v), { invalidate: inv, success: 'Solicitud de cambio creada: requiere autorización de otra persona' });
  const reqTh = useAction((v: any) => api.put(`/ops/thresholds/${v.type}`, v), { invalidate: inv, success: 'Solicitud de cambio creada' });
  const dec = useAction((v: any) => api.post(`/admin/change-requests/${v.id}/decide`, v), { invalidate: inv, success: 'Decisión registrada' });
  const addMx = useAction((v: any) => api.post('/admin/escalation-matrix', v), { invalidate: inv, success: 'Escalamiento configurado' });
  const delMx = useAction((id: string) => api.del(`/admin/escalation-matrix/${id}`), { invalidate: inv, success: 'Entrada desactivada' });
  const upInteg = useAction((v: any) => api.put(`/admin/integrations/${v.key}`, v), { invalidate: inv, success: 'Integración actualizada' });
  const reqRole = useAction((v: any) => api.put(`/admin/roles/${v.key}/permissions`, v), { invalidate: inv, success: 'Cambio de permisos solicitado' });
  const pending = changes.data?.filter((c) => c.status === 'PENDIENTE') ?? [];
  const fmtVal = (v: unknown) => (typeof v === 'object' ? JSON.stringify(v) : String(v));
  return (
    <>
      <PageHeader title="Administración y configuración" subtitle="Toda configuración crítica conserva historial y requiere autorización de una segunda persona" />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'params', label: 'Parámetros' }, { value: 'changes', label: 'Solicitudes de cambio', count: pending.length }, { value: 'thresholds', label: 'Tiempos muertos' }, { value: 'matrix', label: 'Matriz de escalamiento' }, { value: 'integrations', label: 'Integraciones' }, ...(can('admin.roles') ? [{ value: 'roles' as const, label: 'Roles y permisos' }] : []), { value: 'jobs', label: 'Automatizaciones' }]} />
      {tab === 'params' && <Card padded={false}><Table head={['Parámetro', 'Valor vigente', 'Tipo', 'Versión', '']}>{settings.data?.map((s) => <tr key={s.key}><td><p className="font-medium">{s.description}</p><p className="font-mono text-xs text-ink-400">{s.key}</p></td><td className="font-mono text-sm">{fmtVal(s.value)}</td><td>{s.critical ? <Badge tone="red">Crítico</Badge> : <Badge>Normal</Badge>}</td><td>v{s.version}</td><td>{can('admin.settings') && <Button size="sm" variant="ghost" onClick={() => setEdit(s)}>Solicitar cambio</Button>}</td></tr>)}</Table></Card>}
      {tab === 'changes' && <Card padded={false}><Table head={['Fecha', 'Configuración', 'Anterior → nuevo', 'Justificación', 'Estado', '']} empty={!changes.data?.length}>{changes.data?.map((c) => <tr key={c.id}><td>{fmtDateTime(c.requestedAt)}</td><td><b>{c.targetType}</b><p className="font-mono text-xs">{c.targetKey}</p></td><td className="max-w-xs font-mono text-xs">{fmtVal(c.oldValue)} → <b>{fmtVal(c.newValue)}</b></td><td className="max-w-xs text-sm">{c.reason}</td><td><StatusBadge value={c.status} />{c.decisionComment && <p className="text-xs text-ink-500">{c.decisionComment}</p>}</td><td>{c.status === 'PENDIENTE' && can('admin.settings.approve') && c.requestedById !== me?.id && <Button size="sm" onClick={() => setDecide(c)}>Decidir</Button>}{c.status === 'PENDIENTE' && c.requestedById === me?.id && <span className="text-xs text-ink-500">Requiere otra persona</span>}</td></tr>)}</Table></Card>}
      {tab === 'thresholds' && <Card padded={false}><Table head={['Operación', 'Advertencia', 'Máximo', 'Escalamiento', '']}>{thresholds.data?.map((t) => <tr key={t.id}><td className="font-medium">{label(t.operationType)}</td><td>{t.warnMinutes} min</td><td>{t.maxMinutes} min</td><td>{t.escalateMinutes} min</td><td>{can('admin.settings') && <Button size="sm" variant="ghost" onClick={() => setTh(t)}>Solicitar cambio</Button>}</td></tr>)}</Table></Card>}
      {tab === 'matrix' && (
        <Card title="Monitorista → Gerencia → Operaciones Estratégicas" subtitle="Si el titular no está disponible se notifica al suplente; sin matriz, se notifica a todo el rol y a su respaldo" action={can('admin.settings.approve') && <Button size="sm" onClick={() => setMx(true)}>Agregar</Button>} padded={false}>
          <Table head={['Nivel', 'Tipo de alerta', 'Titular', 'Suplente', 'Acuse (min)', '']} empty={!matrix.data?.length}>{matrix.data?.filter((m) => m.active).map((m) => <tr key={m.id}><td>{label(m.level)}</td><td>{m.alertType ?? 'Todas'}</td><td>{m.primaryUser.fullName} {!m.primaryUser.active && <Badge tone="red">Inactivo</Badge>}</td><td>{m.substituteUser?.fullName ?? <span className="text-red-600">Sin suplente</span>}</td><td>{m.ackTimeoutMinutes}</td><td>{can('admin.settings.approve') && <Button size="sm" variant="ghost" onClick={() => delMx.mutate(m.id)}>Desactivar</Button>}</td></tr>)}</Table>
        </Card>
      )}
      {tab === 'integrations' && (
        <div className="space-y-4">
          <Notice tone="blue" icon={<Plug className="h-5 w-5 shrink-0" />}>Las integraciones no se simulan. Una integración solo puede habilitarse tras documentar su validación técnica, legal y de seguridad. Mientras tanto, los datos se identifican como manuales o de demostración.</Notice>
          <Card padded={false}><Table head={['Integración', 'Tipo', 'Validada', 'Habilitada', 'Notas', '']}>{integrations.data?.map((i) => <tr key={i.id}><td className="font-medium">{i.name}</td><td>{i.kind}</td><td>{i.validated ? <Badge tone="green">Sí</Badge> : <Badge tone="amber">No</Badge>}</td><td>{i.enabled ? <Badge tone="green">Sí</Badge> : <Badge>No</Badge>}</td><td className="max-w-md text-xs text-ink-600">{i.notes}</td><td>{can('admin.integrations') && <Button size="sm" variant="ghost" onClick={() => setInteg(i)}>Gestionar</Button>}</td></tr>)}</Table></Card>
        </div>
      )}
      {tab === 'roles' && <div className="grid gap-4 md:grid-cols-2">{roles.data?.map((r) => <Card key={r.id} title={r.name} subtitle={`${r._count.users} usuarios · ${r.permissions.length} permisos`} action={<Button size="sm" variant="ghost" onClick={() => setRole({ key: r.key, name: r.name, perms: r.permissions.map((p: any) => p.permission.key) })}>Modificar</Button>}><p className="text-sm text-ink-600">{r.description}</p></Card>)}</div>}
      {tab === 'jobs' && <Card title="Ejecuciones del motor de reglas" subtitle="Se ejecuta en el servidor, con reintentos y protección contra duplicados" padded={false}><Table head={['Trabajo', 'Inicio', 'Estado', 'Intentos', 'Resultado']} empty={!jobs.data?.length}>{jobs.data?.map((j) => <tr key={j.id}><td className="font-mono text-xs">{j.job}</td><td>{fmtDateTime(j.startedAt)}</td><td><Badge tone={j.status === 'EXITOSO' ? 'green' : j.status === 'FALLIDO' ? 'red' : 'amber'}>{j.status}</Badge></td><td>{j.attempts}</td><td className="max-w-md truncate font-mono text-xs">{j.error ?? JSON.stringify(j.result)}</td></tr>)}</Table></Card>}

      {edit && <FormModal key={edit.key} open onClose={() => setEdit(null)} title={edit.description} initial={{ value: typeof edit.value === 'object' ? JSON.stringify(edit.value) : String(edit.value), reason: '' }} submitLabel="Solicitar autorización"
        onSubmit={(v) => { let value: unknown = v.value; if (typeof edit.value === 'number') value = Number(v.value); else if (typeof edit.value === 'boolean') value = v.value === 'true'; else if (typeof edit.value === 'object') value = JSON.parse(v.value); return reqSetting.mutateAsync({ key: edit.key, value, reason: v.reason }); }}>
        {(v, set) => <><p className="text-sm text-ink-500">Valor actual: <span className="font-mono">{fmtVal(edit.value)}</span></p>{typeof edit.value === 'boolean' ? <Field label="Nuevo valor"><Select value={v.value} onChange={(e) => set({ value: e.target.value })} options={{ true: 'Sí', false: 'No' }} /></Field> : <Field label="Nuevo valor"><Input value={v.value} onChange={(e) => set({ value: e.target.value })} /></Field>}<Field label="Justificación"><Textarea value={v.reason} onChange={(e) => set({ reason: e.target.value })} /></Field></>}
      </FormModal>}
      {th && <FormModal key={th.id} open onClose={() => setTh(null)} title={`Umbrales: ${label(th.operationType)}`} initial={{ warnMinutes: String(th.warnMinutes), maxMinutes: String(th.maxMinutes), escalateMinutes: String(th.escalateMinutes), reason: '' }} submitLabel="Solicitar autorización" onSubmit={(v) => reqTh.mutateAsync({ type: th.operationType, warnMinutes: Number(v.warnMinutes), maxMinutes: Number(v.maxMinutes), escalateMinutes: Number(v.escalateMinutes), reason: v.reason })}>
        {(v, set) => <><div className="grid grid-cols-3 gap-3"><Field label="Advertencia"><Input type="number" value={v.warnMinutes} onChange={(e) => set({ warnMinutes: e.target.value })} /></Field><Field label="Máximo"><Input type="number" value={v.maxMinutes} onChange={(e) => set({ maxMinutes: e.target.value })} /></Field><Field label="Escalar"><Input type="number" value={v.escalateMinutes} onChange={(e) => set({ escalateMinutes: e.target.value })} /></Field></div><Field label="Justificación"><Textarea value={v.reason} onChange={(e) => set({ reason: e.target.value })} /></Field></>}
      </FormModal>}
      {decide && <FormModal key={decide.id} open onClose={() => setDecide(null)} title="Autorizar cambio de configuración" initial={{ approve: 'true', comment: '' }} onSubmit={(v) => dec.mutateAsync({ id: decide.id, approve: v.approve === 'true', comment: v.comment })}>
        {(v, set) => <><p className="text-sm"><b>{decide.targetType}</b> · {decide.targetKey}</p><p className="font-mono text-xs">{fmtVal(decide.oldValue)} → {fmtVal(decide.newValue)}</p><p className="text-sm">Justificación: {decide.reason}</p><Field label="Decisión"><Select value={v.approve} onChange={(e) => set({ approve: e.target.value })} options={{ true: 'Aprobar y aplicar', false: 'Rechazar' }} /></Field><Field label="Comentario"><Textarea value={v.comment} onChange={(e) => set({ comment: e.target.value })} /></Field></>}
      </FormModal>}
      <FormModal open={mx} onClose={() => setMx(false)} title="Agregar escalamiento" initial={{ level: 'GERENCIA', primaryUserId: '', substituteUserId: '', ackTimeoutMinutes: '10' }} onSubmit={(v) => addMx.mutateAsync({ ...v, substituteUserId: v.substituteUserId || null, ackTimeoutMinutes: Number(v.ackTimeoutMinutes) })}>
        {(v, set) => <><Field label="Nivel"><Select value={v.level} onChange={(e) => set({ level: e.target.value })} options={{ GERENCIA: 'Gerencia', OPERACIONES_ESTRATEGICAS: 'Operaciones Estratégicas', MONITORISTA: 'Supervisión' }} /></Field><Field label="Titular"><Select value={v.primaryUserId} onChange={(e) => set({ primaryUserId: e.target.value })} placeholder="Seleccione…" options={(users.data ?? []).filter((u) => u.active).map((u) => ({ value: u.id, label: u.fullName }))} /></Field><Field label="Suplente"><Select value={v.substituteUserId} onChange={(e) => set({ substituteUserId: e.target.value })} placeholder="Seleccione…" options={(users.data ?? []).filter((u) => u.active).map((u) => ({ value: u.id, label: u.fullName }))} /></Field><Field label="Minutos para acuse"><Input type="number" value={v.ackTimeoutMinutes} onChange={(e) => set({ ackTimeoutMinutes: e.target.value })} /></Field></>}
      </FormModal>
      {integ && <FormModal key={integ.key} open onClose={() => setInteg(null)} title={integ.name} initial={{ validated: String(integ.validated), enabled: String(integ.enabled), notes: integ.notes ?? '' }} onSubmit={(v) => upInteg.mutateAsync({ key: integ.key, validated: v.validated === 'true', enabled: v.enabled === 'true', notes: v.notes })}>
        {(v, set) => <>{integ.kind === 'IMMOBILIZER' && <Notice tone="red">Aun habilitada, esta versión no envía comandos físicos.</Notice>}<Field label="Validación documentada"><Select value={v.validated} onChange={(e) => set({ validated: e.target.value })} options={{ false: 'No validada', true: 'Validada' }} /></Field><Field label="Habilitada"><Select value={v.enabled} onChange={(e) => set({ enabled: e.target.value })} options={{ false: 'No', true: 'Sí' }} /></Field><Field label="Evidencia de validación / notas"><Textarea rows={4} value={v.notes} onChange={(e) => set({ notes: e.target.value })} /></Field></>}
      </FormModal>}
      {role && <FormModal key={role.key} open wide onClose={() => setRole(null)} title={`Permisos · ${role.name}`} initial={{ perms: role.perms as string[], reason: '' }} submitLabel="Solicitar autorización" onSubmit={(v) => reqRole.mutateAsync({ key: role.key, permissions: v.perms, reason: v.reason })}>
        {(v, set) => <><div className="grid max-h-[50vh] gap-1 overflow-y-auto sm:grid-cols-2">{perms.data?.map((p) => <label key={p.key} className="flex items-start gap-2 rounded-lg p-1.5 text-sm hover:bg-ink-50"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-700" checked={v.perms.includes(p.key)} onChange={(e) => set({ perms: e.target.checked ? [...v.perms, p.key] : v.perms.filter((x) => x !== p.key) })} /><span>{p.description} {p.critical && <ShieldCheck className="inline h-3.5 w-3.5 text-red-500" />}<span className="block font-mono text-[11px] text-ink-400">{p.module} · {p.key}</span></span></label>)}</div><Field label="Justificación"><Textarea value={v.reason} onChange={(e) => set({ reason: e.target.value })} /></Field></>}
      </FormModal>}
      <span className="hidden"><Settings /><UsersIcon /></span>
    </>
  );
}
