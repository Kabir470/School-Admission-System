# Assumptions

What I decided where the brief is silent, and why. The design itself is in [docs/architecture](docs/architecture/school-admission-system.md) and [docs/adrs](docs/adrs/).

## How two backend processes never overbook (bonus)

The seat check is not in the application. It is a row lock in PostgreSQL ([ADR 0001](docs/adrs/0001-seat-invariant-enforced-by-per-class-row-lock.md)).

Applying for a seat is one transaction:

1. `SELECT … FROM classes WHERE id = … FOR UPDATE` locks that class's row. Any other apply for the same class, from **any** backend process, waits here until the first one commits.
2. Holds in that class whose time has run out are marked `EXPIRED`.
3. Active holds (`HELD` + `CONFIRMED`) are counted. If the count has reached `totalSeats`, the answer is 409.
4. Otherwise the hold is inserted and the transaction commits, which releases the lock.

Because the count and the insert happen while the lock is held, no two requests can both see "one seat left" and both take it. The lock lives in the database that both processes share, so it works the same for one process or ten; there is no extra code for the multi-process case. Every expiry decision uses the database clock, never a backend's own clock, so two processes cannot disagree about whether a hold is still alive. A partial unique index (`UNIQUE (class_id, student_id) WHERE status IN ('HELD','CONFIRMED')`) enforces "one active application per student per class" the same way.

Proof: a test fires 200 parallel applies at a 10-seat class, and another splits 100 applies across two backend hosts on one database. Exactly 10 succeed each time. To see it live: `docker compose --profile scale up` starts a second backend on port 8081.

## Expiry

- **A seat returns the moment its hold expires, with nothing running.** Every read counts a hold only if `status = 'HELD' AND expires_at > now()`, and shows an overdue hold as `EXPIRED` ([ADR 0002](docs/adrs/0002-lazy-expiry-is-the-guarantee-sweeper-for-timeliness.md)). A background sweeper (every 5 s) also writes `EXPIRED` into the row, but only to keep stored data tidy. Why: if correctness depended on a background job, a slow or stopped job would make a free seat look taken.
- **Seat counts are computed from hold rows, never stored.** Why: a stored counter can drift from the rows it summarizes.
- **Timestamps on the wire are whole seconds** (`2026-11-01T04:10:00Z`), matching the brief's examples. `expiresAt` is rounded up to the next second. Why: once the reported time has passed, the hold is certainly expired, so the UI and the server never disagree at the boundary.

## Confirm and cancel

- **Confirming an already confirmed hold (same student) returns 200 again** and changes nothing. Why: the brief says repeated confirms must count once; a retry after a lost response should look like success.
- **Confirm errors:** expired → 409, cancelled → 409, someone else's hold → 403, unknown → 404.
- **Only a live `HELD` hold can be cancelled** (→ `CANCELLED`, 204). Cancelling an already cancelled hold → 204 again. Cancelling an expired hold → 409.
- **Cancelling a confirmed admission → 409.** Why: it has been paid for, so undoing it is a refund, and the brief gives no refund policy.
- **After `EXPIRED` or `CANCELLED`, the student may apply to that class again.** Why: otherwise one missed payment window would lock a child out for good.
- **One student may hold seats in several classes.** Why: the brief says each shift is its own class and limits the student per class only.

## Identity and validation

- **`X-Student-Id` must be exactly 17 ASCII digits**; missing or invalid → 400. It is required on the four endpoints where the brief lists it.
- **`GET /holds/{holdId}` needs no header and does not return `studentId`.** Why: the brief lists no header there, so anyone with the hold ID can read it. Without an ownership check, the response must not reveal whose hold it is.
- **IDs are random UUIDs.** Why: they cannot be guessed or enumerated, which matters because the hold ID is the only thing protecting `GET /holds/{holdId}`.
- **Class name:** required, trimmed, 1–100 characters, unique ignoring case (duplicate → 409). **`totalSeats`:** an integer from 1 to 10000. Classes cannot be edited or deleted. Why: changing seat counts after holds exist raises questions (what happens to holds above the new limit?) that the brief does not ask.

## API details

- Errors are RFC 7807 ProblemDetails with an extra `code` field (for example `SEATS_FULL`, `HOLD_EXPIRED`), so the UI can show the right message without parsing text.
- A student who already has an active application in a full class gets `ACTIVE_HOLD_EXISTS`, not `SEATS_FULL`. Why: it is the more useful answer.
- `GET /classes` is ordered by name. `GET /me/holds` returns every hold in every status, newest first.
- Extra response fields (allowed by the brief) on hold responses: `className`, `createdAt`, `serverTime`, and `remainingMs`. `remainingMs` is the exact time left on the database clock; the UI counts down from it, so the countdown is right even when the device clock is wrong.
- `HOLD_DURATION_SECONDS` must be a positive integer. An invalid value stops the backend at startup instead of silently using a default.
- CORS origins come from `CORS_ORIGINS` (default `http://localhost:3000`).

## Security: what is missing on purpose

There is **no authentication anywhere**, admin included. The brief says no login, and the brief's automated tests call the API with no credentials.

The consequence: anyone can create a class, and anyone who knows a child's birth registration number can apply, pay, or cancel as that child. For the same reason there is no applicant-list page or endpoint: it would publish children's registration numbers to anyone.

What a real deployment would add:

- Parent login by phone OTP; the student ID is tied to the account, not typed into a header.
- An Admin role with real authentication, enforced on the API, for creating classes and viewing applicants.
- Rate limiting per account and per IP on the apply endpoint.
- An audit log of every hold, confirm and cancel.
- Verification of the birth registration number against the national registry.
- A real payment gateway, with the confirm driven by the gateway's callback.

## Operations

- The schema is plain SQL in `backend/db/init/`, run by PostgreSQL on first start ([ADR 0003](docs/adrs/0003-database-first-sql-schema-applied-by-postgres-init.md)). Why: two backends starting together must not race to create tables.
- Data lives in the named Docker volume `pgdata`. `docker compose down` keeps it; `docker compose down -v` deletes it.
- The database has no host port by default. Why: nothing outside Docker needs it.
- The database password in `docker-compose.yml` is a local demo value, not a secret.

## Known limits

Things I chose not to build for this assignment, and what I would do next.

- **A rush on one class queues on the database.** Each apply waiting for a class's row lock holds a database connection. With many thousands of simultaneous applies on a single class, the connection pool (100 per backend) fills and other requests wait behind them. Nothing is overbooked and nothing is lost; requests are slower, and one that cannot get a connection in time gets a 503 with `Retry-After`. Next steps, all inside the same design: limit concurrent applies per backend below the pool size, reject applies to a full class before taking the lock, and cache the class list for about a second.
- **No rate limiting and no paging.** Part of the missing-authentication trade-off above: anyone can create classes or applications in a loop, and the lists return everything.
- **Request bodies are capped at 64 KB**, which is far more than a class name and a seat count need.
- **A hold shown as `HELD` can be refused as expired.** The UI flips to `EXPIRED` at the moment the hold ends, but a click in the last instant can still reach the server too late. The server decides, and the UI then shows "this application has expired".
