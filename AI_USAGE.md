# AI Usage summary

## Tool and how I used it

**Tool:** Claude Code (Anthropic), used from VS Code with my own agent setup (kept out of this repo; `templates/` holds the document templates it used).

1. **Design first**: I took the key decisions myself (row lock for seats, lazy expiry with a sweeper, SQL-first schema). The AI wrote them up as the architecture doc, 3 ADRs and 10 stories.
2. **Code story by story**: the AI wrote the code and tests for one story at a time.
3. **I reviewed at three stops**: after the docs, after the backend, and after the frontend.
4. **Final AI review**: separate AI reviewers checked the code, security and performance before I finished.

## Where the AI was wrong and how I caught it

1. **`.gitignore` hid the docs folder**: a `Docs/` rule also matched `docs/` on Windows, so design docs were silently left out of commits. Caught by Git's warning and `git ls-files`. Removed the rule.
2. **Code before tests**: the AI wrote backend code before most of its tests, so the tests might pass for the wrong reason. I broke the code on purpose (removed the row lock, removed the expiry check) and the tests failed as they should.
3. **A wrong sweeper test**: it expected 5 expired holds and got 0. The code was right; the test's order was wrong. Fixed the test.
4. **Countdown off by up to 2 seconds**: rounded timestamps made a 10-minute hold show "10:01". Caught by a frontend test. The API now sends `remainingMs`, the exact time left.
5. **Stale clock in the UI**: a just-expired hold briefly showed as `HELD`. Caught by a test. The screen now reads the clock at render time.
6. **A test that could not fail**: the "flips to EXPIRED" test passed even with the countdown logic removed. Found by breaking the code on purpose. Fixed the test so it fails when it should.
7. **Student ID cut to 17 digits**: an 18-digit typo would have become someone else's valid number. Caught in review before tests ran. The box now never shortens input.
8. **Noisy logs**: a normal duplicate-name 409 and a missing Kerberos library both looked like errors in the logs. Seen in the Docker logs. Fixed both.

## AI review before finishing

Three AI reviewers (code, security, performance) read the whole repo. None found a way to overbook a class, a contract mismatch, an injection or a data leak.

**Fixed:**

1. Old error messages stayed on a class card after they stopped being true.
2. Buttons stayed on "Applying…" while background refreshes ran.
3. A control character in a class name caused a 500 instead of a 400.
4. Request bodies had no size limit; now capped at 64 KB.
5. A database outage returned a generic 500; now 503 with `Retry-After`.
6. No gzip on the frontend; queries were re-planned on every call.

**Left on purpose:** rate limiting, a stricter `Content-Type` check and a few hardening steps. They suit production, but could break the brief's automated tests or change the core logic late. Written up in `ASSUMPTIONS.md`.
