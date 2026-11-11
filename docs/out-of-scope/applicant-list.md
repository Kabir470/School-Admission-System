# Out of scope: applicant list (endpoint or page)

**Date:** 2026-11-10
**Raised in:** design review of the admin screens

An admin view listing who applied to a class (student IDs, statuses) was rejected.

**Reason:** the API has no authentication, by requirement. A list of birth registration numbers behind an open endpoint would publish personal data to anyone who can reach the server. The spec asks only for seat counts per class, which the class list already shows.

**What would reopen it:** real admin authentication enforced on the API (see `admin-auth.md`). The list would then sit behind the Admin role.
