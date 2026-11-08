import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api-client';

export const qs = (params: Record<string, string | number | undefined>) => {
  const p = Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return p.length ? `?${p.join('&')}` : '';
};

/** Admin reads share the ['admin', ...] key so any admin change refreshes every admin screen. */
export const useAdminQuery = <T,>(key: unknown[], path: string) =>
  useQuery({ queryKey: ['admin', ...key], queryFn: () => apiFetch<T>(path), placeholderData: keepPreviousData });

export function useAdminMutation<V, R = unknown>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }) });
}

export const patch = <R,>(path: string, body: unknown) => apiFetch<R>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const post = <R,>(path: string, body: unknown) => apiFetch<R>(path, { method: 'POST', body: JSON.stringify(body) });
