import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';
import { Loader2, X, Inbox } from 'lucide-react';
import { label as L, tone as T, type Tone } from '../lib/labels';

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning';
export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; loading?: boolean; icon?: ReactNode }>(
  ({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...p }, ref) => (
    <button ref={ref} disabled={disabled || loading} {...p}
      className={clsx('inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50',
        { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2.5 text-[15px]', lg: 'px-5 py-3.5 text-base' }[size],
        { primary: 'bg-brand-700 text-white shadow-sm hover:bg-brand-800', secondary: 'border border-ink-200 bg-white text-ink-800 hover:bg-ink-50', ghost: 'text-ink-600 hover:bg-ink-100',
          danger: 'bg-red-600 text-white hover:bg-red-700', warning: 'bg-amber-500 text-white hover:bg-amber-600' }[variant], className)}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}{children}
    </button>
  ));

const toneCls: Record<Tone, string> = {
  green: 'bg-brand-50 text-brand-800 ring-brand-200', amber: 'bg-amber-50 text-amber-800 ring-amber-200', red: 'bg-red-50 text-red-700 ring-red-200',
  gray: 'bg-ink-100 text-ink-600 ring-ink-200', blue: 'bg-sky-50 text-sky-800 ring-sky-200',
};
export function Badge({ children, tone = 'gray', className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={clsx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', toneCls[tone], className)}>{children}</span>;
}
/** Insignia de estado con etiqueta y color derivados del valor */
export const StatusBadge = ({ value }: { value?: string | null }) => <Badge tone={T(value)}>{L(value)}</Badge>;

export function Dot({ tone }: { tone: Tone }) {
  return <span className={clsx('inline-block h-2.5 w-2.5 rounded-full', { green: 'bg-brand-500', amber: 'bg-amber-500', red: 'bg-red-500', gray: 'bg-ink-300', blue: 'bg-sky-500' }[tone])} />;
}

export function Card({ title, subtitle, action, children, className, padded = true }: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={clsx('card', className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-ink-100 px-5 py-4">
          <div><h3 className="text-[15px] font-semibold">{title}</h3>{subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}</div>
          {action}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-2xl font-bold tracking-tight">{title}</h1>{subtitle && <p className="mt-1 text-ink-500">{subtitle}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, tone = 'gray', icon, hint, onClick }: { label: string; value: ReactNode; tone?: Tone; icon?: ReactNode; hint?: ReactNode; onClick?: () => void }) {
  const ring = { green: 'text-brand-700 bg-brand-50', amber: 'text-amber-700 bg-amber-50', red: 'text-red-600 bg-red-50', gray: 'text-ink-600 bg-ink-100', blue: 'text-sky-700 bg-sky-50' }[tone];
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className={clsx('card flex w-full items-start gap-3 p-4 text-left transition', onClick && 'hover:-translate-y-0.5 hover:shadow-pop')}>
      {icon && <span className={clsx('grid h-10 w-10 shrink-0 place-items-center rounded-xl', ring)}>{icon}</span>}
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-ink-500">{label}</span>
        <span className="mt-0.5 block text-2xl font-bold tabular-nums text-ink-900">{value}</span>
        {hint && <span className="mt-0.5 block text-xs text-ink-500">{hint}</span>}
      </span>
    </button>
  );
}

export function Progress({ value, tone = 'green' }: { value: number; tone?: Tone }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink-100">
      <div className={clsx('h-full rounded-full transition-all', { green: 'bg-brand-600', amber: 'bg-amber-500', red: 'bg-red-500', gray: 'bg-ink-400', blue: 'bg-sky-500' }[tone])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return <div className="flex items-center justify-center gap-2 py-10 text-ink-500"><Loader2 className="h-5 w-5 animate-spin" />{label}</div>;
}
export function Empty({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-ink-100 text-ink-400">{icon ?? <Inbox className="h-6 w-6" />}</span>
      <p className="font-semibold text-ink-700">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-ink-500">{children}</div>}
    </div>
  );
}
export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{(error as Error).message}</div>;
}
export function Notice({ tone = 'amber', children, icon }: { tone?: Tone; children: ReactNode; icon?: ReactNode }) {
  return <div className={clsx('flex gap-2.5 rounded-xl px-4 py-3 text-sm ring-1 ring-inset', toneCls[tone])}>{icon}<div>{children}</div></div>;
}

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="label">{label}</span>{children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>((p, ref) => <input ref={ref} {...p} className={clsx('input', p.className)} />);
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>((p, ref) => <textarea ref={ref} rows={3} {...p} className={clsx('input', p.className)} />);
export function Select({ options, placeholder, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] | Record<string, string>; placeholder?: string }) {
  const opts = Array.isArray(options) ? options : Object.entries(options).map(([value, label]) => ({ value, label }));
  return (
    <select {...p} className={clsx('input appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 20%27 fill=%27%2366707A%27%3E%3Cpath d=%27M5.3 7.3a1 1 0 011.4 0L10 10.6l3.3-3.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 010-1.4z%27/%3E%3C/svg%3E")] bg-[length:1.25rem] bg-[right_.6rem_center] bg-no-repeat pr-9', p.className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
export function Check({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <label className={clsx('flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition', checked ? 'border-brand-300 bg-brand-50' : 'border-ink-200 bg-white hover:bg-ink-50')}>
      <input type="checkbox" className="mt-0.5 h-5 w-5 rounded accent-brand-700" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span><span className="block text-sm font-medium text-ink-800">{label}</span>{hint && <span className="block text-xs text-ink-500">{hint}</span>}</span>
    </label>
  );
}

/** Selector segmentado de opciones grandes (ideal para semáforos de verificación) */
export function Segmented<T extends string>({ value, onChange, options }: { value: T | ''; onChange: (v: T) => void; options: { value: T; label: string; tone?: Tone; icon?: ReactNode }[] }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => {
        const active = value === o.value;
        const t = o.tone ?? 'green';
        return (
          <button type="button" key={o.value} onClick={() => onChange(o.value)}
            className={clsx('flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-sm font-semibold transition',
              active ? { green: 'border-brand-600 bg-brand-600 text-white', amber: 'border-amber-500 bg-amber-500 text-white', red: 'border-red-600 bg-red-600 text-white', gray: 'border-ink-600 bg-ink-600 text-white', blue: 'border-sky-600 bg-sky-600 text-white' }[t] : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50')}>
            {o.icon}{o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true">
      <div className={clsx('flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-pop sm:rounded-3xl', wide ? 'sm:max-w-4xl' : 'sm:max-w-lg')}>
        <header className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100" aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </header>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-ink-100 px-5 py-4">{footer}</footer>}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-ink-100 p-1">
      {tabs.map((t) => (
        <button key={t.value} onClick={() => onChange(t.value)} className={clsx('flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition', value === t.value ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800')}>
          {t.label}{t.count !== undefined && t.count > 0 && <span className="rounded-full bg-ink-200 px-1.5 text-xs text-ink-700">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="table-clean"><thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table>
      {empty && <Empty title="Sin registros" />}
    </div>
  );
}
