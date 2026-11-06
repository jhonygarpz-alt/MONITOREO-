import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import {
  Home, ScanLine, Truck, Activity, Bell, Siren, ShieldCheck, Video, Map, Moon, Users, Megaphone, FileText, RefreshCw, GraduationCap, BarChart3,
  Database, UserCog, Settings, ScrollText, Sun, Moon as MoonIcon, Menu, X, Search, LogOut, WifiOff, PhoneCall, Lock, LayoutDashboard, AlertOctagon,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../lib/hooks';
import { NotificationsBell } from './NotificationsBell';
import logo from '../logo.svg';
import { useTheme } from '../lib/theme';

interface Item { to: string; label: string; icon: ReactNode; perm: string[]; badge?: 'alerts' | 'critical' | 'incidents' | 'handover' | 'approvals' }
const NAV: { section: string; items: Item[] }[] = [
  { section: 'Operación', items: [
    { to: '/', label: 'Inicio', icon: <Home />, perm: ['dashboard.view'] },
    { to: '/tablero', label: 'Tablero operativo', icon: <LayoutDashboard />, perm: ['dashboard.view'] },
    { to: '/barridos', label: 'Barridos', icon: <ScanLine />, perm: ['sweeps.view'] },
    { to: '/flota', label: 'Flota', icon: <Truck />, perm: ['units.view'] },
    { to: '/seguimiento', label: 'Seguimiento operativo', icon: <Activity />, perm: ['ops.view'] },
  ] },
  { section: 'Seguridad', items: [
    { to: '/alertas', label: 'Alertas', icon: <Bell />, perm: ['alerts.view'], badge: 'alerts' },
    { to: '/incidencias', label: 'Incidencias', icon: <Siren />, perm: ['incidents.view'], badge: 'incidents' },
    { to: '/protocolos', label: 'Protocolos', icon: <ShieldCheck />, perm: ['incidents.view'] },
    { to: '/camaras', label: 'Cámaras', icon: <Video />, perm: ['cameras.view'] },
    { to: '/zonas-riesgo', label: 'Zonas de riesgo', icon: <Map />, perm: ['risk.view'] },
    { to: '/resguardos', label: 'Resguardos', icon: <Moon />, perm: ['route.view'] },
    { to: '/inmovilizacion', label: 'Inmovilización', icon: <Lock />, perm: ['immob.view'], badge: 'approvals' },
    { to: '/emergencias', label: 'Directorio de emergencias', icon: <PhoneCall />, perm: ['emergency.view'] },
  ] },
  { section: 'Comunicación', items: [
    { to: '/operadores', label: 'Operadores', icon: <Users />, perm: ['operators.view'] },
    { to: '/comunicados', label: 'Comunicados', icon: <Megaphone />, perm: ['communiques.view'] },
    { to: '/estatus', label: 'Estatus a clientes', icon: <FileText />, perm: ['status.view'] },
  ] },
  { section: 'Gestión', items: [
    { to: '/turnos', label: 'Entrega de turnos', icon: <RefreshCw />, perm: ['handover.view'], badge: 'handover' },
    { to: '/capacitacion', label: 'Capacitaciones', icon: <GraduationCap />, perm: ['training.view'] },
    { to: '/reportes', label: 'Reportes', icon: <BarChart3 />, perm: ['reports.view'] },
  ] },
  { section: 'Administración', items: [
    { to: '/catalogos', label: 'Catálogos', icon: <Database />, perm: ['admin.catalogs'] },
    { to: '/usuarios', label: 'Usuarios', icon: <UserCog />, perm: ['admin.users'] },
    { to: '/configuracion', label: 'Configuración', icon: <Settings />, perm: ['dashboard.view'] },
    { to: '/auditoria', label: 'Auditoría', icon: <ScrollText />, perm: ['admin.audit'] },
  ] },
];

export interface Badges { alerts: number; critical: number; incidents: number; handover: number; approvals: number; notifications: number }

export function Layout() {
  const { me, can, logout } = useAuth();
  const { dark, setPref } = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const nav = useNavigate();
  const loc = useLocation();
  const { data: badges } = useApi<Badges>(['badges'], '/dashboard/badges', { refetchInterval: 30000 });
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const sidebar = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <img src={logo} alt="" className="h-10 w-10" />
        <div className="leading-tight"><p className="text-[15px] font-bold text-white">Centro Inteligente</p><p className="text-[13px] font-medium text-[#A8DBBA]">de Monitoreo</p></div>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {NAV.map((s) => {
          const items = s.items.filter((i) => can(...i.perm));
          if (!items.length) return null;
          return (
            <div key={s.section}>
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#74C394]/80">{s.section}</p>
              {items.map((i) => {
                const n = i.badge && badges ? badges[i.badge] : 0;
                const critical = i.badge === 'alerts' && (badges?.critical ?? 0) > 0;
                return (
                  <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => clsx('group flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium transition [&_svg]:h-[18px] [&_svg]:w-[18px]', isActive ? 'bg-white/15 text-white' : 'text-[#D3EDDC]/90 hover:bg-white/10 hover:text-white')}>
                    {i.icon}<span className="flex-1">{i.label}</span>
                    {n > 0 && <span className={clsx('min-w-[22px] rounded-full px-1.5 text-center text-[11px] font-bold', critical ? 'bg-red-500 text-white' : 'bg-white/20 text-white')}>{n}</span>}
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="border-t border-white/10 p-4">
        <p className="truncate text-sm font-semibold text-white">{me?.fullName}</p>
        <p className="truncate text-xs text-[#A8DBBA]">{me?.roles.join(' · ')}</p>
        <button onClick={() => logout()} className="mt-3 flex items-center gap-2 text-sm font-medium text-[#D3EDDC] hover:text-white"><LogOut className="h-4 w-4" />Cerrar sesión</button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:pl-[272px]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[272px] bg-gradient-to-b from-[#0C5530] to-[#052615] lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] bg-gradient-to-b from-[#0C5530] to-[#052615]">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-5 text-white" aria-label="Cerrar menú"><X /></button>{sidebar}
          </aside>
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-ink-200/70 bg-surface/90 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <button className="rounded-lg p-2 text-ink-600 hover:bg-ink-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menú"><Menu /></button>
          <form className="relative max-w-md flex-1" onSubmit={(e) => { e.preventDefault(); if (q.trim()) nav(`/flota?q=${encodeURIComponent(q.trim())}`); }}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar unidad por número económico, placas u operador" className="w-full rounded-xl border border-ink-200 bg-ink-50 py-2.5 pl-9 pr-3 text-sm focus:border-brand-500 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-brand-100" />
          </form>
          <div className="ml-auto flex items-center gap-2">
            {can('incidents.manage') && (
              <button onClick={() => nav('/protocolos?emergencia=1')} className="flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700">
                <AlertOctagon className="h-4 w-4" /><span className="hidden sm:inline">Emergencia</span>
              </button>
            )}
            <button onClick={() => setPref(dark ? 'light' : 'dark')} className="rounded-xl p-2.5 text-ink-600 hover:bg-ink-100" aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} title={dark ? 'Tema claro' : 'Tema oscuro'}>
              {dark ? <Sun className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
            </button>
            <NotificationsBell count={badges?.notifications ?? 0} />
          </div>
        </div>
        {!online && <div className="flex items-center gap-2 bg-red-600 px-6 py-2 text-sm font-medium text-white"><WifiOff className="h-4 w-4" />Sin conexión a internet. Nada se guardará hasta recuperar la conexión; la información mostrada puede estar desactualizada.</div>}
      </header>
      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:py-8"><Outlet /></main>
    </div>
  );
}
