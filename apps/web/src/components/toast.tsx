import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import clsx from 'clsx';

type Kind = 'success' | 'error' | 'warning';
const Ctx = createContext<(msg: string, kind?: Kind) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; kind: Kind }[]>([]);
  const push = useCallback((msg: string, kind: Kind = 'success') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, msg, kind }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), kind === 'error' ? 9000 : 4500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,420px)] flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} role="status" className={clsx('pointer-events-auto flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium shadow-pop ring-1', t.kind === 'success' ? 'bg-white text-ink-800 ring-brand-200' : t.kind === 'warning' ? 'bg-amber-50 text-amber-900 ring-amber-200' : 'bg-red-50 text-red-800 ring-red-200')}>
            {t.kind === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-600" /> : t.kind === 'warning' ? <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" /> : <XCircle className="h-5 w-5 shrink-0 text-red-600" />}
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
