import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ClassSeats } from '../features/classes/api';
import type { HoldDto, HoldStatus } from '../features/holds/hold';

/** Where the app looks for the backend when nothing is configured. */
export const API = 'http://localhost:8080';

/**
 * The fake backend. Tests go through the real apiClient and fetch; only the network is
 * faked. Two answers are always there, because nearly every screen asks for them:
 * the settings (a 10-minute hold) and an empty class list. Tests replace them with
 * server.use(); any other request a test did not set up fails that test.
 */
export const server = setupServer(
  http.get(`${API}/settings`, () => HttpResponse.json({ holdDurationSeconds: 600 })),
  http.get(`${API}/classes`, () => HttpResponse.json([])),
);

export const STUDENT = '20152691234567890';

/** An error body exactly as the backend sends it: RFC 7807 ProblemDetails plus "code". */
export function problem(status: number, code: string, detail = 'Detail from the server.') {
  return HttpResponse.json(
    { type: 'about:blank', title: 'Error', status, detail, code },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

export function makeClass(overrides: Partial<ClassSeats> = {}): ClassSeats {
  return {
    id: 'c-1',
    name: 'Class 6 - Morning Shift',
    totalSeats: 120,
    heldSeats: 15,
    confirmedSeats: 80,
    availableSeats: 25,
    ...overrides,
  };
}

interface HoldOptions {
  holdId?: string;
  classId?: string;
  className?: string;
  status?: HoldStatus;
  /** Seconds from now until the hold expires, on the server's clock. */
  expiresInSeconds?: number;
  /** How far the server's clock is ahead of this device's, in seconds. */
  serverAheadSeconds?: number;
}

/** A hold as the server would describe it at this moment. */
export function makeHold(options: HoldOptions = {}): HoldDto {
  const serverNow = Date.now() + (options.serverAheadSeconds ?? 0) * 1000;
  const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
  return {
    holdId: options.holdId ?? 'h-1',
    classId: options.classId ?? 'c-1',
    className: options.className ?? 'Class 6 - Morning Shift',
    status: options.status ?? 'HELD',
    expiresAt: iso(serverNow + (options.expiresInSeconds ?? 600) * 1000),
    createdAt: iso(serverNow - 5_000),
    serverTime: iso(serverNow),
    remainingMs: Math.max(0, Math.round((options.expiresInSeconds ?? 600) * 1000)),
  };
}

export { http, HttpResponse };
