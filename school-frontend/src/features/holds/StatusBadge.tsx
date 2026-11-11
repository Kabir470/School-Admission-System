import { useLanguage, useT } from '../../shared/i18n/language';
import type { HoldStatus } from './hold';

/**
 * The application's status. In English it is the API's own word (HELD, CONFIRMED, EXPIRED,
 * CANCELLED); in Bangla the meaning comes first, with that word kept small beside it.
 */
export function StatusBadge({ status, onDark = false }: { status: HoldStatus; onDark?: boolean }) {
  const { lang } = useLanguage();
  const t = useT();
  return (
    <span className={`badge badge--${status.toLowerCase()}${onDark ? ' badge--on-dark' : ''}`} data-testid="hold-status">
      {t.status[status]}
      {lang === 'bn' && (
        <span className="badge__code" lang="en">
          {status}
        </span>
      )}
    </span>
  );
}
