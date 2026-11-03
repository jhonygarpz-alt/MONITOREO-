import { useState } from 'react';
import { Plus, KeyRound } from 'lucide-react';
import { useApi, useAction, api } from '../lib/hooks';
import { Badge, Button, Card, Field, Input, Modal, Notice, PageHeader, Table } from '../components/ui';
import { FormModal } from '../components/forms';
import { fmtDateTime } from '../lib/format';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function UsersPage() {
  const [edit, setEdit] = useState<any>(null);
  const [temp, setTemp] = useState<{ email?: string; tempPassword: string } | null>(null);
  const users = useApi<any[]>(['users'], '/admin/users');
  const roles = useApi<any[]>(['roles'], '/admin/roles');
  const save = useAction((v: any) => (v.id ? api.put(`/admin/users/${v.id}`, v) : api.post<any>('/admin/users', v)), { invalidate: [['users']], success: 'Usuario guardado', onSuccess: (r: any) => r?.tempPassword && setTemp(r) });
  const reset = useAction((id: string) => api.post<any>(`/admin/users/${id}/reset-password`), { success: 'Contraseña restablecida', onSuccess: (r) => setTemp(r) });
  return (
    <>
      <PageHeader title="Usuarios" subtitle="Los usuarios no se eliminan: se desactivan para conservar la trazabilidad" actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({ email: '', fullName: '', employeeNo: '', phone: '', roles: ['MONITORISTA'] })}>Nuevo usuario</Button>} />
      <Card padded={false}><Table head={['Nombre', 'Correo', 'Roles', 'Estado', 'Último acceso', '']}>{users.data?.map((u) => <tr key={u.id}><td className="font-medium">{u.fullName}</td><td>{u.email}</td><td className="space-x-1">{u.roles.map((r: any) => <Badge key={r.role.key}>{r.role.name}</Badge>)}</td><td>{u.active ? <Badge tone="green">Activo</Badge> : <Badge tone="red">Inactivo</Badge>}</td><td>{fmtDateTime(u.lastLoginAt)}</td><td className="whitespace-nowrap"><Button size="sm" variant="ghost" onClick={() => setEdit({ id: u.id, email: u.email, fullName: u.fullName, employeeNo: u.employeeNo ?? '', phone: u.phone ?? '', roles: u.roles.map((r: any) => r.role.key), active: u.active })}>Editar</Button><Button size="sm" variant="ghost" icon={<KeyRound className="h-4 w-4" />} onClick={() => reset.mutate(u.id)}>Restablecer</Button></td></tr>)}</Table></Card>
      {edit && <FormModal key={edit.id ?? 'new'} open onClose={() => setEdit(null)} title={edit.id ? 'Editar usuario' : 'Nuevo usuario'} initial={edit} onSubmit={(v) => save.mutateAsync(edit.id ? { id: edit.id, fullName: v.fullName, employeeNo: v.employeeNo || null, phone: v.phone || null, roles: v.roles, active: v.active } : { ...v, employeeNo: v.employeeNo || null, phone: v.phone || null })}>
        {(v, set) => <>
          <Field label="Nombre completo"><Input value={v.fullName} onChange={(e) => set({ fullName: e.target.value })} /></Field>
          <Field label="Correo"><Input type="email" disabled={!!edit.id} value={v.email} onChange={(e) => set({ email: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="No. empleado"><Input value={v.employeeNo} onChange={(e) => set({ employeeNo: e.target.value })} /></Field><Field label="Teléfono"><Input value={v.phone} onChange={(e) => set({ phone: e.target.value })} /></Field></div>
          <p className="label">Roles</p>
          <div className="grid gap-2 sm:grid-cols-2">{roles.data?.map((r) => <label key={r.key} className="flex items-start gap-2 rounded-xl border border-ink-200 p-2.5 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-700" checked={v.roles.includes(r.key)} onChange={(e) => set({ roles: e.target.checked ? [...v.roles, r.key] : v.roles.filter((x: string) => x !== r.key) })} /><span><b>{r.name}</b><span className="block text-xs text-ink-500">{r.description}</span></span></label>)}</div>
          {edit.id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-700" checked={v.active} onChange={(e) => set({ active: e.target.checked })} />Usuario activo</label>}
        </>}
      </FormModal>}
      <Modal open={!!temp} onClose={() => setTemp(null)} title="Contraseña temporal">
        <Notice tone="amber">Se muestra una sola vez. Entréguela de forma segura; el usuario deberá cambiarla al iniciar sesión.</Notice>
        <p className="mt-4 rounded-xl bg-ink-100 p-4 text-center font-mono text-lg">{temp?.tempPassword}</p>
      </Modal>
    </>
  );
}
