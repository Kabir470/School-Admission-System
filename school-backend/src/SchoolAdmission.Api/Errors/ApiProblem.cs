using SchoolAdmission.Application;
using SchoolAdmission.Domain;

namespace SchoolAdmission.Api.Errors;

/// <summary>
/// The one place an error code becomes an HTTP response: RFC 7807 ProblemDetails
/// (application/problem+json) plus a machine-readable "code" field.
/// </summary>
public static class ApiProblem
{
    private static readonly Dictionary<string, int> StatusByCode = new()
    {
        [ErrorCodes.InvalidStudentId] = StatusCodes.Status400BadRequest,
        [ErrorCodes.ValidationFailed] = StatusCodes.Status400BadRequest,
        [ErrorCodes.NotYourHold] = StatusCodes.Status403Forbidden,
        [ErrorCodes.ClassNotFound] = StatusCodes.Status404NotFound,
        [ErrorCodes.HoldNotFound] = StatusCodes.Status404NotFound,
        [ErrorCodes.NotFound] = StatusCodes.Status404NotFound,
        [ErrorCodes.MethodNotAllowed] = StatusCodes.Status405MethodNotAllowed,
        [ErrorCodes.SeatsFull] = StatusCodes.Status409Conflict,
        [ErrorCodes.ActiveHoldExists] = StatusCodes.Status409Conflict,
        [ErrorCodes.HoldExpired] = StatusCodes.Status409Conflict,
        [ErrorCodes.HoldCancelled] = StatusCodes.Status409Conflict,
        [ErrorCodes.HoldAlreadyConfirmed] = StatusCodes.Status409Conflict,
        [ErrorCodes.ClassNameTaken] = StatusCodes.Status409Conflict,
        [ErrorCodes.ServiceUnavailable] = StatusCodes.Status503ServiceUnavailable,
        [ErrorCodes.InternalError] = StatusCodes.Status500InternalServerError,
    };

    public static IResult From(Error error) => Create(error.Code, error.Message);

    public static IResult Create(string code, string detail) =>
        // An unmapped code is a programming error; surface it as a 500 rather than guess.
        Create(StatusByCode.GetValueOrDefault(code, StatusCodes.Status500InternalServerError), code, detail);

    public static IResult Create(int status, string code, string detail) =>
        Results.Problem(
            detail: detail,
            statusCode: status,
            extensions: new Dictionary<string, object?> { ["code"] = code });
}
