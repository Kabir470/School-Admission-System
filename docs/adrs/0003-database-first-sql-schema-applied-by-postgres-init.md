# ADR 0003: The schema is database-first SQL, applied by Postgres init

**Status:** Accepted
**Date:** 2026-11-10
**Deciders:** Kabir (project owner)

## Context

The schema is small (two tables) but it carries the system's guarantees: a partial unique index, `CHECK` constraints, and the indexes the seat count and the sweeper rely on (ADR 0001, ADR 0002). Something has to create it on a machine that has only Docker, and it must work when two backend processes start at the same time against one database (`[BONUS-01]`).

The usual EF Core approach is `Database.Migrate()` at startup. With two backends that means two processes racing to create the same tables. EF's migration lock helps on recent versions, but the schema would then be expressed in C# migration code, where partial indexes and check constraints are second-class and easy to get subtly wrong.

## Decision

The schema is plain SQL in `backend/db/init/`, and Postgres applies it.

- `backend/db/init/001_schema.sql` is the single source of truth for tables, constraints and indexes.
- `docker-compose.yml` mounts that folder read-only into the `db` container at `/docker-entrypoint-initdb.d`. The official image runs every file there, in name order, the first time it starts on an empty data volume.
- The backend starts only after `db` reports healthy, and the health check uses TCP, which the temporary init-time server does not accept. So "healthy" means the schema is already there.
- **EF Core never changes the schema.** No `Database.Migrate()`, no `EnsureCreated()`, no migrations folder. Entities are mapped by hand to the existing tables.
- EF Core (Npgsql) is used for class creation and as the connection and transaction owner. Reads that need the database clock, and the hold, confirm, cancel and sweep paths, are raw SQL run through the same `DbContext`, inside an explicit transaction where more than one statement is involved.
- The integration tests create a throwaway database and apply the same `001_schema.sql` file to it, so tests run against the real schema, not a copy.

## Alternatives considered

- **EF Core migrations run at startup.** Two backends race; the guarantees live in generated C#; a startup failure in migration takes the API down. Rejected.
- **EF Core migrations run by a one-shot "migrator" container.** Removes the race, but adds a service, an ordering dependency, and the EF tooling to the image, to manage two tables that will not change. Rejected as out of proportion.
- **`EnsureCreated()`.** No migrations history, cannot express the partial index without extra SQL anyway, and still races. Rejected.
- **A migration tool (Flyway, DbUp).** The right answer for a schema that evolves in production. This schema is created once. Rejected for now; see Consequences.
- **SQL files applied by Postgres init (chosen).**

## Consequences

**Positive:**
- No migration race: the schema exists before any backend starts, however many there are.
- The constraints that matter are readable as the SQL that Postgres actually runs.
- The backend image needs no EF tooling and has no schema-changing code path.

**Negative / tradeoffs accepted:**
- Init scripts run only on an empty data volume. A schema change after first start needs `docker compose down -v` (which deletes data) or a manual `ALTER`. Acceptable here: there is no production data and no planned schema change. A real deployment would add a migration tool at that point.
- Entities and SQL can drift apart, because nothing generates one from the other. The integration tests run every endpoint against the real schema, so drift fails a test.

**Neutral / follow-ons required:**
- The README must say that `down -v` resets the database and that plain `down` keeps it (`[BE-06]`).

## References

- [Architecture: School Admission System](../architecture/school-admission-system.md) § Deployment topology
- [ADR 0001](0001-seat-invariant-enforced-by-per-class-row-lock.md), [ADR 0002](0002-lazy-expiry-is-the-guarantee-sweeper-for-timeliness.md)
- Docker Hub `postgres` image docs: Initialization scripts
