import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Show a failure at once rather than after silent retries. The screens poll, so
        // the next attempt is only seconds away, and the last good data stays visible.
        retry: false,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });
}
