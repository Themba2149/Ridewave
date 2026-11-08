import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { io } from 'socket.io-client';
import { useCurrentUser } from '../features/auth/useAuth';

/** Read by polling queries: when the live channel is connected they can poll much less often. */
export const realtimeState = { connected: false };

export type RealtimeEvent = 'ride:updated' | 'notification:new' | 'payment:updated';
/** Which cached data is stale after an event. Events carry no ride data: the app re-fetches through the authorised REST API. */
export function invalidationsFor(event: RealtimeEvent): string[][] {
  switch (event) {
    case 'ride:updated': return [['ride'], ['rides'], ['driver-rides'], ['driver-requests'], ['driver-earnings'], ['admin']];
    case 'payment:updated': return [['ride'], ['receipt'], ['payment'], ['driver-rides']];
    case 'notification:new': return [['notifications']];
  }
}

const Ctx = createContext(false);
export const useRealtimeConnected = () => useContext(Ctx);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const [connected, setConnected] = useState(false);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) || undefined;
    const socket = io(base, { withCredentials: true, reconnectionDelayMax: 10_000 });
    const set = (v: boolean) => { realtimeState.connected = v; setConnected(v); };
    socket.on('connect', () => set(true));
    socket.on('disconnect', () => set(false));
    socket.on('connect_error', () => set(false));
    for (const event of ['ride:updated', 'notification:new', 'payment:updated'] as RealtimeEvent[]) {
      socket.on(event, () => { for (const key of invalidationsFor(event)) qc.invalidateQueries({ queryKey: key }); });
    }
    return () => { socket.close(); set(false); };
  }, [userId, qc]);

  return <Ctx.Provider value={connected}>{children}</Ctx.Provider>;
}
