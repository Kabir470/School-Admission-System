import type { ReactNode } from 'react';
import { describeError } from '../api/errors';
import { useLanguage } from '../i18n/language';
import { Icon } from './Icon';

interface Props {
  error: unknown;
  /** Optional action, for example a "Try again" button. */
  action?: ReactNode;
  /** Smaller, for use right next to the control that failed. */
  compact?: boolean;
}

/** Shows any failure as words the user can act on, in the chosen language. */
export function ErrorMessage({ error, action, compact = false }: Props) {
  const { lang } = useLanguage();
  const described = describeError(error);
  return (
    <div className={`alert alert--error${compact ? ' alert--compact' : ''}`} role="alert" data-error-code={described.code}>
      <Icon name="info" className="alert__icon" />
      <div className="alert__body">
        <p className="alert__title">{described[lang]}</p>
        {/* The server's own detail (form validation) is English text from the API. */}
        {described.detail && (
          <p className="alert__detail" lang="en">
            {described.detail}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
