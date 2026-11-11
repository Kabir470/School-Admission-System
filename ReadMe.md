# School Admission System

Online admission for a school, first come first served. Applying puts a seat on **hold** for a limited time; paying the admission fee inside that time **confirms** it; an unpaid hold expires and its seat goes back to the pool.

- **Backend:** C# / .NET 10 minimal API, PostgreSQL 16
- **Frontend:** React 18, TypeScript, Vite
- **Everything runs in Docker.** Nothing else needs to be installed.

## Run it

```bash
docker compose up --build
```

| What | Where |
|---|---|
| **UI** | **http://localhost:3000** |
| API | http://localhost:8080 (health check: `/health`) |
| Database | PostgreSQL inside Docker, no host port |

The first start builds the images and creates the database schema. Stop with `Ctrl+C` or `docker compose down`.

### Using the UI

The **home page** (`/`) introduces admission and shows live seat counts. Every page has an **English / বাংলা** switch in the header; the choice is remembered. Everything else happens on the **admission page** (`/admission`):

1. **School admin** tab — create a class from a name and a seat count. Each shift is its own class.
2. Type the child's 17-digit **birth registration number** in the box at the top (for example `20152691234567890`). There is no login; this number is the student.
3. **Classes & seats** tab — live seat counts for every class. Press **Apply for a seat** to hold one.
4. **Application** — status, time left, **Pay admission fee**, **Cancel**. When the time runs out the screen changes to `EXPIRED` by itself.
5. **My applications** — every application of this student. It is still there after a refresh or after reopening the browser.

## Run the tests

Both suites run in containers.

```bash
# Backend: 104 tests against a real PostgreSQL (needs the db service, which this starts)
docker compose --profile test run --rm tests

# Frontend: 116 tests (Vitest + React Testing Library + MSW)
docker compose --profile test run --rm frontend-tests
```

The backend suite creates its own throwaway databases and drops them; it does not touch the application's data.

The tests that matter most:

| Test | What it proves |
|---|---|
| `HoldConcurrencyTests.Two_hundred_simultaneous_applies_for_ten_seats_give_exactly_ten_holds` | 200 parallel applies on 10 seats → exactly 10 succeed, 190 get 409 |
| `HoldConcurrencyTests.Two_backend_hosts_on_one_database_still_never_exceed_the_seats` | The same with two backend hosts sharing one database |
| `HoldConcurrencyTests.Twenty_simultaneous_applies_by_one_student_give_exactly_one_hold` | One active application per student per class |
| `ConfirmAndCancelTests.Ten_simultaneous_confirms_of_one_hold_all_succeed_and_count_once` | Repeated confirms count once |
| `ExpiryTests.An_unpaid_hold_expires_and_frees_its_seat_with_no_api_call_and_no_sweeper` | A seat comes back on its own |
| `ContractTests.*` | Field names, types and status codes of all 8 endpoints |
| `ApplicationPage.test.tsx` "flips to EXPIRED…" | The UI shows `EXPIRED` and disables Pay with no reload |

With Node 22+ installed, the frontend tests also run locally: `cd frontend && npm ci && npm test`.

## Things to try

**Watch a hold expire.** Use a short hold time, apply, and watch the application screen:

```bash
HOLD_DURATION_SECONDS=30 docker compose up -d      # PowerShell: $env:HOLD_DURATION_SECONDS=30; docker compose up -d
```

**Data survives a restart.** Create a class and apply, then:

```bash
docker compose down        # keeps the data (named volume "pgdata")
docker compose up -d       # the class and the application are still there
```

`docker compose down -v` deletes the data and starts from an empty database.

**Two backend processes, one database (bonus).**

```bash
docker compose --profile scale up --build
```

This adds a second backend on **http://localhost:8081** and a second copy of the UI on **http://localhost:3001** that talks to it. Both backends share the database, and a class can still never be overbooked, whichever backend a request reaches. `ASSUMPTIONS.md` explains why.

**Stop the backend.** `docker compose stop backend`, then use the UI: every screen says the server cannot be reached and keeps the last data it had. `docker compose start backend` brings it back.

## Configuration

All configuration is environment variables. The defaults work as they are; to change one, copy `.env.example` to `.env` or set it in your shell.

| Variable | Used by | Default | Meaning |
|---|---|---|---|
| `HOLD_DURATION_SECONDS` | backend | `600` | How long a seat stays on hold. Must be a positive whole number, or the backend refuses to start. |
| `ConnectionStrings__Default` | backend | set in `docker-compose.yml` | PostgreSQL connection string. |
| `CORS_ORIGINS` | backend | `http://localhost:3000` (+ `127.0.0.1`, `:3001`) | Origins the UI may call the API from, comma-separated. |
| `API_URL` | frontend | `http://localhost:8080` | The backend address the browser calls. **Read when the container starts**, not at build time: change it and restart the container, no rebuild needed. |

How the runtime `API_URL` works: when the frontend container starts, a script writes `/config.js` (`window.__APP_CONFIG__ = { apiUrl: "…" }`), and the page loads that file before the app.

## API

Base URL `http://localhost:8080`. JSON. The student is identified by the `X-Student-Id` header (17 digits).

| Method & path | Header | Success |
|---|---|---|
| `POST /classes` | — | 201 `{ id, name, totalSeats }` |
| `GET /classes` | — | 200 `[{ id, name, totalSeats, heldSeats, confirmedSeats, availableSeats }]` |
| `GET /classes/{classId}` | — | 200, the same object |
| `POST /classes/{classId}/holds` | `X-Student-Id` | 201 `{ holdId, classId, studentId, status, expiresAt }`; 409 when no seat is left |
| `GET /holds/{holdId}` | — | 200 `{ holdId, classId, status, expiresAt }` |
| `POST /holds/{holdId}/confirm` | `X-Student-Id` | 200 `{ holdId, status }` |
| `DELETE /holds/{holdId}` | `X-Student-Id` | 204 |
| `GET /me/holds` | `X-Student-Id` | 200 `[{ holdId, classId, className, status, expiresAt }]` |

`status` is one of `HELD`, `CONFIRMED`, `EXPIRED`, `CANCELLED`. Responses carry a few extra fields (`className`, `createdAt`, `serverTime`, `remainingMs`). `GET /settings` (not in the brief) returns `{ "holdDurationSeconds": 600 }` for the UI. Errors are RFC 7807 ProblemDetails with an extra `code`, for example:

```json
{ "title": "Conflict", "status": 409, "detail": "No seats are available in this class.", "code": "SEATS_FULL" }
```

## How it works, in short

- **No overbooking.** Applying is one database transaction that first locks the class row (`SELECT … FOR UPDATE`), then counts the active holds, then inserts. The lock is in PostgreSQL, so it works across any number of backend processes. → [ADR 0001](docs/adrs/0001-seat-invariant-enforced-by-per-class-row-lock.md)
- **Expiry needs nothing to run.** A hold counts only while `expires_at > now()` on the database clock, checked on every read. A background sweeper also writes `EXPIRED` into the rows, but correctness does not depend on it. → [ADR 0002](docs/adrs/0002-lazy-expiry-is-the-guarantee-sweeper-for-timeliness.md)
- **The schema is plain SQL** in `backend/db/init/`, applied by PostgreSQL on first start. → [ADR 0003](docs/adrs/0003-database-first-sql-schema-applied-by-postgres-init.md)

## Repository layout

```
backend/
  db/init/001_schema.sql          the schema
  src/SchoolAdmission.Domain/         statuses, error codes, validation rules
  src/SchoolAdmission.Application/    ClassService, HoldService
  src/SchoolAdmission.Infrastructure/ SQL (HoldStore, ClassStore), expiry sweeper
  src/SchoolAdmission.Api/            endpoints, error responses, CORS
  tests/SchoolAdmission.Tests/        integration tests
frontend/
  src/features/{classes,holds,student}/   screens and their data hooks
  src/shared/{api,ui,lib}/                API client, error messages, shared UI
docker-compose.yml
docs/                             architecture, decisions (ADRs), stories
```

## More

- [ASSUMPTIONS.md](ASSUMPTIONS.md) — what I decided where the brief was silent, and how two backends stay consistent.
- [AI_USAGE.md](AI_USAGE.md) — which AI tool I used, for what, and where it was wrong.
- [docs/architecture/school-admission-system.md](docs/architecture/school-admission-system.md) — the full design, with a table mapping each requirement to its mechanism and its test.
- `CLAUDE.md`, `.claude/`, `templates/`, `contexts/` — my working setup for the AI coding agent. Not part of the application.
