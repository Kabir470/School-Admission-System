import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useT } from '../../shared/i18n/language';
import { inBoth } from '../../shared/i18n/strings';
import { formatDuration, formatStudentId } from '../../shared/lib/format';
import { ROUTES } from '../../shared/routes';
import { ErrorMessage } from '../../shared/ui/ErrorMessage';
import { Icon } from '../../shared/ui/Icon';
import { Loading, StaleBanner } from '../../shared/ui/States';
import { useNotice } from '../admission/notice';
import { useStudent } from '../student/StudentContext';
import { useCancelHold, useConfirmHold, useHold } from './api';
import { effectiveStatus, remainingMs } from './hold';
import { StatusBadge } from './StatusBadge';
import { useNow } from './useNow';

/** One application: status, time left, "Pay admission fee" and "Cancel". */
export function ApplicationPage() {
  const t = useT();
  const { holdId = '' } = useParams();
  const { studentId } = useStudent();
  const { show, clear } = useNotice();
  const hold = useHold(holdId);
  const confirm = useConfirmHold(holdId, studentId);
  const cancel = useCancelHold(holdId, studentId);
  const [askingToCancel, setAskingToCancel] = useState(false);

  const serverSaysHeld = hold.data?.status === 'HELD';
  // Re-renders every second, and exactly at the expiry moment.
  const now = useNow(serverSaysHeld, hold.data?.expiresAtDeviceMs);
  const status = hold.data ? effectiveStatus(hold.data, now) : null;

  // The moment the countdown reaches zero the screen already shows EXPIRED (derived
  // above, no reload). This asks the server once, so its own word replaces the derived one.
  const expiredLocally = serverSaysHeld && status === 'EXPIRED';
  const { refetch } = hold;
  useEffect(() => {
    if (expiredLocally) {
      void refetch();
    }
  }, [expiredLocally, refetch]);

  const backLink = (
    <Link to={ROUTES.myApplications} className="backlink" onClick={clear}>
      <Icon name="arrowLeft" size={16} strokeWidth={2.2} />
      {t.application.back}
    </Link>
  );

  if (hold.isPending) {
    return (
      <section className="tab-panel">
        <Loading label={t.common.loadingApplication} />
      </section>
    );
  }

  if (!hold.data || status === null) {
    return (
      <section className="tab-panel">
        {backLink}
        <ErrorMessage
          error={hold.error}
          action={
            <button type="button" className="btn btn--outline" onClick={() => hold.refetch()}>
              {t.common.tryAgain}
            </button>
          }
        />
      </section>
    );
  }

  const data = hold.data;
  const left = remainingMs(data, now);
  const lifetime = Date.parse(data.expiresAt) - Date.parse(data.createdAt);
  const busy = confirm.isPending || cancel.isPending;
  const live = status === 'HELD';
  const canAct = live && studentId !== null && !busy;
  const barWidth = live ? Math.min(1, Math.max(0, left / Math.max(lifetime, 1))) * 100 : status === 'CONFIRMED' ? 100 : 0;

  const pay = () => {
    setAskingToCancel(false);
    cancel.reset();
    confirm.mutate(undefined, {
      onSuccess: () => show({ kind: 'success', ...inBoth((s) => s.notices.paid(data.className)) }),
    });
  };

  const doCancel = () => {
    confirm.reset();
    cancel.mutate(undefined, {
      onSuccess: () => show({ kind: 'success', ...inBoth((s) => s.notices.cancelled) }),
      onSettled: () => setAskingToCancel(false),
    });
  };

  const payLabel = confirm.isPending ? t.application.paying : status === 'CONFIRMED' ? t.application.feePaid : t.application.pay;
  const holdLabel =
    status === 'HELD' ? t.application.holdEnds : status === 'EXPIRED' ? t.application.holdEnded : t.application.holdWas;

  return (
    <section className="tab-panel">
      {backLink}
      {hold.isError && <StaleBanner />}

      <div className="application">
        <div className={`application__main application__main--${status.toLowerCase()}`}>
          <div className="application__head">
            <div>
              <p className="application__eyebrow">{t.application.applicationFor}</p>
              <h2 className="application__class" lang="en">
                {data.className}
              </h2>
            </div>
            <StatusBadge status={status} onDark />
          </div>

          <div className="countdown">
            <div className="countdown__numbers">
              <p className="countdown__caption">{live ? t.application.timeLeft : t.application.holdTimer}</p>
              {live ? (
                <p className="countdown__time" role="timer" aria-live="off" data-testid="time-left">
                  {t.digits(formatDuration(left))}
                </p>
              ) : (
                <p className="countdown__time countdown__time--final">
                  {status === 'CONFIRMED' ? t.application.paid : t.digits('00:00')}
                </p>
              )}
            </div>
            <div className="countdown__track" aria-hidden="true">
              <span
                className={`countdown__fill${status === 'CONFIRMED' ? ' countdown__fill--paid' : ''}${live && left <= 60_000 ? ' countdown__fill--urgent' : ''}`}
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </div>

          <p className="application__help">{t.application.statusText[status]}</p>

          <div className="application__actions">
            <button type="button" className="btn btn--sun btn--large" disabled={!canAct} onClick={pay}>
              {payLabel}
            </button>

            {askingToCancel && live ? (
              <div className="confirm-cancel" role="group" aria-label={t.application.confirmCancelLabel}>
                <span>{t.application.confirmCancelQuestion}</span>
                <button type="button" className="btn btn--danger" disabled={!canAct} onClick={doCancel}>
                  {cancel.isPending ? t.application.cancelling : t.application.yesCancel}
                </button>
                <button type="button" className="btn btn--outline-light" disabled={busy} onClick={() => setAskingToCancel(false)}>
                  {t.application.keep}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn--outline-light btn--large"
                disabled={!canAct}
                onClick={() => setAskingToCancel(true)}
              >
                {t.application.cancel}
              </button>
            )}
          </div>

          {live && studentId === null && <p className="application__hint">{t.application.needId}</p>}

          {confirm.isError && <ErrorMessage error={confirm.error} />}
          {cancel.isError && <ErrorMessage error={cancel.error} />}

          {(status === 'EXPIRED' || status === 'CANCELLED') && (
            <Link className="btn btn--sun btn--fit" to={ROUTES.admission} onClick={clear}>
              {t.application.goToList}
              <Icon name="arrowRight" size={18} strokeWidth={2.2} />
            </Link>
          )}
        </div>

        <aside className="card details" aria-labelledby="details-heading">
          <h3 id="details-heading" className="details__title">
            {t.application.details}
          </h3>
          <dl className="details__list">
            <dt>{t.application.applicationId}</dt>
            <dd className="mono">{data.holdId}</dd>
            {studentId && (
              <>
                <dt>{t.application.birthReg}</dt>
                <dd className="tabular" lang="en">
                  {formatStudentId(studentId)}
                </dd>
              </>
            )}
            <dt>{t.application.appliedAt}</dt>
            <dd>{t.dateTime(data.createdAt)}</dd>
            <dt>{holdLabel}</dt>
            <dd>{t.dateTime(data.expiresAt)}</dd>
          </dl>
          <div className="tip">
            <Icon name="info" size={18} />
            <span>{t.application.simulated}</span>
          </div>
        </aside>
      </div>
    </section>
  );
}
