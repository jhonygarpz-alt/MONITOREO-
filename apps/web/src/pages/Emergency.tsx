import { useState } from 'react';
import { Phone, Plus, ShieldCheck } from 'lucide-react';
import { useApi, useAction, api } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import { Button, Card, Empty, Field, Input, Notice, PageHeader, Select, Spinner, StatusBadge, Textarea } from '../components/ui';
import { FormModal } from '../components/forms';
import { fmtDate } from '../lib/format';
import { CHANNELS } from '../lib/labels';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function EmergencyPage() {
  const { can } = useAuth();
  const [modal, setModal] = useState<{ kind: 'new' | 'edit' | 'verify'; c?: any } | null>(null);
  const { data, isLoading } = useApi<any[]>(['emergency'], '/emergency-contacts');
  const inv = [['emergency']];
  const save = useAction((v: any) => (v.id ? api.put(`/emergency-contacts/${v.id}`, v) : api.post('/emergency-contacts', v)), { invalidate: inv, success: 'Contacto guardado (requiere verificación)' });
  const verify = useAction((v: any) => api.post(`/emergency-contacts/${v.id}/verify`, v), { invalidate: inv, success: 'Verificación registrada' });
  const groups = Object.keys(CHANNELS).filter((k) => k !== 'LLAMADA_OPERADOR').map((k) => ({ k, items: (data ?? []).filter((c) => c.category === k) }));
  return (
    <>
      <PageHeader title="Directorio de emergencias" subtitle="Contactos verificados para uso operativo" actions={can('emergency.manage') && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setModal({ kind: 'new' })}>Agregar contacto</Button>} />
      <div className="mb-5"><Notice tone="amber">No se generan números ficticios. Cada contacto debe cargarse desde una fuente oficial y <b>verificarse</b> (fecha y método) antes de usarse. Cambiar un número revoca su verificación.</Notice></div>
      {isLoading ? <Spinner /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((g) => (
            <Card key={g.k} title={CHANNELS[g.k]} padded={false}>
              {!g.items.length ? <Empty title="Sin contactos cargados" /> : (
                <ul className="divide-y divide-ink-100">
                  {g.items.map((c) => (
                    <li key={c.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="font-semibold">{c.name}</p><p className="text-sm text-ink-500">{c.coverage}{c.schedule && ` · ${c.schedule}`}</p></div>
                        <StatusBadge value={c.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <a href={`tel:${c.phone}`}><Button size="sm" variant={c.status === 'VERIFICADO' ? 'primary' : 'secondary'} icon={<Phone className="h-4 w-4" />}>{c.phone}</Button></a>
                        {c.altPhone && <a href={`tel:${c.altPhone}`}><Button size="sm" variant="secondary">{c.altPhone}{c.altContactName && ` (${c.altContactName})`}</Button></a>}
                        {can('emergency.verify') && <Button size="sm" variant="ghost" icon={<ShieldCheck className="h-4 w-4" />} onClick={() => setModal({ kind: 'verify', c })}>Verificar</Button>}
                        {can('emergency.manage') && <Button size="sm" variant="ghost" onClick={() => setModal({ kind: 'edit', c })}>Editar</Button>}
                      </div>
                      {c.procedure && <p className="mt-2 text-sm text-ink-600">{c.procedure}</p>}
                      <p className="mt-1 text-xs text-ink-400">{c.verifiedAt ? `Verificado ${fmtDate(c.verifiedAt)} · ${c.verificationNotes ?? ''}` : 'Nunca verificado'}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
      <FormModal key={modal?.c?.id ?? 'n'} open={modal?.kind === 'new' || modal?.kind === 'edit'} onClose={() => setModal(null)} title={modal?.c ? 'Editar contacto' : 'Agregar contacto'} initial={{ id: modal?.c?.id ?? '', category: modal?.c?.category ?? 'GUARDIA_NACIONAL', name: modal?.c?.name ?? '', phone: modal?.c?.phone ?? '', altPhone: modal?.c?.altPhone ?? '', altContactName: modal?.c?.altContactName ?? '', coverage: modal?.c?.coverage ?? '', schedule: modal?.c?.schedule ?? '', procedure: modal?.c?.procedure ?? '' }}
        onSubmit={(v) => save.mutateAsync({ ...v, id: v.id || undefined, altPhone: v.altPhone || null, altContactName: v.altContactName || null })}>
        {(v, set) => <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoría"><Select value={v.category} onChange={(e) => set({ category: e.target.value })} options={Object.fromEntries(Object.entries(CHANNELS).filter(([k]) => k !== 'LLAMADA_OPERADOR'))} /></Field>
          <Field label="Nombre"><Input value={v.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Número"><Input value={v.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
          <Field label="Cobertura"><Input value={v.coverage} onChange={(e) => set({ coverage: e.target.value })} /></Field>
          <Field label="Número alterno"><Input value={v.altPhone} onChange={(e) => set({ altPhone: e.target.value })} /></Field>
          <Field label="Contacto alterno"><Input value={v.altContactName} onChange={(e) => set({ altContactName: e.target.value })} /></Field>
          <Field label="Horario"><Input value={v.schedule} onChange={(e) => set({ schedule: e.target.value })} /></Field>
          <Field label="Procedimiento de contacto" className="sm:col-span-2"><Textarea value={v.procedure} onChange={(e) => set({ procedure: e.target.value })} /></Field>
        </div>}
      </FormModal>
      <FormModal open={modal?.kind === 'verify'} onClose={() => setModal(null)} title={`Verificar: ${modal?.c?.name}`} initial={{ result: 'VERIFICADO', notes: '' }} onSubmit={(v) => verify.mutateAsync({ id: modal!.c.id, ...v })}>
        {(v, set) => <><Field label="Resultado"><Select value={v.result} onChange={(e) => set({ result: e.target.value })} options={{ VERIFICADO: 'Verificado', VENCIDO: 'Ya no es válido', INACTIVO: 'Inactivo' }} /></Field><Field label="Método y fuente de verificación"><Textarea value={v.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Llamada de prueba el …, fuente oficial …" /></Field></>}
      </FormModal>
    </>
  );
}
