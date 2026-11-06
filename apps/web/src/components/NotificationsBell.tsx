import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useAction, useApi, api } from '../lib/hooks';
import { ago } from '../lib/format';

interface N { id: string; title: string; body?: string; link?: string; severity: string; readAt: string | null; createdAt: string }
export function NotificationsBell({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const { data } = useApi<{ unread: number; rows: N[] }>(['notifications'], open ? '/notifications' : null);
  const read = useAction((id: string) => api.post(`/notifications/${id}/read`), { invalidate: [['notifications']] });
  const readAll = useAction(() => api.post('/notifications/read-all'), { invalidate: [['notifications']] });
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative rounded-xl p-2.5 text-ink-600 hover:bg-ink-100" aria-label="Notificaciones">
        <Bell className="h-5 w-5" />
        {count > 0 && <span className="absolute right-1.5 top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{count > 99 ? '99+' : count}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(92vw,380px)] rounded-2xl border border-ink-200 bg-surface shadow-pop">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <p className="font-semibold">Notificaciones</p>
            <button className="text-xs font-semibold text-brand-700" onClick={() => readAll.mutate(undefined)}>Marcar todas como leídas</button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {!data?.rows.length && <p className="p-6 text-center text-sm text-ink-500">Sin notificaciones</p>}
            {data?.rows.map((n) => (
              <button key={n.id} onClick={() => { read.mutate(n.id); setOpen(false); if (n.link) nav(n.link); }} className={clsx('block w-full border-b border-ink-100 px-4 py-3 text-left hover:bg-ink-50', !n.readAt && 'bg-brand-50/50')}>
                <p className="flex items-center gap-2 text-sm font-semibold text-ink-800">{!n.readAt && <span className={clsx('h-2 w-2 rounded-full', n.severity === 'CRITICA' ? 'bg-red-500' : 'bg-brand-500')} />}{n.title}</p>
                {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{n.body}</p>}
                <p className="mt-1 text-[11px] text-ink-400">{ago(n.createdAt)}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
