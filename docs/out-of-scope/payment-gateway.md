# Out of scope: a real payment gateway

**Date:** 2026-11-10
**Raised in:** the confirm flow

Integrating a payment provider (redirect, callback, reconciliation) was rejected.

**Reason:** the spec states that pressing "Pay admission fee" means the payment succeeded. `POST /holds/{holdId}/confirm` is the whole payment step.

**What would reopen it:** a requirement to collect money. The design would then need a `PAYMENT_PENDING` step, a webhook, and a rule for a payment that lands after the hold expired.
