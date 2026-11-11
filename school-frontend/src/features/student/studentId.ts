import { toBanglaDigits } from '../../shared/i18n/strings';

/** A student is identified by a birth registration number: exactly 17 digits (0-9). */
export const STUDENT_ID_LENGTH = 17;

const STORAGE_KEY = 'school-admission.studentId';

export function isValidStudentId(value: string): boolean {
  return /^[0-9]{17}$/.test(value);
}

/** Why a typed value is not acceptable, in words; null when it is fine. */
export function studentIdProblem(value: string): { en: string; bn: string } | null {
  const trimmed = value.trim();
  if (trimmed === '') {
    return {
      en: 'Enter the birth registration number.',
      bn: 'জন্ম নিবন্ধন নম্বর লিখুন।',
    };
  }
  if (!/^[0-9]+$/.test(trimmed)) {
    return {
      en: 'Use digits 0-9 only, with no spaces or letters.',
      bn: 'শুধু ইংরেজি অঙ্ক (0-9) ব্যবহার করুন; ফাঁকা জায়গা বা অক্ষর চলবে না।',
    };
  }
  if (trimmed.length !== STUDENT_ID_LENGTH) {
    return {
      en: `The number must be exactly ${STUDENT_ID_LENGTH} digits. You entered ${trimmed.length}.`,
      bn: `নম্বরটি ঠিক ১৭ অঙ্কের হতে হবে। আপনি ${toBanglaDigits(String(trimmed.length))}টি অঙ্ক লিখেছেন।`,
    };
  }
  return null;
}

// localStorage can throw (private browsing, blocked storage, quota). The student ID is a
// convenience to remember, so a storage failure must never break the page.

export function loadStudentId(): string | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored !== null && isValidStudentId(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function saveStudentId(studentId: string | null): void {
  try {
    if (studentId === null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, studentId);
    }
  } catch {
    // Still usable for this session; it just will not be remembered.
  }
}
