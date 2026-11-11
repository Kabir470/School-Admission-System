# Story 002: Classes endpoints (create, list, get one)

**Status:** Done
**PRD:** none (spec restated in the architecture doc)
**Architecture:** [school-admission-system.md](../architecture/school-admission-system.md) § Key interfaces
**Estimate:** 1.5 hours
**Depends on:** 001

## Goal

`POST /classes`, `GET /classes` and `GET /classes/{classId}` work and match the contract.

## Architectural context

Contract (extra fields allowed; none of these may be removed or renamed):

```jsonc
// POST /classes   request { "name": "Class 6 - Morning Shift", "totalSeats": 120 }
// 201, Location: /classes/{id}
{ "id": "…", "name": "Class 6 - Morning Shift", "totalSeats": 120 }

// GET /classes → 200, bare array, ordered by name
[ { "id": "…", "name": "…", "totalSeats": 120, "heldSeats": 15, "confirmedSeats": 80, "availableSeats": 25 } ]

// GET /classes/{classId} → 200, the same object
```

- Each class+shift is its own class. IDs are random UUIDs as strings.
- Validation: `name` required, trimmed, 1–100 characters, unique case-insensitively → else 400 `VALIDATION_FAILED` or 409 `CLASS_NAME_TAKEN`. `totalSeats` an integer 1–10000 → else 400. No edit, no delete.
- **Counts are computed from hold rows, never stored** ([ADR 0002](../adrs/0002-lazy-expiry-is-the-guarantee-sweeper-for-timeliness.md)): `heldSeats` = holds with `status='HELD' AND expires_at > now()`; `confirmedSeats` = `status='CONFIRMED'`; `availableSeats = totalSeats − heldSeats − confirmedSeats`. `now()` is the database clock.
- Errors are ProblemDetails plus `code`. Services return `Result<T>`; one mapper in the API turns a code into a status.
- No authentication on `POST /classes` (see `docs/out-of-scope/admin-auth.md`).

## Affected files

- `backend/src/SchoolAdmission.Domain/ClassRules.cs` — add: name and seat-range validation.
- `backend/src/SchoolAdmission.Application/Classes/` — add: `ClassService`, `IClassStore` port, DTOs.
- `backend/src/SchoolAdmission.Infrastructure/Classes/ClassStore.cs` — add: EF insert (maps `23505` on `ux_classes_name_ci`), seat-count SQL.
- `backend/src/SchoolAdmission.Api/Endpoints/ClassEndpoints.cs`, `ResultMapping.cs` — add: endpoints, `Result` → HTTP.
- `backend/tests/SchoolAdmission.Tests/ClassesTests.cs` — add.

## Acceptance criteria

- [x] `[API-01]` WHEN `POST /classes` receives a valid name and seat count THEN the system SHALL return 201 with `id`, `name` (trimmed), `totalSeats`, and a `Location` header pointing at the new class.
- [x] `[API-01]` WHEN the name is missing, blank, or longer than 100 characters, or `totalSeats` is missing, not an integer, below 1 or above 10000 THEN the system SHALL return 400 with `code: "VALIDATION_FAILED"` and SHALL NOT create a class.
- [x] `[API-01]` WHEN a class with the same name already exists, ignoring case and surrounding spaces THEN the system SHALL return 409 with `code: "CLASS_NAME_TAKEN"`.
- [x] `[API-02]` WHEN `GET /classes` is called THEN the system SHALL return 200 with a bare JSON array ordered by name, each element carrying `id`, `name`, `totalSeats`, `heldSeats`, `confirmedSeats`, `availableSeats`. WHEN there are no classes THEN it SHALL return `[]`.
- [x] `[API-03]` WHEN `GET /classes/{classId}` is called with a known id THEN the system SHALL return 200 with the same six fields. WHEN the id is unknown or not a UUID THEN it SHALL return 404 with `code: "CLASS_NOT_FOUND"`.
- [x] `[API-02]` WHEN a new class has no holds THEN `heldSeats` and `confirmedSeats` SHALL be 0 and `availableSeats` SHALL equal `totalSeats`.

## Test plan

- **Happy path:** create → 201 with exact fields and `Location`; list contains it; get-one returns it with zero counts.
- **Edge cases:** name with surrounding spaces is trimmed; 100 characters accepted, 101 rejected; seats 1 and 10000 accepted, 0 and 10001 rejected; `totalSeats: "12"` and `12.5` rejected; duplicate name differing only in case → 409; list is ordered by name; a non-UUID id → 404, not 400 or 500.
- **Error paths:** empty body, malformed JSON → 400 ProblemDetails with `code`.
- **Race:** two parallel creates with the same name → exactly one 201, one 409 (the unique index decides, not a pre-check).

## Out of scope

Holds. Editing or deleting a class. Counts with real holds are asserted in stories 003–005.

## Notes for implementer

- Do not pre-check name uniqueness with a `SELECT`; insert and map `23505`. A pre-check is a race.
- The path id is a string. Parse it with `Guid.TryParse` and answer 404 on failure. A route constraint (`{id:guid}`) would turn a bad id into a route miss with a different error body.
- Keep `availableSeats` computed in one place.
