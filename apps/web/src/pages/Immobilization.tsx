import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lock, ShieldAlert, Plus } from 'lucide-react';
import { useApi, useAction, api } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, Check, Empty, Field, Input, Notice, PageHeader, Select, Spinner, StatusBadge, Textarea } from '../components/ui';
import { FormModal } from '../components/forms';
import { fmtDateTime } from '../lib/format';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function ImmobilizationPage() {
  const { can, me } = useAuth();
  const [sp] = useSearchParams();
  const [modal, setModal] = useState<{ kind: 'new' | 'auth' | 'exec' | 'restore' | 'cancel'; r?: any } | null>(null);
  useEffect(() => { if (sp.get('unitId')) setModal({ kind: 'new' }); }, [sp]);
  const list = useApi<any[]>(['immob'], '/immobilization', { refetchInterval: 20000 });
  const fleet = useApi<any[]>(['fleet', null], modal?.kind === 'new' ? '/units/fleet' : null);
  const inv = [['immob']];
  const create = useAction((v: any) => api.post('/immobilization', v), { invalidate: inv, success: 'Solicitud registrada: requiere dos autorizaciones' });
  const auth = useAction((v: any) => api.post<any>(`/immobilization/${v.id}/authorize`, v), { invalidate: inv, success: (r) => (r.status === 'AUTORIZADA' ? 'Doble autorización completa' : r.status === 'RECHAZADA' ? 'Solicitud rechazada' : 'Primera autorización registrada') });
  const exec = useAction((v: any) => api.post<any>(`/immobilization/${v.id}/execution`, v), { invalidate: inv, success: (r) => (r.request.status === 'EJECUCION_REGISTRADA' ? 'Ejecución registrada con confirmación del proveedor' : 'Intento fallido registrado; la solicitud NO se marca como ejecutada') });
  const restore = useAction((v: any) => api.post(`/immobilization/${v.id}/restore`, v), { invalidate: inv, success: 'Restablecimiento registrado' });
  const cancel = useAction((v: any) => api.post(`/immobilization/${v.id}/cancel`, v), { invalidate: inv, success: 'Solicitud cancelada' });
  return (
    <>
      <PageHeader title="Control de comandos de inmovilización" subtitle="Flujo de solicitud, evaluación de riesgo, doble autorización y registro" actions={can('immob.request') && <Button variant="danger" icon={<Plus className="h-4 w-4" />} onClick={() => setModal({ kind: 'new' })}>Solicitar intervención</Button>} />
      <div className="mb-5"><Notice tone="red" icon={<ShieldAlert className="h-5 w-5 shrink-0" />}>
        <b>Este sistema no envía comandos al vehículo.</b> Nunca se permite intervenir una unidad en movimiento: solo se admite el bloqueo del <b>siguiente arranque</b> con la unidad detenida, confirmado por la última posición GPS. La ejecución se realiza en la plataforma del proveedor y aquí se registra únicamente con su folio de confirmación. La integración real requiere validar fabricante, compatibilidad, procedimientos legales y condiciones de seguridad.
      </Notice></div>
      {list.isLoading ? <Spinner /> : !list.data?.length ? <Card><Empty title="Sin solicitudes" icon={<Lock className="h-6 w-6" />} /></Card> : (
        <div className="space-y-3">
          {list.data.map((r) => {
            const mine = r.requestedById === me?.id;
            const already = r.authorizations.some((a: any) => a.approverId === me?.id);
            return (
              <div key={r.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="flex items-center gap-2 text-lg font-bold">{r.folio}<StatusBadge value={r.status} /></p><p className="text-sm text-ink-500">Unidad {r.unit.economicNumber} ({r.unit.plates}) · solicitada por {r.requestedBy.fullName} · {fmtDateTime(r.requestedAt)}{r.incident && ` · ${r.incident.folio}`}</p></div>
                  <Badge tone="blue">Bloqueo de siguiente arranque</Badge>
                </div>
                <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                  <p><b>Motivo:</b> {r.reason}</p><p><b>Evaluación de riesgo:</b> {r.riskAssessment}</p>
                  <p className="text-ink-600">Verificación al solicitar: {r.verifiedSpeedKph ?? '—'} km/h · posición {fmtDateTime(r.verifiedPositionAt)}</p>
                  <p className="text-ink-600">Autorizaciones: {r.authorizations.map((a: any) => `${a.approver.fullName} (${a.decision.toLowerCase()})`).join(', ') || 'ninguna'}</p>
                  {r.providerConfirmation && <p><b>Confirmación proveedor:</b> {r.providerConfirmation} · {r.executor?.fullName} · {fmtDateTime(r.executedAt)}</p>}
                  {r.executionNotes && <p className="text-ink-600">{r.executionNotes}</p>}
                  {r.restoredAt && <p><b>Restablecida:</b> {fmtDateTime(r.restoredAt)} · {r.restorationNotes}</p>}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['SOLICITADA', 'PRIMERA_AUTORIZACION'].includes(r.status) && can('immob.authorize') && !mine && !already && <Button onClick={() => setModal({ kind: 'auth', r })}>Autorizar / rechazar</Button>}
                  {['SOLICITADA', 'PRIMERA_AUTORIZACION'].includes(r.status) && (mine || already) && <span className="text-sm text-ink-500">Se requiere la autorización de otra persona.</span>}
                  {r.status === 'AUTORIZADA' && can('immob.execute') && <Button variant="danger" onClick={() => setModal({ kind: 'exec', r })}>Registrar ejecución</Button>}
                  {r.status === 'EJECUCION_REGISTRADA' && can('immob.execute') && <Button variant="secondary" onClick={() => setModal({ kind: 'restore', r })}>Registrar restablecimiento</Button>}
                  {['SOLICITADA', 'PRIMERA_AUTORIZACION', 'AUTORIZADA'].includes(r.status) && can('immob.request', 'immob.authorize') && <Button variant="ghost" onClick={() => setModal({ kind: 'cancel', r })}>Cancelar</Button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <FormModal open={modal?.kind === 'new'} onClose={() => setModal(null)} title="Solicitar intervención" danger submitLabel="Enviar solicitud" initial={{ unitId: sp.get('unitId') ?? '', incidentId: sp.get('incidentId') ?? '', reason: '', riskAssessment: '', vehicleStopped: false, safeLocation: false, noRiskToPeople: false, operatorStatusKnown: false, authoritiesInformed: false, notes: '' }}
        onSubmit={(v) => create.mutateAsync({ unitId: v.unitId, incidentId: v.incidentId || null, reason: v.reason, riskAssessment: v.riskAssessment, conditions: { vehicleStopped: v.vehicleStopped || undefined, safeLocation: v.safeLocation || undefined, noRiskToPeople: v.noRiskToPeople || undefined, operatorStatusKnown: v.operatorStatusKnown, authoritiesInformed: v.authoritiesInformed, notes: v.notes } })}>
        {(v, set) => <>
          <Field label="Unidad"><Select value={v.unitId} onChange={(e) => set({ unitId: e.target.value })} placeholder="Seleccione…" options={(fleet.data ?? []).map((u) => ({ value: u.id, label: `${u.economicNumber} · ${u.position ? `${u.position.speedKph ?? '—'} km/h` : 'sin posición'} · ${u.freshness}` }))} /></Field>
          <Field label="Motivo"><Textarea value={v.reason} onChange={(e) => set({ reason: e.target.value })} /></Field>
          <Field label="Evaluación de riesgo"><Textarea rows={4} value={v.riskAssessment} onChange={(e) => set({ riskAssessment: e.target.value })} /></Field>
          <p className="label">Condiciones verificadas</p>
          <Check checked={v.vehicleStopped} onChange={(b) => set({ vehicleStopped: b })} label="El vehículo está detenido" hint="El sistema lo valida con la última posición GPS actualizada" />
          <Check checked={v.safeLocation} onChange={(b) => set({ safeLocation: b })} label="La ubicación es segura (no en vía de circulación ni cruce)" />
          <Check checked={v.noRiskToPeople} onChange={(b) => set({ noRiskToPeople: b })} label="No hay riesgo para el operador ni para terceros" />
          <Check checked={v.operatorStatusKnown} onChange={(b) => set({ operatorStatusKnown: b })} label="Se conoce la condición del operador" />
          <Check checked={v.authoritiesInformed} onChange={(b) => set({ authoritiesInformed: b })} label="Las autoridades fueron informadas" />
        </>}
      </FormModal>
      <FormModal open={modal?.kind === 'auth'} onClose={() => setModal(null)} title={`Autorización ${modal?.r?.folio}`} initial={{ decision: 'RECHAZADA', comment: '' }} onSubmit={(v) => auth.mutateAsync({ id: modal!.r.id, ...v })}>
        {(v, set) => <><Notice tone="amber">Al aprobar, el sistema vuelve a verificar que la unidad esté detenida.</Notice><Field label="Decisión"><Select value={v.decision} onChange={(e) => set({ decision: e.target.value })} options={{ RECHAZADA: 'Rechazar', APROBADA: 'Aprobar' }} /></Field><Field label="Fundamento"><Textarea value={v.comment} onChange={(e) => set({ comment: e.target.value })} /></Field></>}
      </FormModal>
      <FormModal open={modal?.kind === 'exec'} onClose={() => setModal(null)} title="Registrar ejecución" danger initial={{ outcome: 'CONFIRMADA', providerConfirmation: '', executionNotes: '' }} onSubmit={(v) => exec.mutateAsync({ id: modal!.r.id, ...v })}>
        {(v, set) => <><Notice tone="red">Registre únicamente lo que el proveedor confirmó. Si no hubo confirmación, registre el intento como fallido.</Notice><Field label="Resultado"><Select value={v.outcome} onChange={(e) => set({ outcome: e.target.value })} options={{ CONFIRMADA: 'Confirmada por el proveedor', FALLIDA: 'Fallida / sin confirmación' }} /></Field><Field label="Folio o confirmación del proveedor"><Input value={v.providerConfirmation} onChange={(e) => set({ providerConfirmation: e.target.value })} /></Field><Field label="Detalle"><Textarea value={v.executionNotes} onChange={(e) => set({ executionNotes: e.target.value })} /></Field></>}
      </FormModal>
      <FormModal open={modal?.kind === 'restore'} onClose={() => setModal(null)} title="Registrar restablecimiento" initial={{ providerConfirmation: '', restorationNotes: '' }} onSubmit={(v) => restore.mutateAsync({ id: modal!.r.id, ...v })}>
        {(v, set) => <><Field label="Confirmación del proveedor"><Input value={v.providerConfirmation} onChange={(e) => set({ providerConfirmation: e.target.value })} /></Field><Field label="Detalle"><Textarea value={v.restorationNotes} onChange={(e) => set({ restorationNotes: e.target.value })} /></Field></>}
      </FormModal>
      <FormModal open={modal?.kind === 'cancel'} onClose={() => setModal(null)} title="Cancelar solicitud" initial={{ reason: '' }} onSubmit={(v) => cancel.mutateAsync({ id: modal!.r.id, ...v })}>
        {(v, set) => <Field label="Motivo"><Textarea value={v.reason} onChange={(e) => set({ reason: e.target.value })} /></Field>}
      </FormModal>
    </>
  );
}
