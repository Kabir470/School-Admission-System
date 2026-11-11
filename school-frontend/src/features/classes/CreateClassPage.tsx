import { useState, type FormEvent } from 'react';
import { useT } from '../../shared/i18n/language';
import { inBoth, type Strings } from '../../shared/i18n/strings';
import { ErrorMessage } from '../../shared/ui/ErrorMessage';
import { Loading } from '../../shared/ui/States';
import { useNotice } from '../admission/notice';
import { useClasses, useCreateClass, type CreatedClass } from './api';

const MAX_NAME_LENGTH = 100;
const MIN_SEATS = 1;
const MAX_SEATS = 10_000;

/** What is wrong with each field, as text in the chosen language. */
type FieldError = (t: Strings) => string;

interface FieldErrors {
  name?: FieldError;
  totalSeats?: FieldError;
}

/** The same rules the server enforces, checked first so the admin gets an answer at once. */
function validate(name: string, seats: string): FieldErrors {
  const errors: FieldErrors = {};
  const trimmed = name.trim();
  if (trimmed === '') {
    errors.name = (t) => t.admin.errNameEmpty;
  } else if (trimmed.length > MAX_NAME_LENGTH) {
    errors.name = (t) => t.admin.errNameLong(MAX_NAME_LENGTH, trimmed.length);
  }

  if (seats.trim() === '') {
    errors.totalSeats = (t) => t.admin.errSeatsEmpty;
  } else if (!/^[0-9]+$/.test(seats.trim())) {
    errors.totalSeats = (t) => t.admin.errSeatsWhole;
  } else {
    const count = Number(seats.trim());
    if (count < MIN_SEATS || count > MAX_SEATS) {
      errors.totalSeats = (t) => t.admin.errSeatsRange;
    }
  }
  return errors;
}

/** School admin: open a new class from a name and a seat count. */
export function CreateClassPage() {
  const t = useT();
  const createClass = useCreateClass();
  const classes = useClasses();
  const { show } = useNotice();
  const [name, setName] = useState('');
  const [seats, setSeats] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [created, setCreated] = useState<CreatedClass | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = validate(name, seats);
    setErrors(found);
    setCreated(null);
    createClass.reset(); // a server error from an earlier attempt no longer applies
    if (found.name || found.totalSeats) {
      return;
    }

    createClass.mutate(
      { name: name.trim(), totalSeats: Number(seats.trim()) },
      {
        onSuccess: (result) => {
          setCreated(result);
          show({ kind: 'success', ...inBoth((s) => s.notices.created(result.name, result.totalSeats)) });
          // Clear only after success; a failed attempt keeps what was typed.
          setName('');
          setSeats('');
        },
      },
    );
  };

  return (
    <section className="tab-panel">
      <div className="admin">
        <form className="card form" onSubmit={submit} noValidate>
          <div>
            <h2 className="panel-title panel-title--small">{t.admin.title}</h2>
            <p className="panel-lead">{t.admin.lead}</p>
          </div>

          <div className="field">
            <label htmlFor="class-name">{t.admin.name}</label>
            <input
              id="class-name"
              className={`input${errors.name ? ' input--invalid' : ''}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Class 6 - Morning Shift"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'class-name-error' : undefined}
              autoComplete="off"
            />
            {errors.name && (
              <p id="class-name-error" className="field__error" role="alert">
                {errors.name(t)}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="class-seats">{t.admin.seats}</label>
            <input
              id="class-seats"
              className={`input input--short${errors.totalSeats ? ' input--invalid' : ''}`}
              value={seats}
              onChange={(event) => setSeats(event.target.value)}
              placeholder="120"
              inputMode="numeric"
              aria-invalid={Boolean(errors.totalSeats)}
              aria-describedby={errors.totalSeats ? 'class-seats-error' : 'class-seats-help'}
              autoComplete="off"
            />
            {errors.totalSeats ? (
              <p id="class-seats-error" className="field__error" role="alert">
                {errors.totalSeats(t)}
              </p>
            ) : (
              <p id="class-seats-help" className="field__help">
                {t.admin.seatsHelp}
              </p>
            )}
          </div>

          {createClass.isError && <ErrorMessage error={createClass.error} />}

          {created && (
            <p className="form__success" role="status">
              {t.admin.created(created.name, created.totalSeats)}
            </p>
          )}

          <button type="submit" className="btn btn--primary btn--large" disabled={createClass.isPending}>
            {createClass.isPending ? t.admin.creating : t.admin.create}
          </button>
        </form>

        <div className="card admin-list">
          <h3 className="details__title">
            {t.admin.allClasses}
            {classes.data ? ` (${t.num(classes.data.length)})` : ''}
          </h3>
          {classes.isPending && <Loading label={t.common.loadingClasses} />}
          {classes.isError && !classes.data && <ErrorMessage error={classes.error} compact />}
          {classes.data && classes.data.length === 0 && <p className="hint">{t.admin.none}</p>}
          {classes.data && classes.data.length > 0 && (
            <ul className="admin-list__rows">
              {classes.data.map((cls) => (
                <li key={cls.id} className="admin-list__row">
                  <span className="admin-list__name" lang="en">
                    {cls.name}
                  </span>
                  <span className="admin-list__free">{t.admin.free(cls.availableSeats, cls.totalSeats)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
