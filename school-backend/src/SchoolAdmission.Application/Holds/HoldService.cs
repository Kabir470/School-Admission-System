using SchoolAdmission.Domain;

namespace SchoolAdmission.Application.Holds;

public sealed class HoldService(IHoldStore store, AdmissionOptions options)
{
    public async Task<Result<HoldView>> CreateAsync(string classId, string studentId, CancellationToken ct)
    {
        if (!Guid.TryParse(classId, out var id))
        {
            return ClassNotFound();
        }

        var result = await store.CreateAsync(id, studentId, options.HoldDurationSeconds, ct);
        return result.Outcome switch
        {
            CreateHoldOutcome.Created => Result<HoldView>.Ok(result.Hold!),
            CreateHoldOutcome.ClassNotFound => ClassNotFound(),
            CreateHoldOutcome.ActiveHoldExists => Result<HoldView>.Fail(
                ErrorCodes.ActiveHoldExists,
                "This student already has an active application or a confirmed admission in this class."),
            CreateHoldOutcome.SeatsFull => Result<HoldView>.Fail(
                ErrorCodes.SeatsFull,
                "No seats are available in this class."),
            _ => throw new InvalidOperationException($"Unhandled outcome {result.Outcome}."),
        };
    }

    public async Task<Result<HoldView>> GetAsync(string holdId, CancellationToken ct)
    {
        var hold = Guid.TryParse(holdId, out var id) ? await store.GetAsync(id, ct) : null;
        return hold is null ? HoldNotFound() : Result<HoldView>.Ok(hold);
    }

    public Task<IReadOnlyList<HoldView>> ListForStudentAsync(string studentId, CancellationToken ct) =>
        store.ListForStudentAsync(studentId, ct);

    /// <summary>
    /// Pay the fee. The conditional UPDATE in the store is the decision; the read afterwards
    /// only explains the outcome. Repeating a confirm is a success that changes nothing.
    /// </summary>
    public async Task<Result<HoldView>> ConfirmAsync(string holdId, string studentId, CancellationToken ct)
    {
        if (!Guid.TryParse(holdId, out var id))
        {
            return HoldNotFound();
        }

        await store.TryConfirmAsync(id, studentId, ct);

        var hold = await store.GetAsync(id, ct);
        if (hold is null)
        {
            return HoldNotFound();
        }

        if (hold.StudentId != studentId)
        {
            return NotYourHold();
        }

        return hold.Status switch
        {
            HoldStatus.Confirmed => Result<HoldView>.Ok(hold),
            HoldStatus.Expired => Result<HoldView>.Fail(
                ErrorCodes.HoldExpired,
                "This application has expired, so it can no longer be paid for."),
            HoldStatus.Cancelled => Result<HoldView>.Fail(
                ErrorCodes.HoldCancelled,
                "This application was cancelled, so it can no longer be paid for."),
            _ => throw UnexpectedState(hold, "confirm"),
        };
    }

    /// <summary>Cancel a live hold. Cancelling an already cancelled hold is a success that changes nothing.</summary>
    public async Task<Result<HoldView>> CancelAsync(string holdId, string studentId, CancellationToken ct)
    {
        if (!Guid.TryParse(holdId, out var id))
        {
            return HoldNotFound();
        }

        await store.TryCancelAsync(id, studentId, ct);

        var hold = await store.GetAsync(id, ct);
        if (hold is null)
        {
            return HoldNotFound();
        }

        if (hold.StudentId != studentId)
        {
            return NotYourHold();
        }

        return hold.Status switch
        {
            HoldStatus.Cancelled => Result<HoldView>.Ok(hold),
            HoldStatus.Confirmed => Result<HoldView>.Fail(
                ErrorCodes.HoldAlreadyConfirmed,
                "This admission is already confirmed and cannot be cancelled here."),
            HoldStatus.Expired => Result<HoldView>.Fail(
                ErrorCodes.HoldExpired,
                "This application has already expired."),
            _ => throw UnexpectedState(hold, "cancel"),
        };
    }

    private static Result<HoldView> ClassNotFound() =>
        Result<HoldView>.Fail(ErrorCodes.ClassNotFound, "Class not found.");

    private static Result<HoldView> HoldNotFound() =>
        Result<HoldView>.Fail(ErrorCodes.HoldNotFound, "Application not found.");

    private static Result<HoldView> NotYourHold() =>
        Result<HoldView>.Fail(ErrorCodes.NotYourHold, "This application belongs to another student.");

    // The owner's hold is still live after a conditional UPDATE that should have changed it.
    // Statuses only move forward and so does the clock, so this cannot happen; if it does,
    // fail loudly rather than guess.
    private static InvalidOperationException UnexpectedState(HoldView hold, string action) =>
        new($"Hold {hold.HoldId} is still {hold.Status} after {action}.");
}
