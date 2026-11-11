import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './server';

// Any request a test did not expect fails that test, so no test passes by accident
// against a call it never meant to make.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.useRealTimers();
  window.localStorage.clear();
  document.documentElement.lang = 'en';
  delete window.__APP_CONFIG__;
});

afterAll(() => server.close());
