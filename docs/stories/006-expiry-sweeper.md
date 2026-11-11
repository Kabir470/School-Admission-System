# Story 006: Expiry sweeper

**Status:** Done
**PRD:** none (spec restated in the architecture doc)
**Architecture:** [school-admission-system.md](../architecture/school-admission-system.md) § Data flow → Expiry
**Estimate:** 1 hour
**Depends on:** 005

## Goal

A background service writes `EXPIRED` on overdue holds every few seconds, safely in any number of backend processes, without being needed for correctness.

## Architectural context

From [ADR 0002](../adrs/0002-lazy-expiry-is-the-guarantee-sweeper-for-timeliness.md): lazy expiry (stories 002–005) already makes every answer correct. The sweeper only makes the stored status catch up.

```sql
UPDATE holds SET status='EXPIRED', expired_at=now()
 WHERE id IN (
   SELECT id FROM holds
    WHERE status='HELD' AND expires_at <= now()
    ORDER BY expires_at
    LIMIT @batchSize
    FOR UPDATE SKIP LOCKED);
```

- `ExpirySweeper : BackgroundService` ticks on a `PeriodicTimer` every `SWEEP_INTERVAL_SECONDS` (default 5). Each tick opens a DI scope and calls `ISweepRunner.RunOnceAsync()`, which repeats the statement until a batch changes no rows and returns the total.
- `SKIP LOCKED`: two sweepers never wait on each other and never take the same row. No leader.
- `SWEEPER_ENABLED=false` means the hosted service is not registered. `ApiFactory` sets it, and tests call `RunOnceAsync()` directly.
- A failed tick is logged and the loop continues; one bad tick must not stop the service for the life of the process.

## Affected files

- `backend/src/SchoolAdmission.Application/Holds/ISweepRunner.cs` — add: port.
- `backend/src/SchoolAdmission.Infrastructure/Holds/SweepRunner.cs`, `ExpirySweeper.cs` — add.
- `backend/src/SchoolAdmission.Infrastructure/DependencyInjection.cs` — modify: register, honoring `SWEEPER_ENABLED`.
- `backend/tests/SchoolAdmission.Tests/ExpiryTests.cs` — modify: sweeper-path assertions.

## Acceptance criteria

- [x] `[BE-02]` WHEN `RunOnceAsync()` runs and overdue `HELD` holds exist THEN their stored status SHALL become `EXPIRED`, `expired_at` SHALL be set, and the method SHALL return how many it changed.
- [x] `[BE-02]` WHEN `RunOnceAsync()` runs THEN live `HELD` holds and `CONFIRMED` / `CANCELLED` holds SHALL be untouched.
- [x] `[BE-02]` WHEN more overdue holds exist than one batch THEN a single `RunOnceAsync()` SHALL expire all of them.
- [x] `[BONUS-01]` WHEN two sweep runs execute at the same moment THEN each overdue hold SHALL be counted by exactly one of them (the two totals add up to the number of overdue holds).
- [x] `[BE-04]` WHEN a swept hold is confirmed THEN the system SHALL return 409 `HOLD_EXPIRED`.
- [x] `[BE-02]` WHEN `SWEEPER_ENABLED` is `false` THEN no sweeper SHALL run, and every API answer SHALL still be correct (already proven by story 004's lazy test).
- [x] WHEN a sweep tick throws THEN the error SHALL be logged and the next tick SHALL still run.

## Test plan

- **Happy path (continues story 004's expiry test):** 1-second hold; wait by polling until it reads `EXPIRED` while the row still says `HELD`; call `RunOnceAsync()`; assert it returned 1 and the row now says `EXPIRED`; confirm → 409 `HOLD_EXPIRED`.
- **Edge cases:** batch size 2 with 5 overdue holds → all 5 expired in one call; a live hold and a confirmed hold in the same class are untouched.
- **Race:** two `RunOnceAsync()` calls in parallel over 50 overdue holds → totals sum to 50.
- **Hosted service:** with the sweeper enabled and a 1-second interval in a dedicated factory, an overdue row becomes `EXPIRED` in the database within a deadline, with no API call. WHY: proves the timer is actually wired, not only the runner.

## Out of scope

Any change to read paths; they already apply lazy expiry.

## Notes for implementer

- `BackgroundService` gets a scoped `DbContext` through `IServiceScopeFactory`, one scope per tick.
- `PeriodicTimer.WaitForNextTickAsync` throws `OperationCanceledException` on shutdown; let that end the loop quietly.
- Log the count only when it is above zero, or the log fills with noise.
