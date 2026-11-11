# AI usage

**Tool:** Claude Code (Anthropic), driven from VS Code with my own agent scaffold (`CLAUDE.md`, `.claude/`, `templates/`).

**How it was used:** I fixed the design up front (the three ADRs in `docs/adrs/` are my decisions, taken from patterns I already use in another project), then had the AI write the architecture doc, the stories, and the code story by story, test first. I reviewed at three gates: after the docs, after the backend, after the frontend.

## Where the AI was wrong, and how it was caught

Logged as the work happened, newest last.

| # | Where | What was wrong | How it was caught | Fix |
|---|---|---|---|---|
| 1 | `.gitignore` | The AI added a `Docs/` rule to keep the assignment brief's folder out of the repo. Git on Windows matches ignore rules case-insensitively, so the rule also ignored `docs/`, and four commits of design docs were silently skipped. | The commit step printed "paths are ignored by one of your .gitignore files", and `git ls-files` showed no `docs/` files. | Removed the rule. The brief lives outside the repo, and `*.pdf` stays ignored as a second guard. |
| 2 | `ExpiryTests` (sweeper test) | The AI's test seeded five overdue holds, then created three more holds through the API, then expected the sweeper to expire five. The sweep expired zero. | The test failed on its first run (`should be 5 but was 0`). | The test was wrong, not the code: applying to a class already expires that class's overdue holds inside the hold transaction (ADR 0001, step 2), so nothing was left for the sweeper. Reordered the test to seed the overdue holds last, and noted why in a comment. |
| 3 | Backend, order of work | The plan was test-first. The AI wrote the backend's production code before most of its tests. Tests written afterwards can pass for the wrong reason. | Noticed when every test passed on the first full run. | Broke the code on purpose three times and reran: removing `FOR UPDATE` failed 3 of 4 concurrency tests; removing `expires_at > now()` from the seat count failed the expiry test; removing it from the confirm `UPDATE` failed the expiry test. Each change was reverted. The tests do detect the bugs they exist for. |
| 4 | Backend logging | Creating a class with a duplicate name correctly returned 409, but EF Core logged a full `DbUpdateException` stack trace as an error each time, as if something had broken. | Reading the output of the test run inside Docker. | Raised the log level of the two EF categories involved (`appsettings.json`). Real database failures still throw and are logged by the exception handler. |
| 5 | Backend image | The container log showed `Cannot load library libgssapi_krb5.so.2`. Harmless (Npgsql probing for Kerberos), but it reads like a failure. | Reading `docker compose logs backend` after the first run. | Installed `libgssapi-krb5-2` in the runtime image. |
| 6 | Countdown design (frontend + API) | The AI's own design from the docs phase: send timestamps in whole seconds, `expiresAt` rounded up and `serverTime` rounded down, and have the UI subtract one from the other. That overstates the time left by up to two seconds, so a fresh ten-minute hold could read "10:01". | A frontend test expected "5:00 left" and got "5:01 left". | The API now also returns `remainingMs`, the exact time left on the database clock. The UI adds it to its own clock when the answer arrives and counts down from there. In the real browser a 25-second hold now starts at exactly 0:25. |
| 7 | `useNow` hook (frontend) | The hook stored the clock once a second and screens rendered from that stored value. When data arrived between two ticks, "time left" was computed against a clock up to a second old: a hold that had just expired showed as HELD for a moment. | A frontend test for an already expired hold got `HELD` instead of `EXPIRED`. | The hook now only triggers the once-a-second re-render; the time is read from the clock at render. |
| 8 | Countdown screen test (frontend) | The AI's test "flips to EXPIRED when the countdown reaches zero" also passed with the countdown logic removed. The fake server answered `EXPIRED` on the screen's 5-second poll, and the test hold lasted exactly 5 seconds, so the poll rescued it. | Deliberately breaking `effectiveStatus` and rerunning: unit tests failed, this screen test did not. | The test hold now lasts 3 seconds, shorter than the poll, so only the countdown can flip the status. Broke the code again: the test now fails as it should. |
| 9 | UI redesign (frontend) | Building my canvas design, the AI first capped the birth registration box at 17 digits as it stripped non-digits. An 18-digit typo would then have been silently cut to a valid-looking but wrong number, and every application filed under someone else. Separately, it keyed the page error boundary by the full URL, which would have remounted the admission page on every tab switch and wiped the "seat held" message. | Its own review of the change, before the tests ran. | The box strips separators but never shortens; the boundary is keyed per section, with one per tab inside the page. A test pins the first. |

## Design points the AI raised before any code was written

My first design notes had these gaps. The AI pointed them out during the docs phase, and the fixes are in the ADRs.

- **`now()` inside the hold transaction.** `now()` is frozen at transaction start, so a request that waits in the lock queue would decide expiry with a stale time. The hold transaction reads `clock_timestamp()` after the lock is granted (ADR 0001).
- **`pg_isready` as the database health check.** With no host it uses the unix socket, which Postgres already answers while the init scripts are still running, so the backend could start before the schema exists. The check uses TCP (`-h 127.0.0.1`).
- **Connection limits.** Requests waiting on a class lock each hold a connection; 200 at once would exceed the Postgres default of 100. The pool is capped per backend and `max_connections` is raised.
- **Fractional seconds in timestamps.** .NET writes seven decimal places by default; the brief's examples have none. Timestamps are sent in whole seconds, with `expiresAt` rounded up so a reported expiry is never earlier than the real one.

## Review by three AI reviewers (code, security, performance)

Before finishing I had three separate AI reviewers read the whole repository, each with one job. None found a way to overbook a class, a contract mismatch, an injection, or a data leak. What they did find, and what I did:

| Found by | Finding | Decision |
|---|---|---|
| Code | An apply error stayed on a class card after it stopped being true: after a seat freed up, and even after switching to another student. | Fixed, with two tests. |
| Code + performance | Buttons stayed on "Applying…" / "Paying…" until two background refreshes finished, so a parent with a seat already held waited to see it. | Fixed: the refreshes are no longer awaited. |
| Code | `EXPIRED` could appear up to a second late, because the screen only re-rendered on a one-second tick. | Fixed: it also re-renders at the exact expiry moment. |
| Code + security | A class name containing a control character (for example NUL) caused a 500 instead of a 400. | Fixed, with tests. |
| Security | `POST /classes` accepted bodies up to about 28 MB. | Fixed: 64 KB cap. |
| Security | A newline in `API_URL` would have broken `/config.js`. | Fixed: line endings are stripped. |
| Performance | A database that cannot be reached, or a connection-pool timeout during a rush, answered with a generic 500. | Fixed: 503 `SERVICE_UNAVAILABLE` with `Retry-After`, with a test. |
| Performance | nginx served the bundle uncompressed; statements were re-planned on every call. | Fixed: gzip on; `Max Auto Prepare` in the connection string. |
| Performance | Under a very large rush on one class, waiting applies can fill the connection pool. Suggested a response cache, a check before the lock, and a concurrency limiter. | Not done. A cache could show the automated tests stale counts, and the other two change the hold path late in the work. Written up under "Known limits" in `ASSUMPTIONS.md`. |
| Security | No rate limiting; nginx runs as root; the app connects as the database superuser; ports listen on all interfaces; no Content-Security-Policy. | Not done. Reasonable for a production deployment, out of proportion here. |
| Security | Enforcing `Content-Type: application/json` on `POST /classes`. | Not done on purpose: a strict check could reject a valid request from the brief's automated tests. |
