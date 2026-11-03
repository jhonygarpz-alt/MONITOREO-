import { useRef, useState } from 'react';
import { FileUp, FileText, Download } from 'lucide-react';
import { useApi, useAction, api } from '../lib/hooks';
import { useAuth } from '../auth/AuthContext';
import { Button, Empty, Field, Input, Select } from './ui';
import { fmtDate } from '../lib/format';

const CATS = { FOTOGRAFIA: 'Fotografía', TARJETA_CIRCULACION: 'Tarjeta de circulación', POLIZA: 'Póliza', PERMISO_SCT: 'Permiso SCT', VERIFICACION: 'Verificación', EVIDENCIA: 'Evidencia', LICENCIA: 'Licencia', HOJA_SEGURIDAD: 'Hoja de datos de seguridad', OTRO: 'Otro' };
interface Doc { id: string; title: string; category: string; filename: string; sizeBytes: number; uploadedAt: string; expiresAt: string | null; sha256: string }

export function Documents({ entityType, entityId, defaultCategory = 'OTRO' }: { entityType: string; entityId: string; defaultCategory?: string }) {
  const { can } = useAuth();
  const file = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [cat, setCat] = useState(defaultCategory);
  const [exp, setExp] = useState('');
  const docs = useApi<Doc[]>(['docs', entityId], `/documents?entityType=${entityType}&entityId=${entityId}`);
  const up = useAction((fd: FormData) => api.upload('/documents', fd), { invalidate: [['docs', entityId]], success: 'Documento cargado y registrado', onSuccess: () => { setTitle(''); if (file.current) file.current.value = ''; } });
  return (
    <div className="space-y-4">
      {can('documents.upload') && (
        <div className="grid gap-3 rounded-2xl bg-ink-50 p-4 md:grid-cols-[1fr_1fr_160px_auto] md:items-end">
          <Field label="Título"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Categoría"><Select value={cat} onChange={(e) => setCat(e.target.value)} options={CATS} /></Field>
          <Field label="Vence (opcional)"><Input type="date" value={exp} onChange={(e) => setExp(e.target.value)} /></Field>
          <div className="flex gap-2">
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0]; if (!f) return;
              const fd = new FormData(); fd.append('file', f); fd.append('entityType', entityType); fd.append('entityId', entityId); fd.append('category', cat); fd.append('title', title || f.name); if (exp) fd.append('expiresAt', exp);
              up.mutate(fd);
            }} />
            <Button icon={<FileUp className="h-4 w-4" />} loading={up.isPending} onClick={() => file.current?.click()}>Cargar archivo</Button>
          </div>
        </div>
      )}
      {!docs.data?.length ? <Empty title="Sin documentos" /> : (
        <ul className="divide-y divide-ink-100">
          {docs.data.map((d) => (
            <li key={d.id} className="flex items-center gap-3 py-3">
              <FileText className="h-5 w-5 text-ink-400" />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{d.title}</p><p className="text-xs text-ink-500">{CATS[d.category as keyof typeof CATS]} · {fmtDate(d.uploadedAt)} · {(d.sizeBytes / 1024).toFixed(0)} KB{d.expiresAt && ` · vence ${fmtDate(d.expiresAt)}`}</p></div>
              <a href={`/api/documents/${d.id}/download`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm font-semibold text-brand-700"><Download className="h-4 w-4" />Ver</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
