import { useState, type ReactNode } from 'react';
import { Button, Modal } from './ui';

/** Formulario modal genérico: el botón Guardar muestra progreso y solo cierra si el servidor confirmó. */
export function FormModal<T extends Record<string, unknown>>({ open, onClose, title, initial, onSubmit, children, submitLabel = 'Guardar', wide, danger }: {
  open: boolean; onClose: () => void; title: string; initial: T; onSubmit: (v: T) => Promise<unknown>; children: (v: T, set: (p: Partial<T>) => void) => ReactNode; submitLabel?: string; wide?: boolean; danger?: boolean;
}) {
  const [v, setV] = useState<T>(initial);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<T>) => setV((x) => ({ ...x, ...p }));
  return (
    <Modal open={open} onClose={onClose} title={title} wide={wide} footer={<>
      <Button variant="secondary" onClick={onClose}>Cancelar</Button>
      <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={async () => { setBusy(true); try { await onSubmit(v); onClose(); setV(initial); } catch { /* el toast ya informó */ } finally { setBusy(false); } }}>{submitLabel}</Button>
    </>}>
      <div className="space-y-4">{children(v, set)}</div>
    </Modal>
  );
}
