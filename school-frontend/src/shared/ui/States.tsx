import type { ReactNode } from 'react';
import { useT } from '../i18n/language';
import { Icon } from './Icon';

export function Loading({ label }: { label: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty__icon">
        <Icon name="book" size={26} />
      </span>
      <p className="empty__title">{title}</p>
      {children && <div className="empty__body">{children}</div>}
    </div>
  );
}

/**
 * Shown above data that is still on screen but could not be refreshed: the numbers below
 * may be out of date, and the page says so instead of going blank.
 */
export function StaleBanner() {
  const t = useT();
  return (
    <div className="alert alert--warning alert--compact" role="alert">
      <Icon name="info" className="alert__icon" />
      <div className="alert__body">
        <p className="alert__title">{t.common.stale}</p>
      </div>
    </div>
  );
}
