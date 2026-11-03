import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Siren, Flame, Droplets, Car, ShieldAlert, HeartPulse, Wind, PhoneCall, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useApi, useAction, api } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, Field, Modal, Notice, PageHeader, Select, Spinner, Textarea } from '../components/ui';

/* eslint-disable @typescript-eslint/no-explicit-any */
const EMERG = [
  { type: 'POSIBLE_ROBO', label: 'Posible robo', icon: <ShieldAlert /> },
  { type: 'ACCIDENTE', label: 'Choque / volcadura', icon: <Car /> },
  { type: 'FUGA', label: 'Fuga', icon: <Wind /> },
  { type: 'DERRAME', label: 'Derrame', icon: <Droplets /> },
  { type: 'INCENDIO', label: 'Incendio', icon: <Flame /> },
  { type: 'EMERGENCIA_OPERADOR', label: 'Emergencia del operador', icon: <HeartPulse /> },
];

export function ProtocolsPage() {
  const { can } = useAuth();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [start, setStart] = useState<string | null>(sp.get('emergencia') ? '' : null);
  const [open, setOpen] = useState<string | null>(null);
  const [unitId, setUnitId] = useState('');
  const [desc, setDesc] = useState('');
  const { data: protocols, isLoading } = useApi<any[]>(['protocols'], '/incidents/protocols');
  const fleet = useApi<any[]>(['fleet', null], start !== null ? '/units/fleet' : null);
  const verified911 = useApi<any[]>(['emergency'], '/emergency-contacts');
  const create = useAction((v: any) => api.post<{ id: string }>('/incidents', v), { success: 'Incidencia de emergencia abierta y escalada a Gerencia', onSuccess: (r) => nav(`/incidencias/${r.id}`) });
  const c911 = verified911.data?.find((c) => c.category === 'EMERGENCIAS_911');
  return (
    <>
      <PageHeader title="Protocolos de seguridad" subtitle="Procedimientos interactivos paso a paso · Monitorista → Gerencia → Operaciones Estratégicas" />
      {can('incidents.manage') && (
        <Card title="Iniciar protocolo de emergencia" subtitle="Abre el expediente y escala de inmediato" className="mb-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {EMERG.map((e) => (
              <button key={e.type} onClick={() => setStart(e.type)} className="flex flex-col items-center gap-2 rounded-2xl border-2 border-red-100 bg-red-50 p-4 font-semibold text-red-800 transition hover:border-red-300 [&_svg]:h-7 [&_svg]:w-7">{e.icon}{e.label}</button>
            ))}
          </div>
          <div className="mt-4"><Notice tone="red" icon={<PhoneCall className="h-5 w-5 shrink-0" />}>Si hay riesgo para personas, llame al 911 antes de cualquier registro. {c911 ? <a href={`tel:${c911.phone}`} className="font-bold underline">Marcar {c911.phone}</a> : null}{c911 && c911.status !== 'VERIFICADO' && ' (procedimiento pendiente de verificación en el directorio)'}</Notice></div>
        </Card>
      )}
      {isLoading ? <Spinner /> : (
        <div className="space-y-3">
          {protocols?.map((p) => (
            <div key={p.key} className="card">
              <button className="flex w-full items-center justify-between px-5 py-4 text-left" onClick={() => setOpen(open === p.key ? null : p.key)}>
                <span className="flex items-center gap-3"><Siren className="h-5 w-5 text-brand-700" /><span className="font-semibold">{p.name}</span><Badge>{p.steps.length} pasos</Badge></span>
                <ChevronDown className={clsx('h-5 w-5 transition', open === p.key && 'rotate-180')} />
              </button>
              {open === p.key && (
                <div className="border-t border-ink-100 px-5 py-4">
                  {p.warning && <div className="mb-3"><Notice tone="amber">{p.warning}</Notice></div>}
                  <ol className="space-y-3">{p.steps.map((s: any, i: number) => <li key={s.key} className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-800">{i + 1}</span><div><p className="font-medium">{s.title} {s.critical && <Badge tone="red">Crítico</Badge>}</p><p className="text-sm text-ink-600">{s.detail}</p></div></li>)}</ol>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <Modal open={start !== null} onClose={() => { setStart(null); setSp({}); }} title="Iniciar protocolo de emergencia" footer={<>
        <Button variant="secondary" onClick={() => setStart(null)}>Cancelar</Button>
        <Button variant="danger" disabled={!start} loading={create.isPending} onClick={() => create.mutate({ type: start, priority: 'CRITICA', unitId: unitId || null, title: EMERG.find((e) => e.type === start)?.label ?? 'Emergencia', description: desc || undefined })}>Abrir y escalar</Button>
      </>}>
        <div className="space-y-4">
          <Field label="Tipo de emergencia"><Select value={start ?? ''} onChange={(e) => setStart(e.target.value)} placeholder="Seleccione…" options={EMERG.map((e) => ({ value: e.type, label: e.label }))} /></Field>
          <Field label="Unidad"><Select value={unitId} onChange={(e) => setUnitId(e.target.value)} placeholder="Seleccione la unidad…" options={(fleet.data ?? []).map((u) => ({ value: u.id, label: `${u.economicNumber} · ${u.operator?.fullName ?? 'sin operador'}` }))} /></Field>
          <Field label="Lo que se sabe (opcional)"><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
        </div>
      </Modal>
    </>
  );
}
