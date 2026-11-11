import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/apiClient';
import { useT } from '../../shared/i18n/language';

interface Settings {
  holdDurationSeconds: number;
}

/**
 * How long a seat is held, as the backend is configured (HOLD_DURATION_SECONDS), in the
 * chosen language. Until it is known (or if it cannot be loaded) the text says
 * "a limited time", never a number that might be wrong.
 */
export function useHoldDurationText(): string {
  const t = useT();
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/settings'),
    staleTime: Infinity,
  });
  const seconds = settings.data?.holdDurationSeconds;
  return typeof seconds === 'number' && seconds > 0 ? t.holdDuration(seconds) : t.limitedTime;
}
