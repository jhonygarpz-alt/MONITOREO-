import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { api } from './api';
import { useToast } from '../components/toast';

export function useApi<T>(key: QueryKey, url: string | null, opts: { refetchInterval?: number } = {}) {
  return useQuery<T>({ queryKey: key, queryFn: () => api.get<T>(url!), enabled: !!url, refetchInterval: opts.refetchInterval });
}

/**
 * Mutación con confirmación honesta: solo muestra "guardado" cuando el servidor respondió OK.
 * Ante error, el mensaje indica claramente que la operación NO se registró.
 */
export function useAction<V = unknown, R = unknown>(fn: (v: V) => Promise<R>, opts: { success?: string | ((r: R) => string); invalidate?: QueryKey[]; onSuccess?: (r: R) => void } = {}) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation<R, Error, V>({
    mutationFn: fn,
    onSuccess: (r) => {
      (opts.invalidate ?? []).forEach((k) => qc.invalidateQueries({ queryKey: k }));
      qc.invalidateQueries({ queryKey: ['badges'] });
      if (opts.success) toast(typeof opts.success === 'function' ? opts.success(r) : opts.success, 'success');
      opts.onSuccess?.(r);
    },
    onError: (e) => toast(e.message, 'error'),
  });
}
export { api };
