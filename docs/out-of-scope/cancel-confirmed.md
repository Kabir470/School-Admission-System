# Out of scope: cancelling a confirmed admission

**Date:** 2026-11-10
**Raised in:** the cancel flow

`DELETE /holds/{holdId}` on a `CONFIRMED` hold answers 409 `HOLD_ALREADY_CONFIRMED`; it does not release the seat.

**Reason:** a confirmed admission has been paid for. Undoing it is a refund, which needs a policy (who approves, how much, by when) that the spec does not give. Letting the same button silently free a paid seat would be a destructive default.

**What would reopen it:** a stated refund policy. It would be a separate, admin-approved action, not the cancel endpoint.
