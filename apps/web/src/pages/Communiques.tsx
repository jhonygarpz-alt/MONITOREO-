import { forwardRef, useRef, useState } from 'react';
import { Plus, Download, Share2, Check as CheckIcon, X } from 'lucide-react';
import clsx from 'clsx';
import { useApi, useAction, api } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import { Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Spinner, StatusBadge, Textarea } from '../components/ui';
import { FormModal } from '../components/forms';
import { useToast } from '../components/toast';
import { exportPng, shareImage } from '../lib/export';
import { fmtDate, fmtDateTime } from '../lib/format';
import logo from '../logo.svg';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const COMM_TYPES = { AVISO_PREVENTIVO: 'Aviso preventivo', REGLA_SEGURIDAD: 'Regla de seguridad', HORARIO_CIRCULACION: 'Horario de circulación', RECORDATORIO: 'Recordatorio', INSTRUCCION_OPERATIVA: 'Instrucción operativa', CAMPANA_SEGURIDAD: 'Campaña de seguridad', CAMBIO_PROCEDIMIENTO: 'Cambio de procedimiento' };

export const CommuniqueCard = forwardRef<HTMLDivElement, { templateKey: string; type: string; title: string; body: string; folio?: string; date?: string }>(({ templateKey, type, title, body, folio, date }, ref) => {
  const accent = templateKey === 'preventivo' ? 'bg-amber-500' : templateKey === 'critico' ? 'bg-red-600' : 'bg-brand-500';
  return (
    <div ref={ref} className="w-full max-w-[560px] overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-ink-200" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="bg-gradient-to-br from-brand-700 to-brand-900 px-7 py-6 text-white">
        <div className="flex items-center gap-3"><img src={logo} className="h-10 w-10" alt="" /><div><p className="text-sm font-bold tracking-wide">CENTRO INTELIGENTE DE MONITOREO</p><p className="text-xs text-brand-100">Control Operativo y Seguridad Patrimonial</p></div></div>
      </div>
      <div className={clsx('h-1.5', accent)} />
      <div className={clsx('px-7', templateKey === 'campana' ? 'py-10 text-center' : 'py-7')}>
        <p className={clsx('text-xs font-bold uppercase tracking-widest', templateKey === 'critico' ? 'text-red-600' : templateKey === 'preventivo' ? 'text-amber-600' : 'text-brand-700')}>{COMM_TYPES[type as keyof typeof COMM_TYPES]}</p>
        <h2 className={clsx('mt-2 font-bold leading-tight text-ink-900', templateKey === 'campana' ? 'text-3xl' : 'text-2xl')}>{title || 'Título del comunicado'}</h2>
        <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-ink-700">{body || 'Escriba el mensaje…'}</p>
      </div>
      <div className="flex items-center justify-between border-t border-ink-100 bg-ink-50 px-7 py-3 text-xs text-ink-500"><span>{folio ?? 'BORRADOR'}</span><span>{date ? fmtDate(date) : fmtDate(new Date())}</span></div>
    </div>
  );
});

export function CommuniquesPage() {
  const { can, me } = useAuth();
  const toast = useToast();
  const [create, setCreate] = useState(false);
  const [view, setView] = useState<any>(null);
  const [dist, setDist] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const list = useApi<any[]>(['communiques'], '/communiques');
  const templates = useApi<any[]>(['templates'], '/communiques/templates');
  const inv = [['communiques']];
  const save = useAction((v: any) => api.post('/communiques', v), { invalidate: inv, success: (r: any) => (r.status === 'PENDIENTE_APROBACION' ? 'Comunicado enviado a aprobación de Gerencia' : 'Comunicado creado') });
  const decide = useAction((v: any) => api.post(`/communiques/${v.id}/decide`, v), { invalidate: inv, success: 'Decisión registrada', onSuccess: () => setView(null) });
  const distribute = useAction((v: any) => api.post(`/communiques/${v.id}/distribute`, v), { invalidate: inv, success: 'Distribución registrada' });
  return (
    <>
      <PageHeader title="Comunicados oficiales" subtitle="Plantillas institucionales verde y blanco" actions={can('communiques.create') && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreate(true)}>Nuevo comunicado</Button>} />
      {list.isLoading ? <Spinner /> : !list.data?.length ? <Card><Empty title="Sin comunicados" /></Card> : (
        <Card padded={false}>
          <ul className="divide-y divide-ink-100">
            {list.data.map((c) => (
              <li key={c.id}><button className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-ink-50" onClick={() => setView(c)}>
                <div className="flex-1"><p className="font-semibold">{c.title}</p><p className="text-sm text-ink-500">{c.folio} · {COMM_TYPES[c.type as keyof typeof COMM_TYPES]} · {fmtDateTime(c.createdAt)} · {c.distributions.length} distribuciones</p></div>
                <StatusBadge value={c.status} />
              </button></li>
            ))}
          </ul>
        </Card>
      )}
      <FormModal open={create} onClose={() => setCreate(false)} wide title="Nuevo comunicado" initial={{ type: 'AVISO_PREVENTIVO', templateKey: 'institucional', title: '', body: '' }} onSubmit={(v) => save.mutateAsync(v)} submitLabel="Guardar">
        {(v, set) => <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <Field label="Tipo"><Select value={v.type} onChange={(e) => set({ type: e.target.value })} options={COMM_TYPES} /></Field>
            <Field label="Plantilla"><Select value={v.templateKey} onChange={(e) => set({ templateKey: e.target.value })} options={(templates.data ?? []).map((t) => ({ value: t.key, label: t.name }))} /></Field>
            <Field label="Título"><Input value={v.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} /></Field>
            <Field label="Mensaje" hint="Claro y breve"><Textarea rows={7} value={v.body} onChange={(e) => set({ body: e.target.value })} maxLength={2000} /></Field>
            {['REGLA_SEGURIDAD', 'HORARIO_CIRCULACION', 'INSTRUCCION_OPERATIVA', 'CAMBIO_PROCEDIMIENTO'].includes(v.type) && <p className="text-xs text-amber-700">Este tipo requiere aprobación de Gerencia antes de distribuirse.</p>}
          </div>
          <div><p className="label">Vista previa</p><CommuniqueCard templateKey={v.templateKey} type={v.type} title={v.title} body={v.body} /></div>
        </div>}
      </FormModal>
      <Modal open={!!view} onClose={() => setView(null)} wide title={view?.folio ?? ''} footer={view && <>
        {view.status === 'PENDIENTE_APROBACION' && can('communiques.approve') && view.createdById !== me?.id && <><Button variant="secondary" icon={<X className="h-4 w-4" />} onClick={() => decide.mutate({ id: view.id, approve: false, comment: 'Requiere ajustes' })}>Rechazar</Button><Button icon={<CheckIcon className="h-4 w-4" />} onClick={() => decide.mutate({ id: view.id, approve: true })}>Aprobar</Button></>}
        {['APROBADO', 'PUBLICADO'].includes(view.status) && <>
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => ref.current && exportPng(ref.current, `${view.folio}.png`)}>Exportar PNG</Button>
          <Button icon={<Share2 className="h-4 w-4" />} onClick={async () => { if (!ref.current) return; await shareImage(ref.current, `${view.folio}.png`, `${view.title}\n\n${view.body}`); setDist(true); }}>Compartir</Button>
        </>}
      </>}>
        {view && <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
          <CommuniqueCard ref={ref} templateKey={view.templateKey} type={view.type} title={view.title} body={view.body} folio={view.folio} date={view.approvedAt ?? view.createdAt} />
          <div className="space-y-3 text-sm">
            <StatusBadge value={view.status} />
            {view.rejectionReason && <p className="text-red-600">Motivo de rechazo: {view.rejectionReason}</p>}
            <p className="font-semibold">Distribuciones</p>
            {!view.distributions.length && <p className="text-ink-500">Sin registros de distribución</p>}
            {view.distributions.map((d: any) => <p key={d.id} className="text-ink-600">{fmtDateTime(d.at)} · {d.channel} · {d.recipients}</p>)}
            {['APROBADO', 'PUBLICADO'].includes(view.status) && <Button size="sm" variant="secondary" onClick={() => setDist(true)}>Registrar distribución</Button>}
          </div>
        </div>}
      </Modal>
      <FormModal open={dist} onClose={() => setDist(false)} title="Registrar distribución" initial={{ channel: 'WHATSAPP', recipients: '' }} onSubmit={async (v) => { await distribute.mutateAsync({ id: view.id, ...v }); toast('Recuerde: solo se registra lo que efectivamente se envió', 'warning'); }}>
        {(v, set) => <><Field label="Medio"><Select value={v.channel} onChange={(e) => set({ channel: e.target.value })} options={{ WHATSAPP: 'WhatsApp', CORREO: 'Correo electrónico', IMPRESO: 'Impreso', PANTALLA: 'Pantalla', OTRO: 'Otro medio autorizado' }} /></Field><Field label="Destinatarios"><Textarea value={v.recipients} onChange={(e) => set({ recipients: e.target.value })} placeholder="Grupo de operadores base Nuevo Laredo…" /></Field></>}
      </FormModal>
    </>
  );
}
