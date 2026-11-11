# Assumptions

## How two backends never overbook (bonus)

Each apply runs in one database transaction:

1. Lock the class row (`SELECT … FOR UPDATE`). Any other apply for this class, from any backend, waits here.
2. Count the active holds (`HELD` + `CONFIRMED`).
3. If the class is full, return 409. Otherwise save the hold.

The lock lives in PostgreSQL, which both backends share, so two requests can never take the last seat. Expiry always uses the database clock, so the backends never disagree about time. This is tested with 200 parallel applies and with two backends on one database. To see it live: `docker compose --profile scale up` (second backend on port 8081).

## Assumptions

1. **Expired seats come back on their own**: a hold past its time is never counted, so its seat is free at once. A background job also marks it `EXPIRED`. Why: correctness must not depend on a background job.
2. **Seat counts are calculated, not stored**: they are counted from the hold rows. Why: a stored counter can drift.
3. **Confirming twice is fine**: a second confirm returns 200 and changes nothing. Why: double-clicks and retries must count once.
4. **Only `HELD` holds can be cancelled**: cancelling a confirmed seat returns 409. Why: it is paid for, and the brief has no refund rule.
5. **Re-applying is allowed**: after a hold expires or is cancelled, the student can apply again. Why: one missed payment should not lock a child out.
6. **Each shift is a separate class**: a student may hold seats in several classes. Why: the brief limits one active hold per class only.
7. **Student ID is exactly 17 digits**: anything else returns 400. The header is required only where the brief lists it.
8. **`GET /holds/{holdId}` needs no header**: so it does not return `studentId`, and IDs are random UUIDs. Why: anyone with the ID can read it, so it must not reveal whose hold it is.
9. **Class rules**: name 1–100 characters and unique (ignoring case); seats 1–10,000; classes cannot be edited or deleted. Why: changing seats after holds exist raises questions the brief does not answer.
10. **Errors carry a `code`**: for example `SEATS_FULL` or `HOLD_EXPIRED`, so the UI can show the right message.
11. **Extra fields**: hold responses also return `serverTime` and `remainingMs` (exact time left), so the countdown is right even if the device clock is wrong. Timestamps are in whole seconds, like the brief's examples.
12. **A bad `HOLD_DURATION_SECONDS` stops the backend**: instead of silently using the default.
13. **The schema is plain SQL, run by PostgreSQL on first start**: so two backends never race to create tables. Data lives in the `pgdata` volume.

## Left out on purpose

1. **No login, admin included**: the brief says no login, and its automated tests send no credentials. So anyone can create a class, and anyone who knows a birth registration number can act as that student.
2. **No applicant list**: without login it would expose children's ID numbers.
3. **No payment gateway**: "Pay" is assumed to succeed.

In production I would add parent login (phone OTP), an admin role checked by the API, rate limiting, an audit log, ID verification and a real payment gateway.

## Known limits

1. **A huge rush on one class is slower**: waiting applies hold database connections. Nothing is overbooked; if no connection is free, the API returns 503 with `Retry-After`.
2. **No rate limiting or paging**.
3. **A last-second click can be refused**: the server decides, and the UI then shows "expired".
