# ADR 0002: Lazy expiry is the correctness guarantee; a sweeper is for timeliness

**Status:** Accepted
**Date:** 2026-11-10
**Deciders:** Kabir (project owner)

## Context

A hold lasts `HOLD_DURATION_SECONDS`. When it runs out, its seat must return to the pool **on its own**: nobody calls an API to make that happen (`[BE-02]`).

Nothing in Postgres reacts to the passage of time. A row whose `expires_at` has passed still says `status = 'HELD'` until something writes to it. So there are two ways to make an expired hold stop counting:

1. Something writes `EXPIRED` on a schedule (a background job).
2. Every reader treats an overdue `HELD` row as expired, whatever the stored status says.

If only (1) exists, the system is wrong for as long as the job is late, stopped, or crashed: a seat stays "held" and a parent is told the class is full when it is not. With several backend processes, the job also has to be safe to run in all of them at once.

## Decision

**Lazy expiry is the guarantee.** A hold is live only when `status = 'HELD' AND expires_at > now()`, and every code path applies that test against the database clock:

- **Seat counts** (`GET /classes`, `GET /classes/{id}`): `heldSeats` counts rows with `status = 'HELD' AND expires_at > now()`. `availableSeats = totalSeats − heldSeats − confirmedSeats`.
- **Hold reads** (`GET /holds/{id}`, `GET /me/holds`): an overdue `HELD` row is returned with `status: "EXPIRED"`.
- **Confirm and cancel**: the `UPDATE` carries `AND status = 'HELD' AND expires_at > now()`, so an overdue hold cannot be confirmed or cancelled even if its stored status still says `HELD`.
- **Apply**: inside the class lock, overdue holds of that class are written as `EXPIRED` before the count (ADR 0001, step 2), so the seat is really free for the request that needs it.

With these in place the answers are correct with no background job at all.

**A sweeper keeps the stored status timely.** `ExpirySweeper` is a `BackgroundService` in every backend process. On a `PeriodicTimer` (every `SWEEP_INTERVAL_SECONDS`, default 5) it runs:

```sql
UPDATE holds SET status = 'EXPIRED', expired_at = now()
 WHERE id IN (
   SELECT id FROM holds
    WHERE status = 'HELD' AND expires_at <= now()
    ORDER BY expires_at
    LIMIT @batchSize
    FOR UPDATE SKIP LOCKED);
```

and repeats until a batch comes back empty. `SKIP LOCKED` means two sweepers (two backends) never wait on each other and never process the same row twice; a row one of them has locked is simply left for that one. There is no leader and no coordination. `SWEEPER_ENABLED=false` turns it off; the integration tests do that and call `ISweepRunner.RunOnceAsync()` directly when they want a sweep.

The sweeper matters for two things only: the stored data says what is true (useful to anyone reading the table), and the partial index of ADR 0001 stops carrying dead `HELD` rows.

**Seat counts are always computed from hold rows, never stored as counters.** A counter would need a write at the moment of expiry to stay right, which would put the sweeper back on the correctness path.

## Alternatives considered

- **Sweeper only.** Simple reads (`WHERE status = 'HELD'`), but every answer is wrong for up to one sweep interval, and wrong indefinitely if the job is down. A test with the sweeper disabled would fail. Rejected.
- **Lazy only, no sweeper.** Correct. But rows would say `HELD` forever unless an apply for the same class happens to pass by, and the stored data would mislead anyone looking at the table. Rejected for tidiness, not for correctness.
- **A timer per hold in memory** (`Task.Delay` until expiry, then write). Lost on restart, duplicated across processes, and thousands of timers during a rush. Rejected.
- **`pg_cron` inside the database.** Moves the schedule into Postgres, but needs an extension that the stock `postgres:16` image does not ship. Rejected: a custom database image for a five-line job.
- **Redis keys with TTL.** Expiry is built in, but the hold would live in a second store that is not transactional with the confirm in Postgres. Rejected.
- **Lazy as the guarantee plus a sweeper for timeliness (chosen).**

## Consequences

**Positive:**
- A seat becomes available at the exact moment its hold expires, to the precision of the database clock, with nothing running.
- The sweeper can be slow, stopped, or run in N processes without affecting any answer.
- No counter can drift, because there is no counter.

**Negative / tradeoffs accepted:**
- Every read carries the `expires_at > now()` condition. It lives in a small number of SQL statements in one infrastructure class, so it is not repeated across the codebase, but forgetting it in a new query would be a bug. The expiry test (sweeper off) guards against that.
- Counts are aggregates over `holds`, not a column read. With an index on `(class_id, status)` and at most 10,000 seats per class this is cheap.
- The stored status can lag the truth by up to one sweep interval. Only direct database readers can see the lag; the API never shows it.

**Neutral / follow-ons required:**
- The expiry test must run with the sweeper off and prove the lazy path first, then call `RunOnceAsync()` and prove the write (story 006).
- The UI does not rely on the sweeper either: it counts down to `expiresAt` and shows `EXPIRED` at zero.

## References

- [Architecture: School Admission System](../architecture/school-admission-system.md) § Data flow → Expiry
- [ADR 0001](0001-seat-invariant-enforced-by-per-class-row-lock.md)
- PostgreSQL docs: `SELECT … FOR UPDATE SKIP LOCKED`
