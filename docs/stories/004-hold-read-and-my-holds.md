# Story 004: Read a hold and list my holds (lazy expiry on reads)

**Status:** Done
**PRD:** none (spec restated in the architecture doc)
**Architecture:** [school-admission-system.md](../architecture/school-admission-system.md) § Data flow → Expiry
**Estimate:** 1.5 hours
**Depends on:** 003

## Goal

`GET /holds/{holdId}` and `GET /me/holds` return the true state of a hold, including `EXPIRED` the moment its time runs out, with nothing running in the background.

## Architectural context

- **Lazy expiry is the guarantee** ([ADR 0002](../adrs/0002-lazy-expiry-is-the-guarantee-sweeper-for-timeliness.md)). A hold is live only when `status='HELD' AND expires_at > now()` (database clock). Reads present an overdue `HELD` row as `EXPIRED`:

```sql
CASE WHEN h.status = 'HELD' AND h.expires_at <= now() THEN 'EXPIRED' ELSE h.status END AS status
```

- Seat counts (story 002) already use the same test, so a seat is available again at the same instant the hold reads as `EXPIRED`.
- Contract:

```jsonc
// GET /holds/{holdId} → 200           (no header required; none is listed)
{ "holdId": "…", "classId": "…", "status": "HELD", "expiresAt": "2026-11-01T04:10:00Z" }
// extras: "className", "createdAt", "serverTime".  NEVER "studentId".

// GET /me/holds  (X-Student-Id) → 200, bare array, newest first, ALL statuses
[ { "holdId": "…", "classId": "…", "className": "Class 6 - Morning Shift", "status": "HELD", "expiresAt": "…" } ]
// extras: "createdAt", "serverTime"
```

- `status` is one of `HELD`, `CONFIRMED`, `EXPIRED`, `CANCELLED`, uppercase.
- `GET /holds/{holdId}` has no ownership check, so it must not reveal who the hold belongs to. The hold id is a random UUID and acts as the capability.
- `serverTime` is the database's `now()`, sent so the UI can correct its countdown for a wrong client clock.

## Affected files

- `backend/src/SchoolAdmission.Application/Holds/HoldService.cs` — modify: `GetAsync`, `ListForStudentAsync`.
- `backend/src/SchoolAdmission.Infrastructure/Holds/HoldStore.cs` — modify: the two read queries.
- `backend/src/SchoolAdmission.Api/Endpoints/HoldEndpoints.cs` — modify: two endpoints.
- `backend/tests/SchoolAdmission.Tests/HoldReadTests.cs`, `ExpiryTests.cs` — add.

## Acceptance criteria

- [x] `[API-05]` WHEN `GET /holds/{holdId}` is called for a live hold THEN the system SHALL return 200 with `holdId`, `classId`, `status: "HELD"`, `expiresAt`, and the body SHALL NOT contain `studentId`.
- [x] `[API-05]` WHEN it is called with no `X-Student-Id` header THEN the system SHALL still return 200.
- [x] `[API-05]` WHEN the hold id is unknown or not a UUID THEN the system SHALL return 404 `HOLD_NOT_FOUND`.
- [x] `[BE-02]` WHEN a hold's time has run out and no API call or sweeper has touched it THEN `GET /holds/{holdId}` SHALL return `status: "EXPIRED"`, and `GET /classes/{classId}` SHALL count its seat as available.
- [x] `[API-08]` WHEN `GET /me/holds` is called with a valid `X-Student-Id` THEN the system SHALL return 200 with a bare array of that student's holds in every status, newest first, each with `holdId`, `classId`, `className`, `status`, `expiresAt`. WHEN the student has none THEN it SHALL return `[]`.
- [x] `[API-08]` WHEN `GET /me/holds` is called THEN the array SHALL NOT include another student's holds.
- [x] `[API-08]` WHEN `X-Student-Id` is missing or invalid on `GET /me/holds` THEN the system SHALL return 400 `INVALID_STUDENT_ID`.

## Test plan

- **Happy path:** apply, read by id, list mine: fields, types, order.
- **Expiry (sweeper off, `HOLD_DURATION_SECONDS=1`):** apply; poll `GET /holds/{id}` with a deadline until `EXPIRED` (no fixed sleep); assert the stored row still says `HELD` (proving the read is lazy) and that the class shows the seat available. WHY: `[BE-02]` says the seat returns on its own; a reader that trusted the stored status would fail this.
- **Edge cases:** `/me/holds` for a student with holds in two classes and mixed statuses; isolation between two students; overdue hold also reads `EXPIRED` in the list.
- **Error paths:** unknown and malformed hold ids → 404; bad header on `/me/holds` → 400.

## Out of scope

Confirm and cancel (005). Writing `EXPIRED` to the row (006).

## Notes for implementer

- The response DTO for `GET /holds/{id}` must be a type that has no `studentId` property at all, so it cannot leak by accident. Assert its absence in a test.
- Both reads take `now() AS server_time` in the same statement as the status, so the two always agree.
- Poll with a deadline in tests; never `Task.Delay` a fixed amount and hope.
