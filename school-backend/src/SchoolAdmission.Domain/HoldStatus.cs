namespace SchoolAdmission.Domain;

/// <summary>
/// The four states of an application. Stored and sent as these exact uppercase strings.
/// HELD is the only non-terminal state: nothing ever moves a hold back to HELD.
/// </summary>
public static class HoldStatus
{
    public const string Held = "HELD";
    public const string Confirmed = "CONFIRMED";
    public const string Expired = "EXPIRED";
    public const string Cancelled = "CANCELLED";
}
