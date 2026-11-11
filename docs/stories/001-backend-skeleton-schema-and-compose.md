# Story 001: Backend skeleton, schema, health check, and compose (db + backend)

**Status:** Done
**PRD:** none (spec restated in the architecture doc)
**Architecture:** [school-admission-system.md](../architecture/school-admission-system.md) § Components, § Data model, § Deployment topology
**Estimate:** 2 hours
**Depends on:** none

## Goal

`docker compose up --build` starts Postgres with the schema applied and a .NET 10 backend that answers `GET /health` on port 8080.

## Architectural context

- Four projects, Clean Architecture trimmed: `Domain` (no dependencies) ← `Application` ← `Infrastructure` ← `Api`. Tests in `tests/SchoolAdmission.Tests`.
- **The schema is SQL, applied by Postgres init** ([ADR 0003](../adrs/0003-database-first-sql-schema-applied-by-postgres-init.md)). `backend/db/init/001_schema.sql` is mounted read-only into `/docker-entrypoint-initdb.d`. EF Core never migrates: no `Database.Migrate()`, no `EnsureCreated()`.
- Tables: `classes (id uuid PK, name varchar(100), total_seats int, created_at timestamptz)` and `holds (id uuid PK, class_id uuid FK, student_id varchar(17), status varchar(10), created_at, expires_at, confirmed_at, cancelled_at, expired_at)`.
- Constraints and indexes: `ux_classes_name_ci` unique on `lower(name)`; `ux_holds_active_per_student` unique on `(class_id, student_id) WHERE status IN ('HELD','CONFIRMED')`; `ix_holds_class_status (class_id, status)`; `ix_holds_student_created (student_id, created_at DESC)`; `ix_holds_due (expires_at) WHERE status='HELD'`; `CHECK`s on status values, `total_seats BETWEEN 1 AND 10000`, name length 1–100 after trim, `student_id ~ '^[0-9]{17}$'`.
- Configuration is environment variables only: `ConnectionStrings__Default`, `HOLD_DURATION_SECONDS` (default 600), `CORS_ORIGINS` (default `http://localhost:3000`), `SWEEPER_ENABLED` (default true), `SWEEP_INTERVAL_SECONDS` (default 5). Invalid values stop the process at startup with a clear message.
- Compose: `db` is `postgres:16` with the named volume `pgdata`, no host port, a TCP health check (so "healthy" means init is finished), and `max_connections` raised. `backend` maps `8080:8080`, waits for `db` healthy, `restart: unless-stopped`.

## Affected files

- `backend/db/init/001_schema.sql` — add: tables, constraints, indexes.
- `backend/SchoolAdmission.sln`, `backend/Directory.Build.props` — add: solution; shared `net10.0`, nullable, warnings as errors.
- `backend/src/SchoolAdmission.Domain/` — add: `HoldStatus`, `ErrorCodes`.
- `backend/src/SchoolAdmission.Application/` — add: `Result<T>`, `Error`.
- `backend/src/SchoolAdmission.Infrastructure/` — add: `AdmissionDbContext`, entity mappings, `AdmissionOptions` + validation, `DependencyInjection`.
- `backend/src/SchoolAdmission.Api/Program.cs` — add: host, `/health`.
- `backend/tests/SchoolAdmission.Tests/` — add: `ApiFactory` (creates a throwaway database, applies `001_schema.sql`, drops it), `HealthTests`, `StartupValidationTests`.
- `backend/Dockerfile`, `backend/.dockerignore` — add: multi-stage build (sdk → aspnet), non-root.
- `docker-compose.yml`, `.env.example` — add: `db`, `backend`.

## Acceptance criteria

- [x] `[OPS-01]` WHEN `docker compose up --build` runs on a machine with only Docker THEN `db` and `backend` SHALL start, in that order, with no manual step.
- [x] `[OPS-02]` WHEN the stack is up THEN `GET http://localhost:8080/health` SHALL return 200, and SHALL return a non-200 status if the database is unreachable.
- [x] `[OPS-02]` WHEN `ConnectionStrings__Default` is missing THEN the backend SHALL fail at startup with a message naming the variable.
- [x] `[BE-02]` WHEN `HOLD_DURATION_SECONDS` is not a positive integer (for example `0`, `-5`, `abc`) THEN the backend SHALL fail at startup with a message naming the variable. WHEN it is unset THEN the value SHALL be 600.
- [x] `[BE-06]` WHEN the stack is stopped with `docker compose down` and started again THEN the tables and their rows SHALL still be there (named volume).
- [x] `[BE-03]` WHEN two rows with the same `(class_id, student_id)` and an active status are inserted directly THEN the second insert SHALL fail with SQLSTATE `23505`.

## Test plan

- **Happy path:** `HealthTests` — `/health` is 200 against the test database.
- **Edge cases:** `StartupValidationTests` — duration `0`, `-1`, `abc` each throw at host build; unset gives 600. Schema test — duplicate active hold insert raises `23505`; a second hold is accepted once the first is `CANCELLED`.
- **Error paths:** missing connection string throws at startup.
- **Manual:** `docker compose up --build`, curl `/health`; `down` then `up`, confirm a row inserted with `psql` is still present.

## Out of scope

Any business endpoint. The frontend service. The `test` and `scale` compose profiles (stories 007 and 010).

## Notes for implementer

- `pg_isready` with no host uses the unix socket, which the init-time server *does* answer. Use `pg_isready -h 127.0.0.1` so health flips only after init scripts have run.
- Cap the Npgsql pool in the connection string (`Maximum Pool Size`) and raise Postgres `max_connections`, so two backends plus a test run fit. A stampede on one class leaves many requests waiting on the row lock, each holding a connection.
- The test project copies `backend/db/init/001_schema.sql` into its output and applies that exact file. Do not keep a second copy of the schema.
- Listen on `http://+:8080` via `ASPNETCORE_URLS` in the Dockerfile.
