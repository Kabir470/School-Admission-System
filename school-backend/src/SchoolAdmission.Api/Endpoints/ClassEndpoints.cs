using System.Text.Json;
using SchoolAdmission.Api.Errors;
using SchoolAdmission.Application.Classes;
using SchoolAdmission.Domain;

namespace SchoolAdmission.Api.Endpoints;

public sealed record ClassResponse(Guid Id, string Name, int TotalSeats);

public sealed record ClassSeatsResponse(
    Guid Id, string Name, int TotalSeats, int HeldSeats, int ConfirmedSeats, int AvailableSeats)
{
    public static ClassSeatsResponse From(ClassSeats c) =>
        new(c.Id, c.Name, c.TotalSeats, c.HeldSeats, c.ConfirmedSeats, c.AvailableSeats);
}

public static class ClassEndpoints
{
    /// <summary>A class name and a seat count fit in a few hundred bytes; this is generous.</summary>
    public const int MaxBodyBytes = 64 * 1024;

    public static void MapClassEndpoints(this IEndpointRouteBuilder app)
    {
        // 1. Create a class. No authentication, by requirement (docs/out-of-scope/admin-auth.md).
        app.MapPost("/classes", async (HttpRequest request, ClassService classes, CancellationToken ct) =>
        {
            // The body is parsed by hand so that every bad input (malformed JSON, a string
            // where a number belongs, 12.5 seats) gets the same 400 VALIDATION_FAILED shape.
            // Refuse an oversized body from its declared length, before reading any of it.
            // (A body that hides its length is still stopped by the server-wide cap.)
            if (request.ContentLength > MaxBodyBytes)
            {
                return ApiProblem.Create(
                    StatusCodes.Status413PayloadTooLarge,
                    ErrorCodes.ValidationFailed,
                    "The request body is too large.");
            }

            using var body = await ReadJsonObjectAsync(request, ct);
            if (body is null)
            {
                return ApiProblem.Create(
                    ErrorCodes.ValidationFailed,
                    "The request body must be a JSON object with \"name\" and \"totalSeats\".");
            }

            var name = Property(body, "name");
            if (name is { ValueKind: not (JsonValueKind.String or JsonValueKind.Null) })
            {
                return ApiProblem.Create(ErrorCodes.ValidationFailed, "name must be a string.");
            }

            var seats = Property(body, "totalSeats");
            int? totalSeats =
                seats is { ValueKind: JsonValueKind.Number } number && number.TryGetInt32(out var parsed)
                    ? parsed
                    : null;

            string? nameText;
            try
            {
                nameText = name?.GetString();
            }
            catch (InvalidOperationException)
            {
                // A JSON string that is not valid text, for example a lone surrogate "\ud800".
                return ApiProblem.Create(ErrorCodes.ValidationFailed, "name is not valid text.");
            }

            var result = await classes.CreateAsync(nameText, totalSeats, ct);
            if (!result.IsSuccess)
            {
                return ApiProblem.From(result.Error!);
            }

            var created = result.Value;
            return Results.Created(
                $"/classes/{created.Id}",
                new ClassResponse(created.Id, created.Name, created.TotalSeats));
        });

        // 2. All classes with live seat counts.
        app.MapGet("/classes", async (ClassService classes, CancellationToken ct) =>
            Results.Ok((await classes.ListAsync(ct)).Select(ClassSeatsResponse.From)));

        // 3. One class. The id is a plain string on purpose: a malformed id is simply a
        //    class that does not exist (404), not a routing miss.
        app.MapGet("/classes/{classId}", async (string classId, ClassService classes, CancellationToken ct) =>
        {
            var result = await classes.GetAsync(classId, ct);
            return result.IsSuccess
                ? Results.Ok(ClassSeatsResponse.From(result.Value))
                : ApiProblem.From(result.Error!);
        });
    }

    private static async Task<JsonDocument?> ReadJsonObjectAsync(HttpRequest request, CancellationToken ct)
    {
        try
        {
            var document = await JsonDocument.ParseAsync(request.Body, cancellationToken: ct);
            if (document.RootElement.ValueKind == JsonValueKind.Object)
            {
                return document;
            }

            document.Dispose();
            return null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static JsonElement? Property(JsonDocument body, string name)
    {
        foreach (var property in body.RootElement.EnumerateObject())
        {
            if (string.Equals(property.Name, name, StringComparison.OrdinalIgnoreCase))
            {
                return property.Value;
            }
        }

        return null;
    }
}
