# Story 005: Confirm (pay the fee) and cancel a hold

**Status:** Done
**PRD:** none (spec restated in the architecture doc)
**Architecture:** [school-admission-system.md](../architecture/school-admission-system.md) § Data flow → Confirm, Cancel
**Estimate:** 2 hours
**Depends on:** 004

## Goal

A student can confirm or cancel their own live hold; confirm is idempotent; every other case gets a precise error.

## Architectural context

Both operations are a single conditional `UPDATE`. The database decides; there is no read-then-write in C#.

```sql
-- confirm
UPDATE holds SET status='CONFIRMED', confirmed_at=now()
 WHERE id=@holdId AND student_id=@studentId AND status='HELD' AND expires_at > now();

-- cancel
UPDATE holds SET status='CANCELLED', cancelled_at=now()
 WHERE id=@holdId AND student_id=@studentId AND status='HELD' AND expires_at > now();
```

If the `UPDATE` changes no row, the service reads the hold once to explain why:

| What the row shows | Confirm | Cancel |
|---|---|---|
| no such hold | 404 `HOLD_NOT_FOUND` | 404 `HOLD_NOT_FOUND` |
| belongs to another student | 403 `NOT_YOUR_HOLD` | 403 `NOT_YOUR_HOLD` |
| `CONFIRMED` (this student) | **200** `{holdId, status:"CONFIRMED"}` (idempotent) | 409 `HOLD_ALREADY_CONFIRMED` |
| `CANCELLED` | 409 `HOLD_CANCELLED` | **204** (idempotent) |
| `EXPIRED`, or `HELD` and overdue | 409 `HOLD_EXPIRED` | 409 `HOLD_EXPIRED` |

- Neither path needs the class lock: `HELD → CONFIRMED` leaves `held + confirmed` unchanged and cancel only lowers it ([ADR 0001](../adrs/0001-seat-invariant-enforced-by-per-class-row-lock.md)).
- Ten parallel confirms: one `UPDATE` changes the row; the others find it `CONFIRMED` and answer 200 without writing. `confirmedSeats` rises once.
- After `CANCELLED` or `EXPIRED` the student may apply to the same class again (the partial unique index only covers active statuses).
- Cancelling a confirmed admission is a refund and is out of scope (`docs/out-of-scope/cancel-confirmed.md`).
- Contract: confirm → 200 `{ "holdId": "…", "status": "CONFIRMED" }` (extras: `classId`, `serverTime`). Cancel → 204 with an empty body. Both need `X-Student-Id`; invalid → 400 `INVALID_STUDENT_ID`.

## Affected files

- `backend/src/SchoolAdmission.Application/Holds/HoldService.cs` — modify: `ConfirmAsync`, `CancelAsync`.
- `backend/src/SchoolAdmission.Infrastructure/Holds/HoldStore.cs` — modify: the two updates and the explain-read.
- `backend/src/SchoolAdmission.Api/Endpoints/HoldEndpoints.cs` — modify: two endpoints.
- `backend/tests/SchoolAdmission.Tests/ConfirmTests.cs`, `CancelTests.cs` — add.

## Acceptance criteria

- [x] `[API-06]` WHEN a student confirms their own live hold THEN the system SHALL return 200 with `holdId` and `status: "CONFIRMED"`; `confirmedSeats` SHALL rise by one and `heldSeats` SHALL fall by one.
- [x] `[BE-05]` WHEN the same hold is confirmed 10 times at the same moment THEN every response SHALL be 200 `CONFIRMED` and `confirmedSeats` SHALL have risen by exactly one.
- [x] `[BE-04]` WHEN a student confirms another student's hold THEN the system SHALL return 403 `NOT_YOUR_HOLD` and the hold SHALL be unchanged.
- [x] `[BE-04]` WHEN a student confirms a hold whose time has run out THEN the system SHALL return 409 `HOLD_EXPIRED`, whether or not the stored status has been swept.
- [x] `[BE-04]` WHEN a student confirms a cancelled hold THEN the system SHALL return 409 `HOLD_CANCELLED`.
- [x] `[API-07]` WHEN a student cancels their own live hold THEN the system SHALL return 204 with an empty body, the hold SHALL read `CANCELLED`, and the seat SHALL be available.
- [x] `[API-07]` WHEN an already cancelled hold is cancelled again THEN the system SHALL return 204.
- [x] `[API-07]` WHEN a confirmed hold is cancelled THEN the system SHALL return 409 `HOLD_ALREADY_CONFIRMED` and the seat SHALL stay confirmed.
- [x] `[API-07]` WHEN an expired hold is cancelled THEN the system SHALL return 409 `HOLD_EXPIRED`. WHEN another student's hold is cancelled THEN 403 `NOT_YOUR_HOLD`.
- [x] `[BE-03]` WHEN a student's hold is cancelled or has expired THEN the same student SHALL be able to apply to that class again (201). WHEN the hold is confirmed THEN a new apply SHALL get 409 `ACTIVE_HOLD_EXISTS`.
- [x] `[API-06]` `[API-07]` WHEN the hold id is unknown THEN 404 `HOLD_NOT_FOUND`. WHEN `X-Student-Id` is missing or invalid THEN 400 `INVALID_STUDENT_ID`.

## Test plan

- **Happy path:** confirm → counts move; cancel → 204, empty body, seat back.
- **Race:** 10 parallel confirms → all 200, `confirmedSeats` = 1. WHY: `[BE-05]`; an implementation that increments a counter per call fails it.
- **Race:** confirm and cancel fired together on one hold → exactly one wins; the final state is consistent with the winner (never both).
- **Edge cases:** re-apply after cancel → 201; re-apply after expiry → 201; re-apply after confirm → 409; cancel twice → 204 both times.
- **Error paths:** every cell of the table above; bad header; unknown id.

## Out of scope

Refunds. A payment gateway (`docs/out-of-scope/payment-gateway.md`).

## Notes for implementer

- Check order: header (400) → existence (404) → ownership (403) → state (409).
- The explain-read happens only when the `UPDATE` changed nothing. Do not read first and then update; that reintroduces a race.
- 204 must have no body and no `Content-Type`.
