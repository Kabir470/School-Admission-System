import { Link } from 'react-router-dom';
import { useT } from '../../shared/i18n/language';
import { formatDuration } from '../../shared/lib/format';
import { ROUTES } from '../../shared/routes';
import { ErrorMessage } from '../../shared/ui/ErrorMessage';
import { Icon } from '../../shared/ui/Icon';
import { Empty, Loading, StaleBanner } from '../../shared/ui/States';
import { useStudent } from '../student/StudentContext';
import { useMyHolds } from './api';
import { effectiveStatus, remainingMs, type Hold } from './hold';
import { StatusBadge } from './StatusBadge';
import { useNow } from './useNow';

/** All of this student's applications and their statuses. */
export function MyApplicationsPage() {
  const t = useT();
  const { studentId } = useStudent();
  const holds = useMyHolds(studentId);
  const now = useNow(true);

  const all = holds.data ?? [];
  // Applications still waiting for payment come first: they are the ones on a clock.
  const active = all.filter((hold) => effectiveStatus(hold, now) === 'HELD');
  const others = all.filter((hold) => effectiveStatus(hold, now) !== 'HELD');

  return (
    <section className="tab-panel" aria-labelledby="mine-heading">
      <div className="panel-head">
        <div>
          <h2 id="mine-heading" className="panel-title">
            {t.mine.title}
          </h2>
          <p className="panel-lead">{t.mine.lead}</p>
        </div>
      </div>

      {studentId === null && <Empty title={t.mine.needId} />}

      {studentId !== null && holds.isPending && <Loading label={t.common.loadingApplications} />}

      {studentId !== null && holds.isError && !holds.data && (
        <ErrorMessage
          error={holds.error}
          action={
            <button type="button" className="btn btn--outline" onClick={() => holds.refetch()}>
              {t.common.tryAgain}
            </button>
          }
        />
      )}

      {studentId !== null && holds.isError && holds.data && <StaleBanner />}

      {studentId !== null && holds.data && all.length === 0 && (
        <Empty title={t.mine.none}>
          <p>
            {t.mine.noneBefore}
            <Link to={ROUTES.admission}>{t.mine.noneLink}</Link>
            {t.mine.noneAfter}
          </p>
        </Empty>
      )}

      {active.length > 0 && (
        <div className="app-group">
          <h3 className="app-group__title">{t.mine.waiting}</h3>
          <ul className="app-list">
            {active.map((hold) => (
              <ApplicationRow key={hold.holdId} hold={hold} now={now} />
            ))}
          </ul>
        </div>
      )}

      {others.length > 0 && (
        <div className="app-group">
          <h3 className="app-group__title">{t.mine.others}</h3>
          <ul className="app-list">
            {others.map((hold) => (
              <ApplicationRow key={hold.holdId} hold={hold} now={now} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ApplicationRow({ hold, now }: { hold: Hold; now: number }) {
  const t = useT();
  const status = effectiveStatus(hold, now);
  const live = status === 'HELD';
  return (
    <li className={`card app-row app-row--${status.toLowerCase()}`} data-testid="application-row">
      <div className="app-row__main">
        <span className="app-row__icon">
          <Icon name="book" size={22} />
        </span>
        <div className="app-row__text">
          <h4 className="app-row__class" lang="en">
            {hold.className}
          </h4>
          <p className="app-row__meta">{t.mine.applied(t.dateTime(hold.createdAt))}</p>
        </div>
      </div>
      <div className="app-row__status">
        {live && (
          <span className="app-row__left" data-testid="row-time-left">
            {t.mine.left(t.digits(formatDuration(remainingMs(hold, now))))}
          </span>
        )}
        <StatusBadge status={status} />
      </div>
      <Link className={`btn ${live ? 'btn--primary' : 'btn--outline'}`} to={ROUTES.application(hold.holdId)}>
        {live ? t.mine.payOrCancel : t.mine.view}
      </Link>
    </li>
  );
}
