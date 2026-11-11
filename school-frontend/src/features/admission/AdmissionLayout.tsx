import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { SCHOOL } from '../../shared/brand';
import { LanguageSwitch, useT } from '../../shared/i18n/language';
import { ROUTES } from '../../shared/routes';
import { ErrorBoundary } from '../../shared/ui/ErrorBoundary';
import { Icon, Logo } from '../../shared/ui/Icon';
import { useMyHolds } from '../holds/api';
import { useStudent } from '../student/StudentContext';
import { StudentIdBox } from '../student/StudentIdBox';
import { NoticeBanner, NoticeProvider, useNotice } from './notice';

/**
 * The admission page: who the student is (top band), three tabs (classes, my
 * applications, school admin), one message area, and the selected tab below.
 */
export function AdmissionLayout() {
  const t = useT();
  const { pathname } = useLocation();
  return (
    <NoticeProvider>
      <div className="admission">
        <header className="site-header">
          <div className="container site-header__inner">
            <Link to={ROUTES.home} className="brand">
              <Logo />
              <span className="brand__lines">
                <span className="brand__name">{SCHOOL.name}</span>
                <span className="brand__sub">
                  <span lang="bn">{SCHOOL.nameBn}</span> · {t.common.admissionYear(SCHOOL.admissionYear)}
                </span>
              </span>
            </Link>
            <div className="site-header__actions">
              <LanguageSwitch />
              <Link to={ROUTES.home} className="btn btn--outline">
                <Icon name="arrowLeft" size={16} strokeWidth={2.2} />
                {t.common.backToHome}
              </Link>
            </div>
          </div>
        </header>

        <section className="id-band">
          <div className="container id-band__inner">
            <div className="id-band__intro">
              <h1 className="id-band__title">{t.admission.title}</h1>
              <p className="id-band__lead">{t.admission.lead}</p>
            </div>
            <StudentIdBox />
          </div>
        </section>

        <Tabs />

        <main className="container admission__main">
          <NoticeBanner />
          {/* A tab that fails to render shows a message; the header, ID box and tabs stay usable. */}
          <ErrorBoundary key={pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </NoticeProvider>
  );
}

function Tabs() {
  const t = useT();
  const { studentId } = useStudent();
  const { clear } = useNotice();
  const mine = useMyHolds(studentId);
  const count = mine.data?.length ?? 0;
  const tabClass = ({ isActive }: { isActive: boolean }) => `tab${isActive ? ' tab--active' : ''}`;

  return (
    <div className="tabs">
      <nav className="container tabs__inner" aria-label={t.admission.tabsLabel}>
        <NavLink to={ROUTES.admission} end className={tabClass} onClick={clear}>
          {t.admission.tabClasses}
        </NavLink>
        <NavLink to={ROUTES.myApplications} className={tabClass} onClick={clear}>
          {t.admission.tabMine}
          <span className={`tab__count${count > 0 ? ' tab__count--on' : ''}`} aria-label={t.admission.count(count)}>
            {t.num(count)}
          </span>
        </NavLink>
        <NavLink to={ROUTES.admin} className={tabClass} onClick={clear}>
          {t.admission.tabAdmin}
        </NavLink>
      </nav>
    </div>
  );
}
