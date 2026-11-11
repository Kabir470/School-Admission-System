# Story 010: Frontend tests, frontend image, full compose, and submission docs

**Status:** Done
**PRD:** none (spec restated in the architecture doc)
**Architecture:** [school-admission-system.md](../architecture/school-admission-system.md) § Deployment topology
**Estimate:** 3 hours
**Depends on:** 009

## Goal

One `docker compose up` starts all three services; the frontend's API URL is set at container start; both test suites run in Docker; the second-backend demo works; and the README, ASSUMPTIONS and AI_USAGE files are complete.

## Architectural context

- **Frontend image:** multi-stage. Stage `build`: `node` runs `npm ci` and `vite build`. Stage `test`: the same dependencies, runs `vitest run`. Final stage: `nginx` serving `dist/`.
- **Runtime config** (`[OPS-03]`): the official nginx image runs every script in `/docker-entrypoint.d/` before nginx starts. A script there writes `/usr/share/nginx/html/config.js` from `API_URL`:

```js
window.__APP_CONFIG__ = { apiUrl: "http://localhost:8080" };
```

  Changing `API_URL` and restarting the container changes where the app calls. No rebuild.
- nginx: `try_files $uri /index.html` for client-side routes; `Cache-Control: no-store` on `/config.js` and `/index.html`; hashed assets cached.
- **Compose, complete:**
  - `frontend`: `3000:80`, `API_URL=http://localhost:8080`.
  - `backend-2` (profile `scale`): same image as `backend`, `8081:8080`, same database. `CORS_ORIGINS` allows the frontend origin on both.
  - `frontend-tests` (profile `test`): runs the Vitest suite.
- **Frontend tests** (`[BONUS-02]`): Vitest + React Testing Library + MSW.

## Affected files

- `frontend/Dockerfile`, `frontend/.dockerignore`, `frontend/nginx.conf`, `frontend/docker/40-write-config.sh` — add.
- `frontend/src/features/holds/ApplicationPage.test.tsx`, `features/classes/ClassListPage.test.tsx`, `features/holds/MyApplicationsPage.test.tsx` — add.
- `docker-compose.yml` — modify: `frontend`, `backend-2`, `frontend-tests`.
- `README.md`, `ASSUMPTIONS.md`, `AI_USAGE.md`, `.env.example` — add / complete.

## Acceptance criteria

- [x] `[OPS-01]` WHEN `docker compose up --build` runs from a fresh clone on a machine with only Docker THEN PostgreSQL, backend and frontend SHALL all start, and `http://localhost:3000` SHALL show the app talking to `http://localhost:8080`.
- [x] `[OPS-03]` WHEN the frontend container is started with a different `API_URL` and no rebuild THEN `/config.js` SHALL contain that URL and the app SHALL call it.
- [x] `[UI-01]` WHEN a client-side route such as `/applications` is opened directly or refreshed THEN nginx SHALL serve the app, not a 404.
- [x] `[UI-02]` (test) WHEN the countdown reaches zero under fake timers THEN the application screen SHALL show `EXPIRED` and "Pay admission fee" SHALL be disabled, with no reload.
- [x] `[UI-05]` (test) WHEN the API returns each error code, or the network fails THEN the screen SHALL show the mapped message and SHALL NOT be blank.
- [x] `[UI-04]` (test) WHEN a student ID is in `localStorage` at mount THEN "My applications" SHALL load and list that student's holds.
- [x] `[BONUS-02]` WHEN `docker compose --profile test run --rm frontend-tests` runs THEN the frontend suite SHALL pass with no test skipped.
- [x] `[BONUS-01]` WHEN `docker compose --profile scale up --build` runs THEN a second backend SHALL answer on `http://localhost:8081` against the same database, and a class created through one SHALL be visible through the other.
- [x] `[BE-06]` WHEN `docker compose down` then `docker compose up` runs THEN classes and holds created before SHALL still be there.
- [x] WHEN the repository is inspected THEN it SHALL contain `README.md` (run with Docker, the frontend URL, how to run the tests), `ASSUMPTIONS.md`, `AI_USAGE.md`; and SHALL NOT contain the assignment PDF, `.claude/settings.local.json`, or secrets.

## Test plan

- **Frontend, automated:** the three (test) criteria above, plus: the class list renders counts from the API and re-renders after a refetch; "Apply" with a full class shows the `SEATS_FULL` message inline; a failed poll keeps the last data and shows the banner.
- **Edge cases:** countdown with a client clock five minutes wrong still reaches zero at the server's expiry (skew correction); a hold already `CONFIRMED` shows no countdown.
- **Manual, end to end (Definition of Done):** fresh clone in a new folder → `up --build`; walk all four screens; expiry with a short `HOLD_DURATION_SECONDS`; `down` / `up` keeps data; stop the backend and check every screen; run both test profiles; run the `scale` profile; start the frontend image with another `API_URL` and read `/config.js`.
- **Review:** `/review` (code, security, performance in parallel); grep for `# scope:` markers and resolve or document each.

## Out of scope

Deployment anywhere but local Docker. CI.

## Notes for implementer

- The entrypoint script must be LF and executable in the image (`COPY --chmod=755`); `.gitattributes` forces LF so a Windows clone still works.
- Escape `API_URL` when writing it into JavaScript (write it as a JSON string), so a stray quote cannot break the file.
- With fake timers, MSW and TanStack Query need care: advance timers with `vi.advanceTimersByTimeAsync` and let promises settle; do not mix real `waitFor` polling with frozen time carelessly.
- README stays short: prerequisites (Docker), one command, URLs, test commands, the `scale` demo, the persistence check, where the design docs are.
