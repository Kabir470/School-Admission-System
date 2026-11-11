import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { STRINGS, type Lang, type Strings } from './strings';

const STORAGE_KEY = 'school-admission.lang';

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

// Without a provider (a component tested on its own) the app is simply in English.
const LanguageContext = createContext<LanguageContextValue>({ lang: 'en', setLang: () => {} });

function loadLang(): Lang {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'bn' ? 'bn' : 'en';
  } catch {
    return 'en';
  }
}

/**
 * The chosen language, English by default. It is remembered in localStorage (a convenience:
 * if storage is blocked the choice simply lasts for this visit) and set on <html lang>, so
 * screen readers pronounce the page correctly and the Bangla font applies.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setState] = useState<Lang>(loadLang);

  const setLang = useCallback((next: Lang) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembered; still applies now.
    }
    setState(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}

/** The UI text in the chosen language. */
export function useT(): Strings {
  return STRINGS[useContext(LanguageContext).lang];
}

/** English | বাংলা, as a pair of toggle buttons. */
export function LanguageSwitch({ onDark = false }: { onDark?: boolean }) {
  const { lang, setLang } = useLanguage();
  const t = useT();
  return (
    <div className={`lang-switch${onDark ? ' lang-switch--dark' : ''}`} role="group" aria-label={t.common.language}>
      {(['en', 'bn'] as const).map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          className={`lang-switch__option${lang === option ? ' lang-switch__option--on' : ''}`}
          aria-pressed={lang === option}
          onClick={() => setLang(option)}
        >
          {STRINGS[option].langName}
        </button>
      ))}
    </div>
  );
}
