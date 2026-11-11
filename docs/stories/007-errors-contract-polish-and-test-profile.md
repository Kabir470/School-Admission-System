# Story 007: Error mapping, contract polish, two-host test, Docker test profile

**Status:** Done
**PRD:** none (spec restated in the architecture doc)
**Architecture:** [school-admission-system.md](../architecture/school-admission-system.md) § Key interfaces, § Cross-cutting concerns
**Estimate:** 2 hours
**Depends on:** 006

## Goal

Every response, including every failure, has the documented shape; a contract test pins all eight endpoints; the two-process guarantee is tested; and the whole backend suite runs with Docker alone.

## Architectural context

- **Errors** are RFC 7807 ProblemDetails (`application/problem+json`) with an extra `code`:

```json
{ "type": "about:blank", "title": "Conflict", "status": 409, "detail": "No seats are available in this class.", "code": "SEATS_FULL" }
```

  Codes: `SEATS_FULL`, `ACTIVE_HOLD_EXISTS`, `HOLD_EXPIRED`, `HOLD_CANCELLED`, `HOLD_ALREADY_CONFIRMED`, `CLASS_NAME_TAKEN` (409); `NOT_YOUR_HOLD` (403); `INVALID_STUDENT_ID`, `VALIDATION_FAILED` (400); `CLASS_NOT_FOUND`, `HOLD_NOT_FOUND`, `NOT_FOUND` (404); `METHOD_NOT_ALLOWED` (405); `INTERNAL_ERROR` (500).
- Malformed JSON, a missing body, or a wrong JSON type → 400 `VALIDATION_FAILED`. Unknown routes → 404 JSON. Unhandled exceptions → 500 JSON with no stack trace, exception message, or SQL in the body.
- JSON is camelCase. Statuses are uppercase strings. Timestamps are whole-second ISO-8601 UTC ending in `Z`.
- **CORS:** allowed origins from `CORS_ORIGINS` (comma-separated, default `http://localhost:3000`). The browser must be able to send `X-Student-Id` and `Content-Type`, and use `GET`, `POST`, `DELETE`.
- **Two processes, one database** (`[BONUS-01]`): because the seat guard is a Postgres row lock ([ADR 0001](../adrs/0001-seat-invariant-enforced-by-per-class-row-lock.md)), two hosts need no extra code. The test starts two `ApiFactory` instances on one database to prove it.
- **Tests run with Docker only:** a `tests` service under the compose profile `test` builds the SDK stage and runs `dotnet test` against the compose `db`, in a database it creates and drops.

## Affected files

- `backend/src/SchoolAdmission.Api/Errors/` — add/modify: ProblemDetails writer, exception handler, 404/405 handling, bad-request handling.
- `backend/src/SchoolAdmission.Api/Program.cs` — modify: CORS, JSON options, handlers.
- `backend/tests/SchoolAdmission.Tests/ContractTests.cs`, `ErrorShapeTests.cs`, `TwoHostsTests.cs`, `CorsTests.cs` — add.
- `backend/Dockerfile` — modify: a `test` stage.
- `docker-compose.yml` — modify: `tests` service (profile `test`).

## Acceptance criteria

- [x] `[API-01]`…`[API-08]` WHEN each of the eight endpoints succeeds THEN the response SHALL have the documented status code and SHALL contain every contract field with the documented JSON type; timestamps SHALL match `YYYY-MM-DDTHH:MM:SSZ`.
- [x] `[API-05]` WHEN `GET /holds/{holdId}` succeeds THEN the body SHALL NOT contain `studentId`.
- [x] `[API-07]` WHEN `DELETE /holds/{holdId}` succeeds THEN the response SHALL be 204 with a zero-length body.
- [x] `[UI-05]` WHEN any request fails THEN the response SHALL be `application/problem+json` with `status`, `title`, `detail` and a `code` from the list above.
- [x] WHEN the request body is malformed JSON, empty, or has a wrong type THEN the system SHALL return 400 `VALIDATION_FAILED`.
- [x] WHEN the route is unknown THEN the system SHALL return 404 as ProblemDetails JSON, not an empty body.
- [x] WHEN an unexpected exception occurs THEN the system SHALL return 500 `INTERNAL_ERROR` and the body SHALL NOT contain a stack trace or exception text.
- [x] `[OPS-03]` WHEN a browser at an allowed origin sends a preflight for `POST` with `X-Student-Id` THEN the response SHALL allow it. WHEN the origin is not allowed THEN no `Access-Control-Allow-Origin` header SHALL be sent.
- [x] `[BONUS-01]` WHEN 100 students apply at the same moment to a 10-seat class, split across two backend hosts on one database THEN exactly 10 SHALL succeed and the database SHALL hold exactly 10 active holds.
- [x] `[DLV-01]` WHEN `docker compose --profile test run --rm tests` runs on a machine with only Docker THEN the full backend suite SHALL run and pass, with no test skipped.

## Test plan

- **Contract:** one test per endpoint asserting status, exact field set (required names present), JSON value kinds, timestamp regex, `Location` headers. WHY: the graders run automated tests against these shapes.
- **Error shape:** a table-driven test hitting one case per `code`, asserting status + `code` + content type.
- **Edge cases:** malformed JSON; empty body; `totalSeats` as a string; unknown route; wrong method on a known route.
- **Error paths:** a test-only store that throws → 500 with no leak.
- **Race:** the two-host test above.
- **Manual:** `docker compose --profile test run --rm tests`.

## Out of scope

The frontend. The `scale` compose profile (story 010).

## Notes for implementer

- Minimal APIs answer a bad JSON body with their own 400 before the endpoint runs. Route that through the same ProblemDetails writer so it carries `code`.
- The `tests` container reaches Postgres at host `db`; locally the suite reads `TEST_DB_CONNECTION` and falls back to `localhost`.
- Each `ApiFactory` creates a uniquely named database and drops it on dispose, so test classes can run in parallel and a crashed run does not poison the next.
- Mark the contract checks on the eight story acceptance lists as done only after this suite is green.
