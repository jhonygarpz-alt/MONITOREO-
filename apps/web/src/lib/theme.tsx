import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';
const KEY = 'cim-theme';
const Ctx = createContext<{ pref: ThemePref; dark: boolean; setPref: (p: ThemePref) => void }>({ pref: 'system', dark: false, setPref: () => {} });
export const useTheme = () => useContext(Ctx);

function read(): ThemePref {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'; } catch { return 'system'; }
}

/** Tema claro / oscuro / según el sistema. La preferencia se guarda en este navegador. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(read);
  const [sysDark, setSysDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const h = (e: MediaQueryListEvent) => setSysDark(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  const dark = pref === 'dark' || (pref === 'system' && sysDark);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0E1215' : '#0F6B3A');
  }, [dark]);
  const setPref = (p: ThemePref) => { setPrefState(p); try { localStorage.setItem(KEY, p); } catch { /* sin almacenamiento */ } };
  return <Ctx.Provider value={{ pref, dark, setPref }}>{children}</Ctx.Provider>;
}
