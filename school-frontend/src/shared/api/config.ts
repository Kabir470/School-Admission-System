const DEFAULT_API_URL = 'http://localhost:8080';

/**
 * Where the backend lives. Resolved on every call, in this order:
 *
 *  1. window.__APP_CONFIG__.apiUrl  — written into /config.js when the container starts,
 *     from the API_URL environment variable. Changing it needs a restart, not a rebuild.
 *  2. import.meta.env.VITE_API_URL  — build-time value, handy for `npm run dev`.
 *  3. http://localhost:8080
 */
export function getApiUrl(): string {
  const runtime = window.__APP_CONFIG__?.apiUrl?.trim();
  const buildTime = import.meta.env.VITE_API_URL?.trim();
  return (runtime || buildTime || DEFAULT_API_URL).replace(/\/+$/, '');
}
