namespace SchoolAdmission.Application.Holds;

/// <summary>
/// A hold as the database sees it right now. <see cref="Status"/> is the effective status:
/// a HELD row whose time has run out is already reported as EXPIRED (ADR 0002).
/// <see cref="ServerTime"/> is the database clock at the moment of the read, and
/// <see cref="RemainingMs"/> is the exact time left until expiry on that clock (0 once passed).
/// </summary>
public sealed record HoldView(
    Guid HoldId,
    Guid ClassId,
    string ClassName,
    string StudentId,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset ExpiresAt,
    DateTimeOffset ServerTime,
    long RemainingMs);
