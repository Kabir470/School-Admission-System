# Story 008: Frontend foundation (runtime config, apiClient, error mapper, student-ID box)

**Status:** Done
**PRD:** none (spec restated in the architecture doc)
**Architecture:** [school-admission-system.md](../architecture/school-admission-system.md) § Components (frontend), § Cross-cutting concerns
**Estimate:** 2 hours
**Depends on:** 007

## Goal

A Vite + React + TypeScript app that knows where the API is at runtime, talks to it through one client that turns every failure into a readable message, and remembers the student's ID.

## Architectural context

- Layout: `frontend/src/features/{classes,holds,student}/` and `frontend/src/shared/{api,ui,lib}/`.
- **Runtime API URL** (`[OPS-03]`): `index.html` loads `/config.js` before the bundle. That file sets `window.__APP_CONFIG__ = { apiUrl: "…" }`. In the container it is written at start from the `API_URL` environment variable (story 010). The app reads `window.__APP_CONFIG__.apiUrl`, falling back to `import.meta.env.VITE_API_URL`, then `http://localhost:8080`. The URL must never be baked into the bundle as the only source.
- **One `apiClient`**: adds `X-Student-Id` when a student ID is set, sends and parses JSON, and throws a typed `ApiError { code, status, message }` on any failure.
  - A ProblemDetails body → `code` from the body.
  - `fetch` rejecting (server down, CORS, offline) → `code: "NETWORK_ERROR"`.
  - A 5xx, or a body that is not ProblemDetails → `code: "SERVER_ERROR"`.
- **Error mapper**: `code` → a message a parent understands, in English with a Bangla line. Unknown codes fall back to a generic message; the mapper never returns an empty string. Codes: `SEATS_FULL`, `ACTIVE_HOLD_EXISTS`, `HOLD_EXPIRED`, `HOLD_CANCELLED`, `HOLD_ALREADY_CONFIRMED`, `NOT_YOUR_HOLD`, `INVALID_STUDENT_ID`, `VALIDATION_FAILED`, `CLASS_NOT_FOUND`, `HOLD_NOT_FOUND`, `CLASS_NAME_TAKEN`, `NETWORK_ERROR`, `SERVER_ERROR`.
- **Student identity** (`[UI-06]`, `[UI-04]`): a box at the top of every page takes the 17-digit birth registration number. It accepts only exactly 17 digits, shows why otherwise, and saves the value to `localStorage` (wrapped in try/catch: storage can be blocked). On load the saved value is restored. A "change" action clears it.
- TanStack Query for all server state. A root error boundary so a render error shows a message, not a blank page.

## Affected files

- `frontend/package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`, `public/config.js` — add: project.
- `frontend/src/shared/api/{config.ts,apiClient.ts,errors.ts}` — add.
- `frontend/src/shared/ui/{ErrorBoundary.tsx,ErrorMessage.tsx,Spinner.tsx}` — add.
- `frontend/src/features/student/{StudentIdBox.tsx,StudentContext.tsx,studentId.ts}` — add.
- `frontend/src/{main.tsx,App.tsx,styles.css}` — add: providers, layout shell, nav.
- `frontend/src/**/*.test.ts(x)`, `src/test/{setup.ts,server.ts}` — add: Vitest + RTL + MSW setup and the tests below.

## Acceptance criteria

- [x] `[OPS-03]` WHEN `window.__APP_CONFIG__.apiUrl` is set THEN every API call SHALL go to that URL, without a rebuild.
- [x] `[UI-05]` WHEN the API answers with ProblemDetails carrying any known `code` THEN the client SHALL throw an `ApiError` whose message is the mapped, human-readable text for that code.
- [x] `[UI-05]` WHEN the network request fails or the server answers 5xx THEN the message SHALL say the server cannot be reached and to try again.
- [x] `[UI-05]` WHEN the `code` is unknown THEN a generic, non-empty message SHALL be shown.
- [x] `[UI-05]` WHEN a component throws while rendering THEN the error boundary SHALL show a message and a reload action, not a blank page.
- [x] `[UI-06]` WHEN the student types something that is not exactly 17 digits and submits THEN the box SHALL show a validation message and SHALL NOT set the identity.
- [x] `[UI-06]` WHEN a valid ID is submitted THEN it SHALL be shown as the current student and sent as `X-Student-Id` on later requests.
- [x] `[UI-04]` WHEN the page is reloaded (component remounted) THEN the saved student ID SHALL be restored from `localStorage`.
- [x] `[UI-04]` WHEN `localStorage` throws THEN the app SHALL still work for the current session.

## Test plan

- **Happy path:** `apiClient` GET/POST against MSW; header present when an ID is set, absent when not.
- **Error mapper (table-driven):** every code above → a non-empty message distinct from the generic one; unknown code → generic; `fetch` rejection → the unreachable message. WHY: `[UI-05]` forbids console-only errors.
- **Student-ID box:** 16 digits, 18 digits, letters → rejected with a message; 17 digits → accepted, written to `localStorage`; unmount and remount → restored; non-digit characters cannot make an ID valid.
- **Edge cases:** 204 response (no body) does not throw on parse; a non-JSON 502 body maps to the unreachable message; `localStorage.setItem` throwing does not crash.

## Out of scope

Screens (story 009). Dockerfile and nginx (story 010).

## Notes for implementer

- `public/config.js` in the repo is the dev default (empty config). The container overwrites it at start.
- Do not read `import.meta.env.VITE_API_URL` at module top level into a constant used everywhere before checking `window.__APP_CONFIG__`; resolve the URL in one function.
- Keep MSW handlers on the same base URL the config resolves to in tests.
