import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AdmissionLayout } from './features/admission/AdmissionLayout';
import { ClassListPage } from './features/classes/ClassListPage';
import { CreateClassPage } from './features/classes/CreateClassPage';
import { ApplicationPage } from './features/holds/ApplicationPage';
import { MyApplicationsPage } from './features/holds/MyApplicationsPage';
import { HomePage } from './features/home/HomePage';
import { useT } from './shared/i18n/language';
import { ROUTES } from './shared/routes';
import { ErrorBoundary } from './shared/ui/ErrorBoundary';
import { Empty } from './shared/ui/States';

/** Links to an application that were shared before the admission page moved under /admission. */
function OldApplicationLink() {
  const { holdId = '' } = useParams();
  return <Navigate to={ROUTES.application(holdId)} replace />;
}

export function App() {
  const { pathname } = useLocation();
  // Keyed by section: moving to another page clears a render failure on the previous one.
  // The admission tabs share one key (the layout must not remount between them, or its
  // message and student box would reset); each tab has its own boundary inside the layout.
  const section = pathname.startsWith(ROUTES.admission) ? ROUTES.admission : pathname;
  return (
    <ErrorBoundary key={section}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admission" element={<AdmissionLayout />}>
          <Route index element={<ClassListPage />} />
          <Route path="applications" element={<MyApplicationsPage />} />
          <Route path="applications/:holdId" element={<ApplicationPage />} />
          <Route path="admin" element={<CreateClassPage />} />
        </Route>
        <Route path="/applications" element={<Navigate to={ROUTES.myApplications} replace />} />
        <Route path="/applications/:holdId" element={<OldApplicationLink />} />
        <Route path="/admin" element={<Navigate to={ROUTES.admin} replace />} />
        <Route
          path="*"
          element={
            <main className="container page-missing">
              <PageMissing />
            </main>
          }
        />
      </Routes>
    </ErrorBoundary>
  );
}

function PageMissing() {
  const t = useT();
  return (
    <Empty title={t.common.pageMissing}>
      <p>
        <Link to={ROUTES.home}>{t.common.goHome}</Link>
      </p>
    </Empty>
  );
}
