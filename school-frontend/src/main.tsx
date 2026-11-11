import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { StudentProvider } from './features/student/StudentContext';
import { createQueryClient } from './shared/api/queryClient';
import { LanguageProvider } from './shared/i18n/language';
import { ErrorBoundary } from './shared/ui/ErrorBoundary';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Outermost: even a failure in the providers or the layout shows a message, not a blank page. */}
    <ErrorBoundary>
      <LanguageProvider>
      <QueryClientProvider client={createQueryClient()}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <StudentProvider>
            <App />
          </StudentProvider>
        </BrowserRouter>
      </QueryClientProvider>
      </LanguageProvider>
    </ErrorBoundary>
  </StrictMode>,
);
