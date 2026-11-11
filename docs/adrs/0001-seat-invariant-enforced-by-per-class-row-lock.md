# ADR 0001: The seat invariant is enforced inside Postgres by a per-class row lock

**Status:** Accepted
**Date:** 2026-11-10
**Deciders:** Kabir (project owner)

## Context

For every class, `held + confirmed` must never exceed `totalSeats` (`[BE-01]`). When admission opens, thousands of parents apply at the same moment, so many requests race for the last seats of one class. The bonus requirement (`[BONUS-01]`) adds that two backend processes on different ports, sharing one database, must keep the same guarantee.

The naive code is "count the active holds, and if there is room, insert one". Two requests that both count before either inserts will both see room, and the class is overbooked. Anything that closes this gap has to work across processes and across restarts, so it cannot live in the memory of one backend.

A second rule has the same shape (`[BE-03]`): a student may have at most one active hold or confirmed admission in a class.

## Decision

The database alone is the guard. There is no check-then-insert outside a lock, and no in-process lock, anywhere in the C# code.

Taking a seat is one transaction (READ COMMITTED) that first locks the class row:

```sql
BEGIN;

-- 1. Serialize per class, across ALL backend processes.
SELECT total_seats FROM classes WHERE id = @classId FOR UPDATE;
--    no row → 404 CLASS_NOT_FOUND

-- 2. Lazy catch-up: free the seats of overdue holds in this class.
UPDATE holds SET status = 'EXPIRED', expired_at = <db clock>
 WHERE class_id = @classId AND status = 'HELD' AND expires_at <= <db clock>;

-- 3. One active hold per student per class.
SELECT 1 FROM holds
 WHERE class_id = @classId AND student_id = @studentId
   AND status IN ('HELD','CONFIRMED');
--    found → 409 ACTIVE_HOLD_EXISTS

-- 4. Count while the lock is held.
SELECT count(*) FROM holds
 WHERE class_id = @classId AND status IN ('HELD','CONFIRMED');
--    count >= total_seats → 409 SEATS_FULL

-- 5. Take the seat.
INSERT INTO holds (id, class_id, student_id, status, created_at, expires_at)
VALUES (@id, @classId, @studentId, 'HELD', <db clock>,
        <db clock> + make_interval(secs => @holdSeconds));

COMMIT;
```

Why this is enough:

- Every transaction that can raise a class's active count must pass step 1 and wait for the previous one to commit. Between a request's count (step 4) and its insert (step 5), no other request can insert into the same class.
- Nothing else raises the count. `HELD → CONFIRMED` leaves `held + confirmed` unchanged, and `CONFIRMED`, `CANCELLED`, `EXPIRED` are terminal: no path moves a hold back to an active state. So confirm, cancel and the sweeper do not need the class lock.

A partial unique index backs up step 3:

```sql
CREATE UNIQUE INDEX ux_holds_active_per_student
    ON holds (class_id, student_id)
 WHERE status IN ('HELD','CONFIRMED');
```

If a duplicate ever reaches the insert, Postgres raises `23505` and the API answers 409 `ACTIVE_HOLD_EXISTS`. Step 3 exists so the student gets `ACTIVE_HOLD_EXISTS` rather than `SEATS_FULL` when both are true; the index is what makes the rule impossible to break.

**The database clock is the only clock.** Every expiry decision, in this transaction and everywhere else, compares `expires_at` to the database's time, never to the backend's `DateTime.UtcNow`. Two backend processes with different system clocks therefore cannot disagree about whether a hold is alive. Inside the hold transaction the clock is read with `clock_timestamp()` after the lock is granted, because `now()` is fixed at transaction start and would be stale by however long the request waited in the lock queue. Single-statement reads and updates use `now()`.

Because the lock is a Postgres row lock, the two-process bonus holds with no extra code.

## Alternatives considered

- **C# `lock` / `SemaphoreSlim` per class.** Guards one process only. Two backends each hold their own semaphore and overbook together. It is also lost on restart. Rejected: it cannot meet `[BONUS-01]`, and a guarantee that depends on deployment shape is not a guarantee.
- **Check-then-insert without a lock.** The race described in Context. Rejected: it is the bug.
- **Stored counters with a guarded update** (`UPDATE classes SET held = held + 1 WHERE held + confirmed < total_seats`). Atomic and fast, but the counter is a second copy of the truth. Expiry would have to decrement it, so correctness would depend on the sweeper running, and any bug or manual fix leaves a counter that no longer matches the rows. Rejected: counts are always computed from hold rows (ADR 0002).
- **`SERIALIZABLE` isolation with retry.** Correct, but under a stampede on one class most transactions abort with `40001` and must be retried, which wastes work exactly when load is highest and needs retry code on every path. Rejected: a lock queues requests; serialization failures throw them away.
- **Advisory locks (`pg_advisory_xact_lock`).** Equivalent in effect, but the lock key is an integer derived from the class ID by convention, and nothing ties it to the row. A row lock is tied to the thing being protected and also proves the class exists in the same statement. Rejected: no benefit over the row lock.
- **A seat-per-row table** (one row per seat, claim with `FOR UPDATE SKIP LOCKED`). Scales better on one hot class because claimers do not queue. But it needs up to 10,000 rows per class, and `SKIP LOCKED` can report "full" while a seat is only briefly locked by a request that then fails. Rejected: more moving parts than this problem needs.
- **Per-class row lock with count-then-insert (chosen).** Smallest correct mechanism; works across processes; counts stay derived from rows.

## Consequences

**Positive:**
- The invariant holds for any number of backend processes and survives restarts, because the only shared state is the database.
- The rule is visible in one place, as five SQL statements, and is testable by firing parallel requests at it.
- First-come-first-served falls out for free: Postgres grants the row lock in arrival order.

**Negative / tradeoffs accepted:**
- Applies for the *same* class run one at a time. Each holds the lock for five short statements (about a millisecond of database time), so one class can still take hundreds of applies per second. Applies for different classes do not block each other.
- A request waiting for the lock holds a database connection. The pool is capped per process and Postgres `max_connections` is raised in compose so that waiting requests queue instead of failing.
- The critical path is raw SQL, not LINQ. This is deliberate: the statements should read exactly as written here.

**Neutral / follow-ons required:**
- Tests must prove it: 200 parallel applies on a 10-seat class, 20 parallel applies by one student, and two hosts on one database (stories 003 and 007).
- Reads never take the lock; they compute live counts as described in ADR 0002.

## References

- [Architecture: School Admission System](../architecture/school-admission-system.md) § Data flow
- [ADR 0002](0002-lazy-expiry-is-the-guarantee-sweeper-for-timeliness.md) (expiry), [ADR 0003](0003-database-first-sql-schema-applied-by-postgres-init.md) (schema)
- PostgreSQL docs: Explicit Locking (row-level locks); Date/Time Functions (`now()` vs `clock_timestamp()`)
