import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { loadStudentId, saveStudentId } from './studentId';

interface StudentContextValue {
  /** The current student's birth registration number, or null when none is set. */
  studentId: string | null;
  setStudentId: (studentId: string | null) => void;
}

const StudentContext = createContext<StudentContextValue | null>(null);

/**
 * There is no login. The student ID typed into the box at the top of the page is the
 * identity, and it is remembered in localStorage so that a refresh, or closing and
 * reopening the browser, brings the same student (and their applications) back.
 */
export function StudentProvider({ children }: { children: ReactNode }) {
  const [studentId, setState] = useState<string | null>(loadStudentId);

  const setStudentId = useCallback((next: string | null) => {
    saveStudentId(next);
    setState(next);
  }, []);

  const value = useMemo(() => ({ studentId, setStudentId }), [studentId, setStudentId]);
  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
}

export function useStudent(): StudentContextValue {
  const value = useContext(StudentContext);
  if (value === null) {
    throw new Error('useStudent must be used inside <StudentProvider>.');
  }
  return value;
}
