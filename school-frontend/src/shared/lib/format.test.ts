import { formatDuration, formatHoldDuration, formatStudentId } from './format';

describe('formatting', () => {
  it.each([
    [600_000, '10:00'],
    [581_400, '09:42'],
    [1_001, '00:02'], // a started second still counts, so 0 is shown only when time is up
    [0, '00:00'],
    [-5_000, '00:00'],
    [4_500_000, '75:00'],
  ])('shows %i ms left as %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });

  it.each([
    [600, '10 minutes'],
    [60, '1 minute'],
    [90, '1 minute 30 seconds'],
    [45, '45 seconds'],
    [1, '1 second'],
  ])('describes a %i-second hold as "%s"', (seconds, text) => {
    expect(formatHoldDuration(seconds)).toBe(text);
  });

  it('groups a birth registration number for reading, and leaves anything else alone', () => {
    expect(formatStudentId('20152691234567890')).toBe('2015 2691 2345 67890');
    expect(formatStudentId('123')).toBe('123');
  });
});
