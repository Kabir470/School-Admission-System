import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/apiClient';
import { classesKey } from '../classes/api';
import { withDeviceExpiry, type Hold, type HoldDto, type HoldStatus } from './hold';

const holdsKey = ['holds'] as const;
export const holdKey = (holdId: string) => [...holdsKey, 'one', holdId] as const;
export const myHoldsKey = (studentId: string | null) => [...holdsKey, 'mine', studentId] as const;

/** One application. Polled while it is HELD so a change made elsewhere shows up here too. */
export function useHold(holdId: string) {
  return useQuery({
    queryKey: holdKey(holdId),
    // GET /holds/{id} needs no student header: the hold id itself is the key to it.
    queryFn: async () => withDeviceExpiry(await api.get<HoldDto>(`/holds/${encodeURIComponent(holdId)}`)),
    refetchInterval: (query) => (query.state.data?.status === 'HELD' ? 5000 : false),
  });
}

/**
 * All of the student's applications, from the server. This is what brings a student's
 * applications back after a page refresh or a browser restart: the student ID is
 * remembered locally, the applications themselves always come from the backend.
 */
export function useMyHolds(studentId: string | null) {
  return useQuery({
    queryKey: myHoldsKey(studentId),
    queryFn: async () => (await api.get<HoldDto[]>('/me/holds', studentId)).map((dto) => withDeviceExpiry(dto)),
    enabled: studentId !== null,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
}

/** Apply: put a seat on hold. */
export function useApply(classId: string, studentId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      withDeviceExpiry(await api.post<HoldDto>(`/classes/${encodeURIComponent(classId)}/holds`, { studentId })),
    onSuccess: (hold) => {
      queryClient.setQueryData(holdKey(hold.holdId), hold);
    },
    // Success or failure, the seat counts and the student's list may have changed.
    // Refreshed in the background, deliberately not awaited: awaiting would keep the button
    // on "Applying…" (and delay opening the application) until both lists had reloaded.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: classesKey });
      void queryClient.invalidateQueries({ queryKey: myHoldsKey(studentId) });
    },
  });
}

/** Pay the admission fee: confirm the hold. Payment is assumed to succeed. */
export function useConfirmHold(holdId: string, studentId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ holdId: string; status: HoldStatus }>(`/holds/${encodeURIComponent(holdId)}/confirm`, { studentId }),
    onSuccess: (confirmed) => {
      queryClient.setQueryData<Hold>(holdKey(holdId), (old) => (old ? { ...old, status: confirmed.status } : old));
    },
    // Also after a failure: "expired" or "cancelled" means our copy of the hold is stale.
    onSettled: () => refreshEverything(queryClient),
  });
}

/** Cancel the application and release the seat. */
export function useCancelHold(holdId: string, studentId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/holds/${encodeURIComponent(holdId)}`, studentId),
    onSuccess: () => {
      queryClient.setQueryData<Hold>(holdKey(holdId), (old) => (old ? { ...old, status: 'CANCELLED' } : old));
    },
    onSettled: () => refreshEverything(queryClient),
  });
}

/** Starts the refetches and returns at once, so a button never waits on them. */
function refreshEverything(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: holdsKey });
  void queryClient.invalidateQueries({ queryKey: classesKey });
}
