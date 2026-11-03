/** Cliente HTTP: errores tipados; NUNCA se asume éxito si la respuesta no lo confirma. */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}

async function request<T>(method: string, url: string, body?: unknown, isForm = false): Promise<T> {
  if (!navigator.onLine) throw new ApiError(0, 'OFFLINE', 'Sin conexión a internet. La operación NO se registró. Reintente al recuperar la conexión.');
  let res: Response;
  try {
    res = await fetch(`/api${url}`, {
      method, credentials: 'include',
      headers: { 'X-CIM-Client': 'web', ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? (isForm ? (body as FormData) : JSON.stringify(body)) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'No fue posible comunicarse con el servidor. La operación NO se registró.');
  }
  if (res.status === 401 && !url.startsWith('/auth/')) window.dispatchEvent(new Event('cim:unauthorized'));
  const ct = res.headers.get('content-type') ?? '';
  const data = ct.includes('json') ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    const e = data?.error;
    let msg = e?.message ?? `Error ${res.status}`;
    if (e?.code === 'VALIDATION' && e.details) msg += ': ' + Object.entries(e.details as Record<string, string[]>).map(([k, v]) => `${k} — ${v.join(', ')}`).join('; ');
    throw new ApiError(res.status, e?.code ?? 'ERROR', msg, e?.details);
  }
  return data as T;
}

export const api = {
  get: <T,>(u: string) => request<T>('GET', u),
  post: <T,>(u: string, b?: unknown) => request<T>('POST', u, b ?? {}),
  put: <T,>(u: string, b?: unknown) => request<T>('PUT', u, b ?? {}),
  patch: <T,>(u: string, b?: unknown) => request<T>('PATCH', u, b ?? {}),
  del: <T,>(u: string, b?: unknown) => request<T>('DELETE', u, b ?? {}),
  upload: <T,>(u: string, f: FormData) => request<T>('POST', u, f, true),
};

export function qs(o: Record<string, string | number | boolean | undefined | null>) {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, String(v)); });
  const s = p.toString();
  return s ? `?${s}` : '';
}
