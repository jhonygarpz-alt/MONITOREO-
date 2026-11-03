import { useState } from 'react';
import { Phone, Plus, Search, Lock, MessageCircle } from 'lucide-react';
import { useApi, useAction, api } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, Empty, Field, Input, Modal, Notice, PageHeader, Select, Spinner, StatusBadge, Textarea } from '../components/ui';
import { SourceTag } from '../components/DataTag';
import { FormModal } from '../components/forms';
import { useToast } from '../components/toast';

/* eslint-disable @typescript-eslint/no-explicit-any */
const STATUS = { ACTIVO: 'Activo', DESCANSO: 'Descanso', VACACIONES: 'Vacaciones', INCAPACIDAD: 'Incapacidad', BAJA: 'Baja' };
export function OperatorsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState<{ kind: 'new' | 'edit' | 'sensitive'; o?: any } | null>(null);
  const [sensitive, setSensitive] = useState<any>(null);
  const [purpose, setPurpose] = useState('');
  const { data, isLoading } = useApi<any[]>(['operators', q, status], `/operators?q=${encodeURIComponent(q)}${status ? `&status=${status}` : ''}`);
  const bases = useApi<any[]>(['bases'], modal ? '/catalogs/bases' : null);
  const save = useAction((v: any) => (v.id ? api.put(`/operators/${v.id}`, v) : api.post('/operators', v)), { invalidate: [['operators']], success: 'Operador guardado' });
  const tel = (p?: string | null) => p?.replace(/\s|-/g, '');
  return (
    <>
      <PageHeader title="Directorio de operadores" subtitle="Datos personales con acceso controlado y finalidad definida" actions={can('operators.manage') && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setModal({ kind: 'new' })}>Nuevo operador</Button>} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><Input className="pl-9" placeholder="Nombre, número de empleado o unidad" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select className="sm:w-48" value={status} onChange={(e) => setStatus(e.target.value)} options={STATUS} placeholder="Todos los estatus" />
      </div>
      {isLoading ? <Spinner /> : !data?.length ? <Card><Empty title="Sin operadores" /></Card> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.map((o) => (
            <div key={o.id} className="card p-4">
              <div className="flex items-start justify-between"><div><p className="font-semibold">{o.fullName}</p><p className="text-xs text-ink-500">No. {o.employeeNo} · {o.base?.name ?? 'Sin base'}</p></div><div className="flex gap-1"><SourceTag source={o.dataSource} /><StatusBadge value={o.status} /></div></div>
              <p className="mt-2 text-sm text-ink-600">Unidad: {o.assignments[0]?.unit.economicNumber ?? <span className="text-ink-400">sin asignar</span>}</p>
              {o.authorizedNotes && <p className="mt-1 text-xs text-ink-500">{o.authorizedNotes}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {o.phonePrimary ? <a href={`tel:${tel(o.phonePrimary)}`}><Button size="sm" icon={<Phone className="h-4 w-4" />}>Llamar</Button></a> : <Badge>Sin teléfono</Badge>}
                {o.phonePrimary && <a href={`https://wa.me/${tel(o.phonePrimary)?.replace(/^\+/, '')}`} target="_blank" rel="noreferrer"><Button size="sm" variant="secondary" icon={<MessageCircle className="h-4 w-4" />}>WhatsApp</Button></a>}
                {o.phoneAlt && <a href={`tel:${tel(o.phoneAlt)}`}><Button size="sm" variant="secondary">Alterno</Button></a>}
                {can('operators.sensitive') && <Button size="sm" variant="ghost" icon={<Lock className="h-4 w-4" />} onClick={() => { setSensitive(null); setPurpose(''); setModal({ kind: 'sensitive', o }); }}>Contacto de emergencia</Button>}
                {can('operators.manage') && <Button size="sm" variant="ghost" onClick={() => setModal({ kind: 'edit', o })}>Editar</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={modal?.kind === 'sensitive'} onClose={() => setModal(null)} title="Contacto de emergencia (dato restringido)" footer={!sensitive && <Button onClick={async () => { try { setSensitive(await api.post(`/operators/${modal!.o.id}/emergency-contact`, { purpose })); } catch (e) { toast((e as Error).message, 'error'); } }}>Consultar</Button>}>
        {sensitive ? <div className="space-y-1"><p><b>{sensitive.emergencyContactName ?? 'No registrado'}</b> {sensitive.emergencyContactRelation && `(${sensitive.emergencyContactRelation})`}</p>{sensitive.emergencyContactPhone && <a className="font-semibold text-brand-700" href={`tel:${sensitive.emergencyContactPhone}`}>{sensitive.emergencyContactPhone}</a>}<p className="pt-3 text-xs text-ink-500">Consulta registrada en auditoría.</p></div>
          : <><Notice tone="amber">Este dato personal solo debe consultarse para una finalidad justificada. La consulta queda auditada.</Notice><div className="mt-3"><Field label="Finalidad de la consulta"><Textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} /></Field></div></>}
      </Modal>
      <FormModal key={modal?.o?.id ?? 'new'} open={modal?.kind === 'new' || modal?.kind === 'edit'} onClose={() => setModal(null)} title={modal?.o ? 'Editar operador' : 'Nuevo operador'} wide
        initial={{ id: modal?.o?.id ?? '', employeeNo: modal?.o?.employeeNo ?? '', fullName: modal?.o?.fullName ?? '', phonePrimary: modal?.o?.phonePrimary ?? '', phoneAlt: modal?.o?.phoneAlt ?? '', status: modal?.o?.status ?? 'ACTIVO', baseId: modal?.o?.baseId ?? '', authorizedNotes: modal?.o?.authorizedNotes ?? '', licenseNumber: modal?.o?.licenseNumber ?? '', licenseExpiresAt: modal?.o?.licenseExpiresAt?.slice(0, 10) ?? '', emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelation: '' }}
        onSubmit={(v) => { const b: any = { ...v, id: v.id || undefined, baseId: v.baseId || null, phonePrimary: v.phonePrimary || null, phoneAlt: v.phoneAlt || null, licenseExpiresAt: v.licenseExpiresAt || null }; ['emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation'].forEach((k) => { if (!b[k]) delete b[k]; }); return save.mutateAsync(b); }}>
        {(v, set) => <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre completo"><Input value={v.fullName} onChange={(e) => set({ fullName: e.target.value })} /></Field>
          <Field label="Número de empleado"><Input value={v.employeeNo} onChange={(e) => set({ employeeNo: e.target.value })} /></Field>
          <Field label="Teléfono principal"><Input value={v.phonePrimary} onChange={(e) => set({ phonePrimary: e.target.value })} /></Field>
          <Field label="Teléfono alterno"><Input value={v.phoneAlt} onChange={(e) => set({ phoneAlt: e.target.value })} /></Field>
          <Field label="Estatus"><Select value={v.status} onChange={(e) => set({ status: e.target.value })} options={STATUS} /></Field>
          <Field label="Base operativa"><Select value={v.baseId} onChange={(e) => set({ baseId: e.target.value })} placeholder="—" options={(bases.data ?? []).map((b) => ({ value: b.id, label: b.name }))} /></Field>
          <Field label="Licencia"><Input value={v.licenseNumber} onChange={(e) => set({ licenseNumber: e.target.value })} /></Field>
          <Field label="Vigencia de licencia"><Input type="date" value={v.licenseExpiresAt} onChange={(e) => set({ licenseExpiresAt: e.target.value })} /></Field>
          <Field label="Observaciones autorizadas" className="sm:col-span-2"><Textarea value={v.authorizedNotes} onChange={(e) => set({ authorizedNotes: e.target.value })} /></Field>
          {can('operators.sensitive') && <>
            <p className="label sm:col-span-2">Contacto de emergencia (restringido; deje vacío para no modificar)</p>
            <Field label="Nombre"><Input value={v.emergencyContactName} onChange={(e) => set({ emergencyContactName: e.target.value })} /></Field>
            <Field label="Teléfono"><Input value={v.emergencyContactPhone} onChange={(e) => set({ emergencyContactPhone: e.target.value })} /></Field>
            <Field label="Parentesco"><Input value={v.emergencyContactRelation} onChange={(e) => set({ emergencyContactRelation: e.target.value })} /></Field>
          </>}
        </div>}
      </FormModal>
    </>
  );
}
