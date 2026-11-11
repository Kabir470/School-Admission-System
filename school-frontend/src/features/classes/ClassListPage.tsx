import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useT } from '../../shared/i18n/language';
import { inBoth } from '../../shared/i18n/strings';
import { ROUTES } from '../../shared/routes';
import { ErrorMessage } from '../../shared/ui/ErrorMessage';
import { Empty, Loading, StaleBanner } from '../../shared/ui/States';
import { useNotice } from '../admission/notice';
import { useApply, useMyHolds } from '../holds/api';
import { effectiveStatus, occupiesSeat, type Hold } from '../holds/hold';
import { useNow } from '../holds/useNow';
import { useHoldDurationText } from '../settings/api';
import { useStudent } from '../student/StudentContext';
import { CLASS_LIST_REFRESH_MS, useClasses, type ClassSeats } from './api';
import { availability } from './classInfo';
import { SeatBar, SeatLegend, SeatsAvailable, SeatStats } from './SeatBar';

/** Admission tab: every class with its live seat counts and an Apply button. */
export function ClassListPage() {
  const t = useT();
  const { studentId } = useStudent();
  const classes = useClasses();
  const myHolds = useMyHolds(studentId);
  const holdFor = useHoldDurationText();
  const now = useNow(true);

  // The student's live application per class, so a class they already applied to offers
  // "View application" instead of an Apply button that could only be refused.
  const mine = new Map<string, Hold>();
  for (const hold of myHolds.data ?? []) {
    if (occupiesSeat(effectiveStatus(hold, now)) && !mine.has(hold.classId)) {
      mine.set(hold.classId, hold);
    }
  }

  return (
    <section className="tab-panel" aria-labelledby="classes-heading">
      <div className="panel-head">
        <div>
          <h2 id="classes-heading" className="panel-title">
            {t.classes.title}
          </h2>
          <p className="panel-lead">{t.classes.lead(holdFor)}</p>
        </div>
        <div className="panel-head__aside">
          {classes.data && (
            <span className={`live${classes.isError ? ' live--off' : ''}`}>
              <span className="live__dot" aria-hidden="true" />
              {classes.isError ? t.classes.offline : t.classes.live(CLASS_LIST_REFRESH_MS / 1000)}
            </span>
          )}
          <SeatLegend />
        </div>
      </div>

      {studentId === null && (
        <div className="alert alert--info alert--compact">
          <div className="alert__body">
            <p className="alert__title">{t.classes.needId}</p>
          </div>
        </div>
      )}

      {classes.isPending && <Loading label={t.common.loadingClasses} />}

      {classes.isError && !classes.data && (
        <ErrorMessage
          error={classes.error}
          action={
            <button type="button" className="btn btn--outline" onClick={() => classes.refetch()}>
              {t.common.tryAgain}
            </button>
          }
        />
      )}

      {classes.isError && classes.data && <StaleBanner />}

      {classes.data && classes.data.length === 0 && (
        <Empty title={t.classes.none}>
          <p>
            {t.classes.noneBefore}
            <Link to={ROUTES.admin}>{t.classes.noneLink}</Link>
            {t.classes.noneAfter}
          </p>
        </Empty>
      )}

      {classes.data && classes.data.length > 0 && (
        <ul className="class-grid">
          {classes.data.map((cls) => (
            // Keyed by student too: switching student starts each card afresh, so one
            // child's "already applied" message is never shown to another.
            <ClassCard
              key={`${cls.id}:${studentId ?? ''}`}
              cls={cls}
              studentId={studentId}
              myHold={mine.get(cls.id)}
              now={now}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface CardProps {
  cls: ClassSeats;
  studentId: string | null;
  myHold: Hold | undefined;
  now: number;
}

function ClassCard({ cls, studentId, myHold, now }: CardProps) {
  const t = useT();
  const navigate = useNavigate();
  const { show } = useNotice();
  const apply = useApply(cls.id, studentId);
  const state = availability(cls);
  const full = state === 'full';

  // An apply error describes one moment ("no seats left"). Once a seat is free again it is
  // no longer true, so it is cleared rather than left next to an enabled Apply button.
  const { reset } = apply;
  useEffect(() => {
    if (!full) {
      reset();
    }
  }, [full, reset]);

  const onApply = () => {
    apply.mutate(undefined, {
      onSuccess: (hold) => {
        show({ kind: 'success', ...inBoth((s) => s.notices.applied(hold.className)) });
        navigate(ROUTES.application(hold.holdId));
      },
    });
  };

  const applyLabel = apply.isPending
    ? t.classes.applying
    : studentId === null
      ? t.classes.enterIdToApply
      : full
        ? t.classes.seatsFull
        : t.classes.apply;

  return (
    <li className="card class-card" data-testid="class-card">
      <div className="class-card__head">
        <div className="class-card__titles">
          {/* Class names are data entered by the school, shown as entered. */}
          <h3 className="class-card__name" lang="en">
            {cls.name}
          </h3>
          <span className="class-card__sub">{t.seats.inTotal(cls.totalSeats)}</span>
        </div>
        <span className={`pill pill--${state}`}>{t.seats[state]}</span>
      </div>

      <div className="class-card__seats">
        <SeatsAvailable cls={cls} />
        <SeatBar cls={cls} />
      </div>

      <SeatStats cls={cls} />

      <div className="class-card__action">
        {myHold ? (
          <Link className="btn btn--outline-green btn--block" to={ROUTES.application(myHold.holdId)}>
            {effectiveStatus(myHold, now) === 'CONFIRMED' ? t.classes.viewAdmitted : t.classes.viewHeld}
          </Link>
        ) : (
          <button
            type="button"
            className="btn btn--dark btn--block"
            onClick={onApply}
            disabled={studentId === null || full || apply.isPending}
          >
            {applyLabel}
          </button>
        )}
        {!myHold && studentId !== null && full && !apply.isError && <p className="hint">{t.classes.fullHint}</p>}
        {!myHold && apply.isError && <ErrorMessage error={apply.error} compact />}
      </div>
    </li>
  );
}
