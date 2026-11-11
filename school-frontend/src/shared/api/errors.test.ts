import { ApiError, describeError, GENERIC_ERROR, isUnreachable, messageFor } from './errors';

// WHY: every error must reach the user in words they understand. If a backend code has
// no message of its own, the parent sees a vague "something went wrong" and cannot tell
// "the class is full" from "your time ran out".

const BACKEND_CODES = [
  'SEATS_FULL',
  'ACTIVE_HOLD_EXISTS',
  'HOLD_EXPIRED',
  'HOLD_CANCELLED',
  'HOLD_ALREADY_CONFIRMED',
  'NOT_YOUR_HOLD',
  'INVALID_STUDENT_ID',
  'VALIDATION_FAILED',
  'CLASS_NOT_FOUND',
  'HOLD_NOT_FOUND',
  'CLASS_NAME_TAKEN',
];

describe('error messages', () => {
  it.each(BACKEND_CODES)('%s has its own message in English and Bangla', (code) => {
    const message = messageFor(code);

    expect(message.en.trim()).not.toBe('');
    expect(message.bn.trim()).not.toBe('');
    expect(message).not.toEqual(GENERIC_ERROR);
    // The message is words, not the code itself.
    expect(message.en).not.toContain(code);
  });

  it('gives each backend code a different message', () => {
    const english = BACKEND_CODES.map((code) => messageFor(code).en);

    expect(new Set(english).size).toBe(BACKEND_CODES.length);
  });

  it.each(['NETWORK_ERROR', 'SERVER_ERROR', 'INTERNAL_ERROR'])('%s tells the user the server cannot be reached', (code) => {
    expect(messageFor(code).en).toBe('Server unreachable, please try again.');
    expect(isUnreachable(new ApiError(code, 0))).toBe(true);
  });

  it('falls back to a generic, non-empty message for a code it does not know', () => {
    expect(messageFor('SOMETHING_NEW')).toEqual(GENERIC_ERROR);
    expect(GENERIC_ERROR.en.trim()).not.toBe('');
  });

  it('describes anything that was thrown, even if it is not an ApiError', () => {
    expect(describeError(new TypeError('x is undefined')).en).toBe(GENERIC_ERROR.en);
    expect(describeError(undefined).en).toBe(GENERIC_ERROR.en);
    expect(describeError('boom').en).toBe(GENERIC_ERROR.en);
  });

  it('passes the server detail on for validation errors only', () => {
    const invalid = describeError(new ApiError('VALIDATION_FAILED', 400, 'name must be at most 100 characters.'));
    const full = describeError(new ApiError('SEATS_FULL', 409, 'No seats are available in this class.'));

    expect(invalid.detail).toBe('name must be at most 100 characters.');
    expect(full.detail).toBeUndefined();
  });

  it('is not "unreachable" when the server answered with a refusal', () => {
    expect(isUnreachable(new ApiError('SEATS_FULL', 409))).toBe(false);
  });
});
