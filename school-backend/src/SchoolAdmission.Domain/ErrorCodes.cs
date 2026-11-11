namespace SchoolAdmission.Domain;

/// <summary>Machine-readable error codes. Sent as the "code" field of every error response.</summary>
public static class ErrorCodes
{
    public const string SeatsFull = "SEATS_FULL";
    public const string ActiveHoldExists = "ACTIVE_HOLD_EXISTS";
    public const string HoldExpired = "HOLD_EXPIRED";
    public const string HoldCancelled = "HOLD_CANCELLED";
    public const string HoldAlreadyConfirmed = "HOLD_ALREADY_CONFIRMED";
    public const string NotYourHold = "NOT_YOUR_HOLD";
    public const string InvalidStudentId = "INVALID_STUDENT_ID";
    public const string ValidationFailed = "VALIDATION_FAILED";
    public const string ClassNotFound = "CLASS_NOT_FOUND";
    public const string HoldNotFound = "HOLD_NOT_FOUND";
    public const string ClassNameTaken = "CLASS_NAME_TAKEN";
    public const string NotFound = "NOT_FOUND";
    public const string MethodNotAllowed = "METHOD_NOT_ALLOWED";
    public const string ServiceUnavailable = "SERVICE_UNAVAILABLE";
    public const string InternalError = "INTERNAL_ERROR";
}
