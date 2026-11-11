# Out of scope: authentication and roles (admin or parent)

**Date:** 2026-11-10
**Raised in:** architecture, § Security

Login, an Admin role, or any credential check on `POST /classes` was rejected.

**Reason:** the spec says there is no login and that the student's identity is the `X-Student-Id` header. The graders run automated tests straight against the API with no credentials; any auth on `POST /classes` would fail them.

**Accepted trade-off:** anyone can create a class, and anyone who knows a student's number can act as that student. This is documented in `ASSUMPTIONS.md` together with the production design (parent OTP login, Admin role enforced on the API, rate limiting, audit log, registry verification).

**What would reopen it:** a spec that permits credentials on the API.
