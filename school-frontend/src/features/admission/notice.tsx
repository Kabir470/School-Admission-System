import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useLanguage, useT } from '../../shared/i18n/language';
import { Icon } from '../../shared/ui/Icon';

export interface Notice {
  kind: 'success' | 'error';
  /** Kept in both languages, so a later language switch also switches the message. */
  en: string;
  bn: string;
}

interface NoticeContextValue {
  notice: Notice | null;
  show: (notice: Notice) => void;
  clear: () => void;
}

const NoticeContext = createContext<NoticeContextValue | null>(null);

/**
 * One message at the top of the admission page, for the result of an action that also
 * moves the user somewhere ("A seat in Class 6 is held for your child"). It survives that
 * navigation, and is cleared when the user switches tab or dismisses it.
 */
export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const show = useCallback((next: Notice) => setNotice(next), []);
  const clear = useCallback(() => setNotice(null), []);
  const value = useMemo(() => ({ notice, show, clear }), [notice, show, clear]);
  return <NoticeContext.Provider value={value}>{children}</NoticeContext.Provider>;
}

export function useNotice(): NoticeContextValue {
  const value = useContext(NoticeContext);
  // Outside the admission page (tests rendering one screen alone) notices are simply not shown.
  return value ?? { notice: null, show: () => {}, clear: () => {} };
}

export function NoticeBanner() {
  const { notice, clear } = useNotice();
  const { lang } = useLanguage();
  const t = useT();
  if (notice === null) {
    return null;
  }

  return (
    <div className={`notice notice--${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
      <Icon name={notice.kind === 'error' ? 'info' : 'check'} className="notice__icon" />
      <p className="notice__text">{notice[lang]}</p>
      <button type="button" className="icon-button" onClick={clear} aria-label={t.common.dismiss}>
        <Icon name="close" size={18} strokeWidth={2.2} />
      </button>
    </div>
  );
}
