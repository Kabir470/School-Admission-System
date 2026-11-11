import type { ClassSeats } from './api';

export interface ClassTitle {
  /** "Class 6" */
  title: string;
  /** "Morning Shift", or '' when the name has no shift part. */
  shift: string;
  /** Short badge text: "6" for "Class 6", else the first character. */
  badge: string;
}

/**
 * A class is one name such as "Class 6 - Morning Shift". For display it is split at the
 * first dash into the class and the shift. Names without a dash are shown whole.
 */
export function splitClassName(name: string): ClassTitle {
  const match = /^(.+?)\s+[-–—]\s+(.+)$/.exec(name.trim());
  const title = match ? match[1]! : name.trim();
  const shift = match ? match[2]! : '';
  const number = /(\d+)/.exec(title);
  return { title, shift, badge: number ? number[1]! : title.charAt(0).toUpperCase() };
}

export type Tone = 'green' | 'blue' | 'sun';

/** A stable colour for a class badge, so the same class looks the same everywhere. */
export function toneFor(badge: string): Tone {
  const tones: Tone[] = ['green', 'blue', 'sun'];
  let sum = 0;
  for (const ch of badge) {
    sum += ch.charCodeAt(0);
  }
  return tones[sum % tones.length]!;
}

export type Availability = 'open' | 'few' | 'full';

export function availability(cls: ClassSeats): Availability {
  if (cls.availableSeats <= 0) {
    return 'full';
  }
  return cls.availableSeats / Math.max(cls.totalSeats, 1) <= 0.1 ? 'few' : 'open';
}

/** Width of a bar segment as a share of all seats, e.g. "42.5%". */
export function share(part: number, total: number): string {
  return `${Math.min(100, (part / Math.max(total, 1)) * 100)}%`;
}
