/** "09:42" for 581 400 ms; minutes keep counting past 60 ("75:00"). Never negative. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** "10 minutes", "1 minute 30 seconds", "45 seconds". */
export function formatHoldDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (minutes === 0) {
    return plural(seconds, 'second');
  }
  return seconds === 0 ? plural(minutes, 'minute') : `${plural(minutes, 'minute')} ${plural(seconds, 'second')}`;
}

/** An ISO timestamp in the reader's own time zone, e.g. "11 Nov, 20:16:59". */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** "2015 2691 2345 67890": the 17-digit number in groups, easier to check by eye. */
export function formatStudentId(id: string): string {
  return id.replace(/^(\d{4})(\d{4})(\d{4})(\d{5})$/, '$1 $2 $3 $4');
}
