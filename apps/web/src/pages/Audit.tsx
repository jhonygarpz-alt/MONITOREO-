import { useState } from 'react';
import { ShieldCheck, ShieldX } from 'lucide-react';
import { useApi } from '../lib/hooks';
import { Badge, Button, Card, Field, Input, Notice, PageHeader, Spinner, Table } from '../components/ui';
import { fmtDateTime } from '../lib/format';
import { qs } from '../lib/api';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function AuditPage() {
  const [f, setF] = useState({ action: '', entityType: '', from: '', to: '' });
  const [skip, setSkip] = useState(0);
  const [check, setCheck] = useState(false);
  const { data, isLoading } = useApi<{ total: number; rows: any[] }>(['audit', f, skip], `/admin/audit${qs({ ...f, take: 50, skip })}`);
  const verify = useApi<{ ok: boolean; checked: number; brokenAtSeq?: string }>(['audit-verify'], check ? '/admin/audit/verify' : null);
  return (
    <>
      <PageHeader title="Auditoría" subtitle="Bitácora inalterable con hash encadenado. Nadie puede modificar ni eliminar registros." actions={<Button variant="secondary" icon={<ShieldCheck className="h-4 w-4" />} onClick={() => setCheck(true)}>Verificar integridad</Button>} />
      {verify.data && <div className="mb-4"><Notice tone={verify.data.ok ? 'green' : 'red'} icon={verify.data.ok ? <ShieldCheck className="h-5 w-5" /> : <ShieldX className="h-5 w-5" />}>{verify.data.ok ? `Cadena íntegra: ${verify.data.checked} registros verificados.` : `Integridad comprometida en el registro #${verify.data.brokenAtSeq}.`}</Notice></div>}
      <Card className="mb-4"><div className="grid gap-3 md:grid-cols-4">
        <Field label="Acción contiene"><Input value={f.action} onChange={(e) => { setSkip(0); setF({ ...f, action: e.target.value }); }} placeholder="incident., immob., auth.login" /></Field>
        <Field label="Entidad"><Input value={f.entityType} onChange={(e) => { setSkip(0); setF({ ...f, entityType: e.target.value }); }} placeholder="Incident, Unit…" /></Field>
        <Field label="Desde"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="Hasta"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
      </div></Card>
      {isLoading ? <Spinner /> : (
        <Card padded={false}>
          <Table head={['#', 'Fecha', 'Usuario', 'Acción', 'Entidad', 'Detalle', 'IP']} empty={!data?.rows.length}>
            {data?.rows.map((r) => <tr key={r.id}><td className="font-mono text-xs">{r.seq}</td><td className="whitespace-nowrap">{fmtDateTime(r.at)}</td><td>{r.actorEmail ?? <Badge>Sistema</Badge>}</td><td className="font-mono text-xs">{r.action}</td><td className="text-xs">{r.entityType}<p className="font-mono text-[10px] text-ink-400">{r.entityId}</p></td><td className="max-w-md truncate font-mono text-[11px] text-ink-500" title={JSON.stringify(r.after)}>{r.after ? JSON.stringify(r.after) : ''}</td><td className="text-xs">{r.ip}</td></tr>)}
          </Table>
          <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3 text-sm"><span>{data?.total ?? 0} registros</span><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - 50))}>Anterior</Button><Button size="sm" variant="secondary" disabled={!data || skip + 50 >= data.total} onClick={() => setSkip(skip + 50)}>Siguiente</Button></div></div>
        </Card>
      )}
    </>
  );
}
