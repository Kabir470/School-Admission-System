# Project Summary & taken actions report

## Summary:

The assignment asked to fulfil a specific target which is something like- "**limited stock with many buyers at the same moment**.". Like the online train ticket booking system of BD. so in this project thousands of guardian will apply for the seats at the same time, and I need to handle the case. So authentication, payments, admin login etc are not implemented in this project. I built a private school admits students online, first come first served, with no lottery. Each class+shift (for example Class 6 – Morning Shift, 120 seats) is its own class with a fixed seat counts. Applying puts a seat on hold for a limited time, paying the fee in time confirms it.. Otherwise the seat goes back to the pool. Used database (server side validation) level lock, not only backend/frontend lock..

## How I worked:

1. I built business logic, system design, and modeled the data. Wrote the PRD docs with AI assistance for faster progress.
2. Then I did a feasibility analysis. As this project is small so the feasibility analysis was not included in the report.
3. Designed the architecture. Chose Clean Architecture and wrote the architecture doc and 3 ADRs, with AI help.
4. Built the backend REST api endpoint firsts, then implement the full backend. Built it story by story, with tests (including concurrency tests).
5. Then i designed the frontend, and implemented all the modules and connected the frontend api calling with the backend api from the SchoolAdmission.API.
6. Docker setup. One-command compose, a runtime API URL, test profiles, and the two-backend scale profile.
7. Then I tested (parallel requests) with 200 request at the same time and tested the request header/response. And monitored the traffic. **Tests written with the code.** 104 backend tests, including the concurrency tests, and 116 frontend tests.

## What was demanded in this assignment:

1. **Concurrency**: this means thousands of parents and guardians click apply at the same time. So in this case, the seats must never be overbooked or oversold. For every class, held seats plus confirmed seats must never go above the total seats, however many requests arrive together.

   **Solution / steps taken:**

   - Each Apply locks the class in the database, counts the seats, then saves the hold or answers "full". Requests for the same class take turns, so two can't grab the last seat.

2. **Two backend processes on one database (bonus)**: Two backend processes on different ports, sharing one database, must still never exceed the total seats.

   **Solution / steps taken:**

   - The lock in postgresql, so both backend wait on the same lock. A scal profile docker starts second backend to show it.

3. **Holds expire on their own:** A hold lasts `HOLD_DURATION_SECONDS` (default 600). When it runs out, the seat must return automatically, with no one calling any API.

   **Solution / steps taken:**

   - A hold whose time has passed is never counted, so its seat is free at once.
   - A background job also marks such holds `EXPIRED` every few seconds.

4. **One active application per student per class:** A student may not have more than one active hold or confirmed seat in the same class at the same time.

   **Solution / steps taken:**

   - A database rule allows only one active hold per student per class, aa second one get 409.

5. **Only your own, unexpired hold can be confirmed:** Paying the fee may confirm only the student's own hold, and only while it is still `HELD` and not expired.

   **Solution / steps taken:**

   - Confirm only works if the hold is the student's own, still `HELD` and not expired. Otherwise the API returns a clear error (403, 404 or 409).

6. **Confirming twice counts once**: If the same hold is confirmed several times (double-click, retry), `confirmedSeats` must rise only once.

   **Solution / steps taken:**

   - Confirming an already confirmed hold just returns "confirmed" again and changes nothing.

7. **Follow the API contract exactly:** 8 endpoints with fixed paths, field names and status codes, because the recruiters run automated tests directly against the API. Extra fields are allowed, no listed field may be removed or renamed. The student is identified by the X-Student-Id header (17-digit birth registration number).

   **Solution / steps taken:**

   - All 8 endpoints use the exact paths, field names and status codes from the brief. Only a few harmless fields were added, and every error has a clear `code`.

8. **No data lost on restart**: Data must survive an app restart, including `docker compose down` followed by `docker compose up`.

   **Solution / steps taken:**

   - The database keeps its data in a Docker volume, so `down` and `up` keep everything. Only `down -v` deletes it.

9. **One command runs everything**: `docker compose up` alone must start PostgreSQL, the backend and the frontend. The graders install nothing except Docker.

   **Solution / steps taken:**

   - Docker Compose starts the database, backend (port 8080) and frontend (port 3000). The database creates its tables by itself on first start.

10. **Settings come from environment variables**: The database connection and the frontend's backend URL must both be changeable through environment variables.

    **Solution / steps taken:**

    - The backend reads its database connection and hold time from environment variables.
    - The frontend reads `API_URL` when its container starts, so the URL can change without a rebuild.

11. **Everything is done from the UI**: The school admin and parents do everything from a React UI, with no login. A box at the top takes the student's 17-digit birth registration number. Four screens: create class, class list, application, and my applications.

    **Solution / steps taken:**

    - A React app has all four screens, with the birth registration box at the top. It also has a home page and an English / Bangla switch.

12. **Expired holds show EXPIRED without a reload**: When a hold runs out, the UI must show `EXPIRED` and disable the Pay button without reloading the page.

    **Solution / steps taken:**

    - A countdown uses the exact time left sent by the server. At zero, the screen shows `EXPIRED` and disables Pay by itself.

13. **Seat counts update live**: Each class's seat counts must refresh every few seconds without reloading the page.

    **Solution / steps taken:**

    - The class list reloads its seat counts every 3 seconds in the background.

14. **Applications are still there after a refresh**: After refreshing, or closing and reopening the browser, the student must still see their active applications.

    **Solution / steps taken:**

    - The birth registration number is saved in the browser, and the app loads that student's applications on every visit.

15. **Errors in plain words, never a blank page**: Every error (seats full, hold expired, wrong input, server down) must be shown in words the user understands.

    **Solution / steps taken:**

    - Every error code and network failure is turned into a simple message. If one part of the page breaks, the rest keeps working.

16. **Backend tests, including a concurrency test**: At least 3 automated backend tests, one of them a concurrency test that sends many requests at once and shows seats are never over-held.

    **Solution / steps taken:**

    - 104 backend tests run on a real database. The main one sends 200 applies at once for 10 seats: exactly 10 succeed. Another runs two backends on one database.

17. **Frontend tests (bonus)**: Automated tests for the frontend.

    **Solution / steps taken:**

    - 116 frontend tests check the countdown, live seat counts, saved applications and error messages.
