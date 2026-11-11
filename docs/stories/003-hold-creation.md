# Story 003: Apply for a seat (hold creation under the class lock)

**Status:** Done
**PRD:** none (spec restated in the architecture doc)
**Architecture:** [school-admission-system.md](../architecture/school-admission-system.md) § Data flow → Apply for a seat
**Estimate:** 2.5 hours
**Depends on:** 002

## Goal

`POST /classes/{classId}/holds` takes a seat for a student and can never overbook a class, however many requests arrive at once.

## Architectural context

This is the one path that can raise a class's active count. It follows [ADR 0001](../adrs/0001-seat-invariant-enforced-by-per-class-row-lock.md) exactly. One READ COMMITTED transaction:

```sql
SELECT total_seats FROM classes WHERE id = @classId FOR UPDATE;      -- no row → 404
-- db clock read with clock_timestamp() AFTER the lock is granted
UPDATE holds SET status='EXPIRED', expired_at=@now
 WHERE class_id=@classId AND status='HELD' AND expires_at <= @now;    -- lazy catch-up
SELECT 1 FROM holds WHERE class_id=@classId AND student_id=@studentId
   AND status IN ('HELD','CONFIRMED');                                -- found → 409 ACTIVE_HOLD_EXISTS
SELECT count(*) FROM holds WHERE class_id=@classId
   AND status IN ('HELD','CONFIRMED');                                -- >= total_seats → 409 SEATS_FULL
INSERT INTO holds (id, class_id, student_id, status, created_at, expires_at)
VALUES (@id, @classId, @studentId, 'HELD', @now, @now + make_interval(secs => @holdSeconds));
```

- **No seat check in C# memory, no `lock` / `SemaphoreSlim`.** The row lock is the guard, so it also holds across backend processes.
- The partial unique index `ux_holds_active_per_student` backs up the per-student rule: a `23505` on insert becomes 409 `ACTIVE_HOLD_EXISTS`.
- **The database clock is the only clock.** `expires_at` is never computed from `DateTime.UtcNow`.
- `X-Student-Id` must be exactly 17 ASCII digits; missing or invalid → 400 `INVALID_STUDENT_ID`, checked before the database is touched.
- Contract:

```jsonc
// POST /classes/{classId}/holds  (X-Student-Id) → 201, Location: /holds/{holdId}
{ "holdId": "…", "classId": "…", "studentId": "20152691234567890", "status": "HELD", "expiresAt": "2026-11-01T04:10:00Z" }
// extras: "className", "createdAt", "serverTime"
// no seat → 409
```

- Timestamps on the wire are whole seconds ending in `Z`. `expiresAt` is rounded **up** to the next second, so once the reported time has passed the hold is certainly expired. `serverTime` is rounded down.

## Affected files

- `backend/src/SchoolAdmission.Domain/StudentId.cs` — add: 17-ASCII-digit rule.
- `backend/src/SchoolAdmission.Application/Holds/` — add: `HoldService.CreateAsync`, `IHoldStore` port, DTOs.
- `backend/src/SchoolAdmission.Infrastructure/Holds/HoldStore.cs` — add: the transaction above.
- `backend/src/SchoolAdmission.Api/Endpoints/HoldEndpoints.cs`, `StudentIdHeader.cs`, `Json/` — add: endpoint, header reading, timestamp converters.
- `backend/tests/SchoolAdmission.Tests/HoldConcurrencyTests.cs`, `HoldCreationTests.cs` — add.

## Acceptance criteria

- [x] `[API-04]` WHEN a student applies to a class with a free seat THEN the system SHALL return 201 with `holdId`, `classId`, `studentId`, `status: "HELD"`, `expiresAt`, and the class's `heldSeats` SHALL rise by one.
- [x] `[BE-02]` WHEN a hold is created THEN `expiresAt` SHALL be the database time of creation plus `HOLD_DURATION_SECONDS`.
- [x] `[BE-01]` WHEN 200 different students apply at the same moment to a class with 10 seats THEN exactly 10 requests SHALL get 201, the other 190 SHALL get 409 `SEATS_FULL`, the database SHALL hold exactly 10 active holds for the class, and `availableSeats` SHALL be 0.
- [x] `[BE-03]` WHEN one student sends 20 applies at the same moment to one class THEN exactly one SHALL get 201 and the other 19 SHALL get 409 `ACTIVE_HOLD_EXISTS`.
- [x] `[BE-03]` WHEN a student who holds a seat in one class applies to a different class THEN the system SHALL return 201 (shifts are separate classes).
- [x] `[API-04]` WHEN `X-Student-Id` is missing, shorter or longer than 17, or contains a non-digit THEN the system SHALL return 400 `INVALID_STUDENT_ID` and SHALL NOT create a hold.
- [x] `[API-04]` WHEN the class id is unknown or not a UUID THEN the system SHALL return 404 `CLASS_NOT_FOUND`.
- [x] `[BE-02]` WHEN a class is full only because of holds whose time has run out THEN a new apply SHALL succeed, with no other API call in between.

## Test plan

- **Happy path:** apply → 201, fields and types exact, `expiresAt` within a second of now + duration, counts move.
- **Race (the required concurrency test):** 200 parallel applies / 10 seats, released together from a gate so they really overlap. Assert the three numbers (201 count, 409 count, DB active count) and `availableSeats`. WHY: this is `[BE-01]`; a check-then-insert implementation fails it.
- **Race:** 20 parallel applies by one student → one 201.
- **Edge cases:** last seat taken → next apply 409 `SEATS_FULL`; already-holding student on a *full* class gets `ACTIVE_HOLD_EXISTS`, not `SEATS_FULL`; student ID with 16 or 18 digits, letters, spaces, or non-ASCII digits (for example Bangla numerals) → 400.
- **Error paths:** unknown class → 404; malformed class id → 404.

## Out of scope

Reading holds, confirm, cancel (stories 004, 005). The sweeper (006). The two-host test (007).

## Notes for implementer

- `char.IsDigit` accepts non-ASCII digits. Use an explicit `'0'..'9'` check.
- Read the clock *after* the `FOR UPDATE` returns. `now()` is fixed at transaction start and goes stale while the request waits in the lock queue.
- Any failure after `BEGIN` must roll back, so the lock is released. Use `await using` on the transaction.
- In the concurrency test, do not assert on timing. Start all tasks, release them together, await all, then count.
- Raise `HttpClient` / test server limits if needed so 200 requests really run in parallel.
