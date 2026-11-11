import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { StudentProvider } from '../features/student/StudentContext';
import { createQueryClient } from '../shared/api/queryClient';
import { LanguageProvider } from '../shared/i18n/language';

interface Options {
  /** The URL the browser is on. */
  route?: string;
  /** A student ID already remembered by the browser from an earlier visit. */
  rememberedStudentId?: string;
}

/**
 * Renders the whole application the way main.tsx does (same providers, same query
 * settings), at a given URL. Tests then use it as a user would.
 */
export function renderApp({ route = '/', rememberedStudentId }: Options = {}) {
  if (rememberedStudentId) {
    window.localStorage.setItem('school-admission.studentId', rememberedStudentId);
  }

  return render(
    <LanguageProvider>
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <StudentProvider>
          <App />
        </StudentProvider>
      </MemoryRouter>
    </QueryClientProvider>
    </LanguageProvider>,
  );
}
