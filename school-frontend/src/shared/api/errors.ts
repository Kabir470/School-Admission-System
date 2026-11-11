/**
 * Every failure the UI can meet becomes an ApiError with a `code`, and every code has a
 * message a parent can understand, in English and Bangla. Nothing is ever shown as a raw
 * status code, and nothing is left for the console only.
 */

/** Codes produced by the client itself, when there is no usable answer from the server. */
export const NETWORK_ERROR = 'NETWORK_ERROR';
export const SERVER_ERROR = 'SERVER_ERROR';

export class ApiError extends Error {
  constructor(
    /** Machine-readable code: one of the backend's codes, NETWORK_ERROR or SERVER_ERROR. */
    readonly code: string,
    /** HTTP status, or 0 when the request never got an answer. */
    readonly status: number,
    /** The backend's own sentence about what was wrong, when it sent one. */
    readonly detail?: string,
  ) {
    super(messageFor(code).en);
    this.name = 'ApiError';
  }
}

export interface ErrorText {
  en: string;
  bn: string;
}

const UNREACHABLE: ErrorText = {
  en: 'Server unreachable, please try again.',
  bn: 'সার্ভারের সাথে যোগাযোগ করা যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।',
};

export const GENERIC_ERROR: ErrorText = {
  en: 'Something went wrong. Please try again.',
  bn: 'কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।',
};

const MESSAGES: Record<string, ErrorText> = {
  SEATS_FULL: {
    en: 'No seats are left in this class.',
    bn: 'এই ক্লাসে আর কোনো আসন খালি নেই।',
  },
  ACTIVE_HOLD_EXISTS: {
    en: 'This student already has an application in this class.',
    bn: 'এই ক্লাসে এই শিক্ষার্থীর একটি আবেদন আগে থেকেই আছে।',
  },
  HOLD_EXPIRED: {
    en: 'This application has expired. You can apply again if seats are left.',
    bn: 'আবেদনের মেয়াদ শেষ হয়ে গেছে। আসন খালি থাকলে আবার আবেদন করতে পারেন।',
  },
  HOLD_CANCELLED: {
    en: 'This application was cancelled.',
    bn: 'এই আবেদনটি বাতিল করা হয়েছে।',
  },
  HOLD_ALREADY_CONFIRMED: {
    en: 'This admission is already confirmed, so it cannot be cancelled.',
    bn: 'ভর্তি ইতিমধ্যে নিশ্চিত হয়েছে, তাই বাতিল করা যাবে না।',
  },
  NOT_YOUR_HOLD: {
    en: 'This application belongs to another student.',
    bn: 'এই আবেদনটি অন্য শিক্ষার্থীর।',
  },
  INVALID_STUDENT_ID: {
    en: 'The birth registration number must be exactly 17 digits.',
    bn: 'জন্ম নিবন্ধন নম্বর ঠিক ১৭ অঙ্কের হতে হবে।',
  },
  VALIDATION_FAILED: {
    en: 'Please check what you entered.',
    bn: 'দেওয়া তথ্য সঠিক নয়। আবার দেখে নিন।',
  },
  CLASS_NOT_FOUND: {
    en: 'This class could not be found.',
    bn: 'ক্লাসটি খুঁজে পাওয়া যায়নি।',
  },
  HOLD_NOT_FOUND: {
    en: 'This application could not be found.',
    bn: 'আবেদনটি খুঁজে পাওয়া যায়নি।',
  },
  CLASS_NAME_TAKEN: {
    en: 'A class with this name already exists.',
    bn: 'এই নামে একটি ক্লাস আগে থেকেই আছে।',
  },
  [NETWORK_ERROR]: UNREACHABLE,
  [SERVER_ERROR]: UNREACHABLE,
  INTERNAL_ERROR: UNREACHABLE,
};

/** The message for a code. Unknown codes get a generic message, never an empty one. */
export function messageFor(code: string): ErrorText {
  return MESSAGES[code] ?? GENERIC_ERROR;
}

export interface DescribedError extends ErrorText {
  code: string;
  /** Extra detail from the server, shown only where it helps (form validation). */
  detail?: string;
}

/** Turns anything that was thrown into something that can be shown to the user. */
export function describeError(error: unknown): DescribedError {
  if (error instanceof ApiError) {
    const detail = error.code === 'VALIDATION_FAILED' ? error.detail : undefined;
    return { code: error.code, ...messageFor(error.code), detail };
  }

  return { code: 'UNKNOWN', ...GENERIC_ERROR };
}

/** True when the server could not be reached or failed, as opposed to refusing the request. */
export function isUnreachable(error: unknown): boolean {
  return error instanceof ApiError && messageFor(error.code) === UNREACHABLE;
}
