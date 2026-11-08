import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiFetch } from '../../lib/api-client';

export type Role = 'PASSENGER' | 'DRIVER' | 'ADMIN';
export type AuthUser = { id: string; email: string; fullName: string; phone: string | null; role: Role; status: string };

export const homePathFor = (role: Role) => (role === 'ADMIN' ? '/admin' : role === 'DRIVER' ? '/driver' : '/passenger');

/** The signed-in user, or null when signed out. The session itself lives in an HTTP-only cookie the browser JS cannot read. */
export function useCurrentUser() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async (): Promise<AuthUser | null> => {
      try {
        return (await apiFetch<{ user: AuthUser }>('/auth/me')).user;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { email: string; password: string }) => apiFetch<{ user: AuthUser }>('/auth/login', { method: 'POST', body: JSON.stringify(v) }),
    onSuccess: (d) => { qc.clear(); qc.setQueryData(['me'], d.user); },
  });
}

export type RegisterPayload = { role: 'PASSENGER' | 'DRIVER'; fullName: string; email: string; phone?: string; password: string };

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: RegisterPayload) => apiFetch<{ user: AuthUser }>('/auth/register', { method: 'POST', body: JSON.stringify(v) }),
    onSuccess: (d) => { qc.clear(); qc.setQueryData(['me'], d.user); },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch('/auth/logout', { method: 'POST' }),
    onSettled: () => { qc.clear(); qc.setQueryData(['me'], null); },
  });
}
