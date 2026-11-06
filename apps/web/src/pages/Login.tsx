import { useState } from 'react';
import { ShieldCheck, Lock } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Button, ErrorBox, Field, Input } from '../components/ui';
import { api } from '../lib/api';
import logo from '../logo.svg';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#0F6B3A] via-[#0C5530] to-[#052615] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3"><img src={logo} className="h-11 w-11" alt="" /><span className="text-lg font-semibold">Centro Inteligente de Monitoreo</span></div>
        <div>
          <h1 className="text-4xl font-bold leading-tight text-white">Control Operativo y<br />Seguridad Patrimonial</h1>
          <p className="mt-4 max-w-md text-[#D3EDDC]">Supervise la flota, anticipe riesgos y coordine la respuesta con trazabilidad completa.</p>
          <div className="mt-10 grid max-w-md grid-cols-3 gap-3 text-sm">
            {['Barridos cada 2 h', 'Protocolos guiados', 'Auditoría inalterable'].map((t) => <div key={t} className="rounded-2xl bg-white/10 p-3 font-medium">{t}</div>)}
          </div>
        </div>
        <p className="text-xs text-[#A8DBBA]">Uso exclusivo de personal autorizado. Toda actividad queda registrada.</p>
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5" />
      </div>
      <div className="flex items-center justify-center bg-surface p-6">
        <form className="w-full max-w-sm" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(null); try { await login(email, password); } catch (x) { setErr(x); } finally { setBusy(false); } }}>
          <div className="mb-8 lg:hidden"><img src={logo} className="mb-3 h-12 w-12" alt="" /><p className="text-lg font-bold">Centro Inteligente de Monitoreo</p></div>
          <h2 className="text-2xl font-bold">Iniciar sesión</h2>
          <p className="mb-6 mt-1 text-ink-500">Ingrese con su cuenta institucional.</p>
          <div className="space-y-4">
            <Field label="Correo"><Input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Contraseña"><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            <ErrorBox error={err} />
            <Button type="submit" size="lg" className="w-full" loading={busy} icon={<Lock className="h-4 w-4" />}>Entrar</Button>
          </div>
          <p className="mt-6 flex items-center gap-2 text-xs text-ink-500"><ShieldCheck className="h-4 w-4 text-brand-600" />Sesión protegida; se bloquea tras 5 intentos fallidos.</p>
        </form>
      </div>
    </div>
  );
}

export function ChangePasswordPage() {
  const { refresh, logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [err, setErr] = useState<unknown>(null);
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form className="card w-full max-w-sm p-6" onSubmit={async (e) => { e.preventDefault(); try { await api.post('/auth/change-password', { current, next }); await refresh(); } catch (x) { setErr(x); } }}>
        <h2 className="text-xl font-bold">Cambie su contraseña</h2>
        <p className="mb-5 mt-1 text-sm text-ink-500">Mínimo 10 caracteres con mayúscula, minúscula y número.</p>
        <div className="space-y-4">
          <Field label="Contraseña actual"><Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
          <Field label="Nueva contraseña"><Input type="password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
          <ErrorBox error={err} />
          <Button type="submit" className="w-full">Guardar</Button>
          <Button type="button" variant="ghost" className="w-full" onClick={logout}>Salir</Button>
        </div>
      </form>
    </div>
  );
}
