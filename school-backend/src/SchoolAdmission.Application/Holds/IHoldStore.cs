namespace SchoolAdmission.Application.Holds;

public enum CreateHoldOutcome
{
    Created,
    ClassNotFound,
    ActiveHoldExists,
    SeatsFull,
}

public sealed record CreateHoldResult(CreateHoldOutcome Outcome, HoldView? Hold = null);

public interface IHoldStore
{
    /// <summary>
    /// Takes a seat, or says why not. The whole decision is made inside the database,
    /// under a lock on the class row (ADR 0001).
    /// </summary>
    Task<CreateHoldResult> CreateAsync(Guid classId, string studentId, int holdSeconds, CancellationToken ct);

    Task<HoldView?> GetAsync(Guid holdId, CancellationToken ct);

    /// <summary>Every hold of the student, in every status, newest first.</summary>
    Task<IReadOnlyList<HoldView>> ListForStudentAsync(string studentId, CancellationToken ct);

    /// <summary>HELD → CONFIRMED, only for the owner's unexpired hold. Returns whether a row changed.</summary>
    Task<bool> TryConfirmAsync(Guid holdId, string studentId, CancellationToken ct);

    /// <summary>HELD → CANCELLED, only for the owner's unexpired hold. Returns whether a row changed.</summary>
    Task<bool> TryCancelAsync(Guid holdId, string studentId, CancellationToken ct);
}
