using System.Text.Json.Serialization;
using SchoolAdmission.Api.Errors;
using SchoolAdmission.Api.Json;
using SchoolAdmission.Application.Holds;
using SchoolAdmission.Domain;

namespace SchoolAdmission.Api.Endpoints;

// Response shapes. The contract fields come first; className, createdAt and serverTime
// are extras (allowed by the contract). remainingMs is the exact time left on the database
// clock, which the UI counts down from; serverTime lets any client correct its countdown
// when the device clock is wrong.

/// <summary>POST /classes/{classId}/holds. The caller just sent this studentId, so echoing it is safe.</summary>
public sealed record HoldCreatedResponse(
    Guid HoldId,
    Guid ClassId,
    string StudentId,
    string Status,
    [property: JsonConverter(typeof(CeilingSecondsConverter))] DateTimeOffset ExpiresAt,
    string ClassName,
    DateTimeOffset CreatedAt,
    DateTimeOffset ServerTime,
    long RemainingMs);

/// <summary>
/// GET /holds/{holdId} and each element of GET /me/holds. Deliberately has no studentId
/// property: GET /holds/{holdId} has no ownership check, so it must not reveal whose hold it is.
/// </summary>
public sealed record HoldResponse(
    Guid HoldId,
    Guid ClassId,
    string ClassName,
    string Status,
    [property: JsonConverter(typeof(CeilingSecondsConverter))] DateTimeOffset ExpiresAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset ServerTime,
    long RemainingMs)
{
    public static HoldResponse From(HoldView h) =>
        new(h.HoldId, h.ClassId, h.ClassName, h.Status, h.ExpiresAt, h.CreatedAt, h.ServerTime, h.RemainingMs);
}

/// <summary>POST /holds/{holdId}/confirm.</summary>
public sealed record HoldConfirmedResponse(Guid HoldId, string Status, Guid ClassId, DateTimeOffset ServerTime);

public static class HoldEndpoints
{
    public const string StudentIdHeader = "X-Student-Id";

    public static void MapHoldEndpoints(this IEndpointRouteBuilder app)
    {
        // 4. Apply: put a seat on hold.
        app.MapPost("/classes/{classId}/holds", async (
            string classId, HttpRequest request, HoldService holds, CancellationToken ct) =>
        {
            if (!TryReadStudentId(request, out var studentId))
            {
                return InvalidStudentId();
            }

            var result = await holds.CreateAsync(classId, studentId, ct);
            if (!result.IsSuccess)
            {
                return ApiProblem.From(result.Error!);
            }

            var h = result.Value;
            return Results.Created(
                $"/holds/{h.HoldId}",
                new HoldCreatedResponse(
                    h.HoldId, h.ClassId, h.StudentId, h.Status, h.ExpiresAt, h.ClassName, h.CreatedAt, h.ServerTime, h.RemainingMs));
        });

        // 5. Current state of an application. The contract lists no header here, so none is required.
        app.MapGet("/holds/{holdId}", async (string holdId, HoldService holds, CancellationToken ct) =>
        {
            var result = await holds.GetAsync(holdId, ct);
            return result.IsSuccess
                ? Results.Ok(HoldResponse.From(result.Value))
                : ApiProblem.From(result.Error!);
        });

        // 6. Pay the fee: confirm the admission. Safe to repeat.
        app.MapPost("/holds/{holdId}/confirm", async (
            string holdId, HttpRequest request, HoldService holds, CancellationToken ct) =>
        {
            if (!TryReadStudentId(request, out var studentId))
            {
                return InvalidStudentId();
            }

            var result = await holds.ConfirmAsync(holdId, studentId, ct);
            if (!result.IsSuccess)
            {
                return ApiProblem.From(result.Error!);
            }

            var h = result.Value;
            return Results.Ok(new HoldConfirmedResponse(h.HoldId, h.Status, h.ClassId, h.ServerTime));
        });

        // 7. Cancel the application.
        app.MapDelete("/holds/{holdId}", async (
            string holdId, HttpRequest request, HoldService holds, CancellationToken ct) =>
        {
            if (!TryReadStudentId(request, out var studentId))
            {
                return InvalidStudentId();
            }

            var result = await holds.CancelAsync(holdId, studentId, ct);
            return result.IsSuccess ? Results.NoContent() : ApiProblem.From(result.Error!);
        });

        // 8. All of this student's applications, every status, newest first.
        app.MapGet("/me/holds", async (HttpRequest request, HoldService holds, CancellationToken ct) =>
        {
            if (!TryReadStudentId(request, out var studentId))
            {
                return InvalidStudentId();
            }

            return Results.Ok((await holds.ListForStudentAsync(studentId, ct)).Select(HoldResponse.From));
        });
    }

    private static bool TryReadStudentId(HttpRequest request, out string studentId)
    {
        var values = request.Headers[StudentIdHeader];
        studentId = values.Count == 1 ? values[0] ?? "" : "";
        return StudentId.IsValid(studentId);
    }

    private static IResult InvalidStudentId() =>
        ApiProblem.Create(
            ErrorCodes.InvalidStudentId,
            $"The {StudentIdHeader} header must be the student's birth registration number: exactly 17 digits.");
}
