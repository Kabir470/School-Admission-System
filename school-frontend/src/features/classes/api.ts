import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/apiClient';

/** One class + shift, with live seat counts. Mirrors GET /classes. */
export interface ClassSeats {
  id: string;
  name: string;
  totalSeats: number;
  heldSeats: number;
  confirmedSeats: number;
  availableSeats: number;
}

export interface CreatedClass {
  id: string;
  name: string;
  totalSeats: number;
}

export const classesKey = ['classes'] as const;

/** How often seat counts are refreshed while the class list is on screen. */
export const CLASS_LIST_REFRESH_MS = 3000;

export function useClasses() {
  return useQuery({
    queryKey: classesKey,
    queryFn: () => api.get<ClassSeats[]>('/classes'),
    refetchInterval: CLASS_LIST_REFRESH_MS,
  });
}

export function useCreateClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; totalSeats: number }) =>
      api.post<CreatedClass>('/classes', { body: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: classesKey });
    },
  });
}
