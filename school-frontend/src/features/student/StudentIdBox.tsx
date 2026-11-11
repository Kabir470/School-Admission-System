import { useState, type FormEvent } from 'react';
import { useLanguage, useT } from '../../shared/i18n/language';
import { formatStudentId } from '../../shared/lib/format';
import { Icon } from '../../shared/ui/Icon';
import { useStudent } from './StudentContext';
import { studentIdProblem } from './studentId';

/**
 * The box at the top of the admission page that says who the student is. There is no
 * login: the child's 17-digit birth registration number is the identity.
 */
export function StudentIdBox() {
  const { studentId, setStudentId } = useStudent();
  const { lang } = useLanguage();
  const t = useT();
  const [draft, setDraft] = useState('');
  const [problem, setProblem] = useState<{ en: string; bn: string } | null>(null);

  if (studentId !== null) {
    return (
      <div className="student student--set" aria-label={t.student.current}>
        <div className="student__who">
          <span className="student__avatar">
            <Icon name="user" />
          </span>
          <span className="student__lines">
            <span className="student__caption">{t.student.applyingAs}</span>
            {/* The number stays in ASCII digits in both languages: it is what gets typed. */}
            <span className="student__id" data-testid="current-student-id" title={studentId} lang="en">
              {formatStudentId(studentId)}
            </span>
          </span>
        </div>
        <button
          type="button"
          className="btn btn--outline-light"
          onClick={() => {
            setStudentId(null);
            setDraft('');
            setProblem(null);
          }}
        >
          {t.student.change}
        </button>
      </div>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = studentIdProblem(draft);
    setProblem(found);
    if (found === null) {
      setStudentId(draft.trim());
    }
  };

  // Spaces, dashes and other separators are dropped as the number is typed or pasted,
  // so "2015 2691 2345 67890" is accepted. Letters and non-ASCII digits are dropped too,
  // and the digit count below makes that visible. The length is deliberately NOT capped:
  // cutting an 18-digit typo down to 17 would silently make a valid but wrong number.
  const onChange = (value: string) => {
    setDraft(value.replace(/[^0-9]/g, ''));
    setProblem(null);
  };

  return (
    <form className="student" onSubmit={submit} noValidate>
      <div className="student__field">
        <label className="student__label" htmlFor="student-id-input">
          {t.student.label}
        </label>
        <input
          id="student-id-input"
          className="student__input"
          value={draft}
          onChange={(event) => onChange(event.target.value)}
          inputMode="numeric"
          autoComplete="off"
          placeholder={t.student.placeholder}
          aria-invalid={problem !== null}
          aria-describedby="student-id-help"
        />
        <button type="submit" className="btn btn--sun">
          {t.student.continue}
        </button>
      </div>
      <p
        id="student-id-help"
        className={`student__help${problem ? ' student__help--error' : ''}`}
        role={problem ? 'alert' : undefined}
      >
        {problem ? problem[lang] : t.student.help(draft.length)}
      </p>
    </form>
  );
}
