export type HoldStatus = 'HELD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';

/** An application as the API returns it (GET /holds/{id}, GET /me/holds, POST …/holds). */
export interface HoldDto {
  holdId: string;
  classId: string;
  className: string;
  status: HoldStatus;
  /** ISO-8601 UTC, whole seconds. Rounded up by the server: once it has passed, the hold is expired. */
  expiresAt: string;
  createdAt: string;
  /** The server's clock when it answered (whole seconds). */
  serverTime: string;
  /** Exact milliseconds left until expiry on the server's clock when it answered; 0 once passed. */
  remainingMs?: number;
}

/** A hold plus the moment it expires, translated onto this device's clock. */
export interface Hold extends HoldDto {
  /**
   * When the hold expires, as a time on THIS device's clock (ms since epoch).
   *
   * The server decides when a hold expires, and a phone or PC clock can be minutes off.
   * So the countdown never compares the device clock with the server's `expiresAt`.
   * Instead: the server says "N ms are left", and the device adds N to its own clock at
   * the moment the answer arrived. Only the device's sense of *elapsed* time is used
   * after that, which is reliable even when its wall-clock time is wrong.
   */
  expiresAtDeviceMs: number;
}

export function withDeviceExpiry(dto: HoldDto, receivedAtMs: number = Date.now()): Hold {
  return { ...dto, expiresAtDeviceMs: receivedAtMs + timeLeftWhenAnswered(dto, receivedAtMs) };
}

function timeLeftWhenAnswered(dto: HoldDto, receivedAtMs: number): number {
  if (typeof dto.remainingMs === 'number' && Number.isFinite(dto.remainingMs)) {
    return dto.remainingMs;
  }

  // Older or third-party server without remainingMs: fall back to the two timestamps,
  // and, failing that, to trusting the device clock.
  const expiresAt = Date.parse(dto.expiresAt);
  const serverNow = Date.parse(dto.serverTime);
  return Number.isNaN(serverNow) ? expiresAt - receivedAtMs : expiresAt - serverNow;
}

/** Milliseconds until the hold expires. Negative once it has passed. */
export function remainingMs(hold: Hold, deviceNowMs: number): number {
  return hold.expiresAtDeviceMs - deviceNowMs;
}

/**
 * The status to show. The server only reports EXPIRED when asked, so between two fetches
 * the client works it out itself: a HELD hold whose time has run out is EXPIRED.
 * Every screen uses this one function, so they cannot disagree.
 */
export function effectiveStatus(hold: Hold, deviceNowMs: number): HoldStatus {
  return hold.status === 'HELD' && remainingMs(hold, deviceNowMs) <= 0 ? 'EXPIRED' : hold.status;
}

/** HELD or CONFIRMED: the student occupies a seat in the class. */
export function occupiesSeat(status: HoldStatus): boolean {
  return status === 'HELD' || status === 'CONFIRMED';
}
