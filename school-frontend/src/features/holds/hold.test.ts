import { makeHold } from '../../test/server';
import { effectiveStatus, remainingMs, withDeviceExpiry } from './hold';

describe('hold status and time left', () => {
  it('shows a HELD hold as EXPIRED once its time has run out, without asking the server', () => {
    const now = Date.now();
    const hold = withDeviceExpiry(makeHold({ expiresInSeconds: 10 }), now);

    expect(effectiveStatus(hold, now)).toBe('HELD');
    expect(effectiveStatus(hold, now + 9_999)).toBe('HELD');
    expect(effectiveStatus(hold, now + 10_000)).toBe('EXPIRED');
    expect(effectiveStatus(hold, now + 60_000)).toBe('EXPIRED');
  });

  it.each(['CONFIRMED', 'CANCELLED', 'EXPIRED'] as const)('never changes a %s hold, whatever the clock says', (status) => {
    const now = Date.now();
    const hold = withDeviceExpiry(makeHold({ status, expiresInSeconds: 10 }), now);

    expect(effectiveStatus(hold, now + 3_600_000)).toBe(status);
  });

  it.each([
    ['five minutes slow', 300],
    ['five minutes fast', -300],
  ])('counts down to the server expiry on a device whose clock is %s', (_, serverAheadSeconds) => {
    // WHY: the server decides when a hold expires. A phone with the wrong time must not
    // show five extra minutes (and then a surprise "expired"), or five too few.
    const now = Date.now();
    const hold = withDeviceExpiry(makeHold({ expiresInSeconds: 600, serverAheadSeconds }), now);

    expect(remainingMs(hold, now)).toBe(600_000);
    expect(effectiveStatus(hold, now + 599_999)).toBe('HELD');
    expect(effectiveStatus(hold, now + 600_000)).toBe('EXPIRED');
  });

  it('uses the exact time left sent by the server, not the rounded timestamps', () => {
    // expiresAt and serverTime are whole seconds (one rounded up, one down), so their
    // difference can overstate the time left by up to two seconds: "10:01" on a
    // ten-minute hold. remainingMs is exact.
    const now = Date.now();
    const dto = { ...makeHold({ expiresInSeconds: 600 }), remainingMs: 599_400 };

    expect(remainingMs(withDeviceExpiry(dto, now), now)).toBe(599_400);
  });

  it('falls back to the timestamps when the server sent no remainingMs', () => {
    const now = Date.now();
    const { remainingMs: _omitted, ...dto } = makeHold({ expiresInSeconds: 30, serverAheadSeconds: 300 });

    expect(remainingMs(withDeviceExpiry(dto, now), now)).toBe(30_000);
  });

  it('falls back to the device clock when the server sent neither', () => {
    const now = Date.now();
    const { remainingMs: _omitted, ...dto } = makeHold({ expiresInSeconds: 30 });
    const hold = withDeviceExpiry({ ...dto, serverTime: 'not a date' }, now);

    expect(effectiveStatus(hold, now)).toBe('HELD');
    expect(effectiveStatus(hold, now + 31_000)).toBe('EXPIRED');
  });
});
