# Story 009: Frontend screens (class list, create class, application with countdown, my applications)

**Status:** Done
**PRD:** none (spec restated in the architecture doc)
**Architecture:** [school-admission-system.md](../architecture/school-admission-system.md) § Data flow → Frontend
**Estimate:** 3.5 hours
**Depends on:** 008

## Goal

The four screens work end to end against the real API: an admin creates a class; a parent sees live seat counts, applies, watches the countdown, pays or cancels, and finds their applications again later.

## Architectural context

Routes and screens:

| Route | Screen | Calls |
|---|---|---|
| `/` | **Class list.** Per class: total, held, confirmed, available; "Apply" button. | `GET /classes` every 3 s; `POST /classes/{id}/holds` |
| `/admin` | **Create class (school admin).** Name + seat count form. | `POST /classes` |
| `/applications` | **My applications.** Every hold of this student with its status. | `GET /me/holds` every 5 s and on window focus |
| `/applications/:holdId` | **Application.** Status, time left, "Pay admission fee", "Cancel". | `GET /holds/{id}`; `POST …/confirm`; `DELETE /holds/{id}` |

- **Live counts** (`[UI-03]`): TanStack Query `refetchInterval: 3000` on the class list.
- **Countdown** (`[UI-02]`): hold responses carry `remainingMs`, the exact time left on the server clock. When a response arrives the client stores `expiresAtDevice = Date.now() + remainingMs`. Every second: `remaining = expiresAtDevice − Date.now()`. (First design: a skew from `serverTime`; replaced because the whole-second timestamps overstated the time left by up to two seconds.) When `remaining <= 0` and the server status is `HELD`, the screen shows `EXPIRED` at once, disables "Pay admission fee" and "Cancel", and refetches the hold. No reload.
- The server reports `expiresAt` rounded up to a whole second, so when the countdown reaches zero the server already agrees the hold is expired.
- **Persistence** (`[UI-04]`): the student ID is in `localStorage` (story 008). With an ID present, "My applications" loads from the server, so applications survive a refresh or a browser restart. Active (`HELD`) applications are listed first with their countdown and a link to the application screen.
- **Errors** (`[UI-05]`): every query and mutation failure is rendered inline through the story 008 mapper. If a poll fails, the last good data stays on screen with a "cannot reach the server" banner. Loading and empty states on every screen.
- **No double submits:** buttons are disabled while their request is in flight, and show the result (success or the error) inline.
- Applying requires a student ID. Without one, "Apply" is disabled with a hint pointing to the box.
- "Pay admission fee" simply calls confirm; there is no payment gateway.

## Affected files

- `frontend/src/features/classes/{api.ts,types.ts,ClassListPage.tsx,CreateClassPage.tsx,hooks.ts}` — add.
- `frontend/src/features/holds/{api.ts,types.ts,ApplicationPage.tsx,MyApplicationsPage.tsx,useCountdown.ts,effectiveStatus.ts,StatusBadge.tsx}` — add.
- `frontend/src/App.tsx` — modify: routes, nav.
- `frontend/src/styles.css` — modify.

## Acceptance criteria

- [x] `[UI-01]` WHEN an admin submits a valid name and seat count THEN the class SHALL be created, a success message SHALL appear, and the class SHALL be in the class list.
- [x] `[UI-05]` WHEN the name is empty, the seat count is out of range, or the name is taken THEN the form SHALL show the reason and SHALL keep what was typed.
- [x] `[UI-03]` WHEN seat counts change on the server THEN the class list SHALL show the new numbers within a few seconds, with no reload.
- [x] `[UI-01]` WHEN a parent with a valid student ID presses "Apply" on a class with seats THEN a hold SHALL be created and the application screen SHALL open for it.
- [x] `[UI-05]` WHEN the class is full, or the student already has an application there THEN the class list SHALL show that message next to the class, and SHALL stay usable.
- [x] `[UI-01]` WHEN no student ID is set THEN "Apply" SHALL be disabled and a hint SHALL say to enter the birth registration number.
- [x] `[UI-02]` WHEN a live hold is open on the application screen THEN it SHALL show the status and the time left, updating every second.
- [x] `[UI-02]` WHEN the time left reaches zero THEN the screen SHALL show `EXPIRED` and SHALL disable "Pay admission fee", with no reload.
- [x] `[UI-01]` WHEN "Pay admission fee" is pressed on a live hold THEN the status SHALL become `CONFIRMED` and both buttons SHALL be disabled.
- [x] `[UI-01]` WHEN "Cancel" is pressed and confirmed THEN the status SHALL become `CANCELLED`.
- [x] `[UI-04]` WHEN the page is refreshed, or the browser is closed and reopened THEN "My applications" SHALL list the student's applications, with active ones shown first.
- [x] `[UI-05]` WHEN the backend is stopped THEN every screen SHALL show a readable "cannot reach the server" message; no screen SHALL be blank.
- [x] `[UI-01]` WHEN a request is in flight THEN its button SHALL be disabled.

## Test plan

Automated tests for this story are written in story 010 (they need the screens to exist): countdown to zero, the list flow, and the error states. In this story:

- **Manual walkthrough against the real backend** (recorded at Gate C): create a class with 2 seats; apply as three students in three tabs (third gets "full"); watch counts change in another tab; pay one; cancel one; set `HOLD_DURATION_SECONDS=20`, let one expire and watch it flip; refresh; reopen the browser; stop the backend and visit every screen.
- **Type check and lint:** `tsc --noEmit` clean.

## Out of scope

Styling beyond clean and readable. Applicant lists (`docs/out-of-scope/applicant-list.md`). Authentication.

## Notes for implementer

- Derive the displayed status in one function, `effectiveStatus(hold, remainingMs)`, used by both the application screen and the list, so they cannot disagree.
- After a successful confirm or cancel, write the result into the query cache and invalidate `/me/holds` and `/classes`, so every screen updates without waiting for the next poll.
- The interval must be cleared on unmount, and the countdown must not keep refetching forever once the hold is in a final state.
- The hold screen works from the hold id alone (the API needs no header there), so a shared or bookmarked link still opens. Pay and Cancel need the student ID and show a hint without it.
