import { useT } from '../../shared/i18n/language';
import type { ClassSeats } from './api';
import { share } from './classInfo';

/** Confirmed (green) then on hold (yellow) on a grey track: what is left is available. */
export function SeatBar({ cls }: { cls: ClassSeats }) {
  const t = useT();
  return (
    <div
      className="seatbar"
      role="img"
      aria-label={t.seats.barLabel(cls.confirmedSeats, cls.heldSeats, cls.availableSeats, cls.totalSeats)}
    >
      <span className="seatbar__confirmed" style={{ width: share(cls.confirmedSeats, cls.totalSeats) }} />
      <span className="seatbar__held" style={{ width: share(cls.heldSeats, cls.totalSeats) }} />
    </div>
  );
}

export function SeatLegend() {
  const t = useT();
  return (
    <div className="legend">
      <span className="legend__item">
        <span className="legend__swatch legend__swatch--confirmed" />
        {t.seats.confirmed}
      </span>
      <span className="legend__item">
        <span className="legend__swatch legend__swatch--held" />
        {t.seats.onHold}
      </span>
      <span className="legend__item">
        <span className="legend__swatch legend__swatch--free" />
        {t.seats.available}
      </span>
    </div>
  );
}

/** Total, on hold, confirmed: the three numbers under each card. */
export function SeatStats({ cls }: { cls: ClassSeats }) {
  const t = useT();
  return (
    <dl className="stats">
      <div className="stat">
        <dt>{t.seats.total}</dt>
        <dd data-testid="total-seats">{t.num(cls.totalSeats)}</dd>
      </div>
      <div className="stat">
        <dt>{t.seats.onHold}</dt>
        <dd data-testid="held-seats">{t.num(cls.heldSeats)}</dd>
      </div>
      <div className="stat">
        <dt>{t.seats.confirmed}</dt>
        <dd data-testid="confirmed-seats">{t.num(cls.confirmedSeats)}</dd>
      </div>
    </dl>
  );
}

/** "25 seats available", the big number on each card. */
export function SeatsAvailable({ cls }: { cls: ClassSeats }) {
  const t = useT();
  return (
    <p className="big-number">
      <span data-testid="available-seats">{t.num(cls.availableSeats)}</span>
      <span className="big-number__unit">{t.seats.availableUnit}</span>
    </p>
  );
}
