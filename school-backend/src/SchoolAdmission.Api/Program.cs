using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Endpoints;
using SchoolAdmission.Api.Errors;
using SchoolAdmission.Api.Json;
using SchoolAdmission.Application;
using SchoolAdmission.Domain;
using SchoolAdmission.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddAdmission();

// The only request body this API accepts is a class name and a seat count. Without a cap,
// Kestrel would buffer bodies of up to ~28 MB before validation ever saw them.
builder.WebHost.ConfigureKestrel(kestrel => kestrel.Limits.MaxRequestBodySize = ClassEndpoints.MaxBodyBytes);

// Timestamps go out as whole-second UTC ("2026-11-01T04:10:00Z"), as in the API contract.
builder.Services.ConfigureHttpJsonOptions(json =>
    json.SerializerOptions.Converters.Add(new FloorSecondsConverter()));

// The browser UI is served from another origin (port 3000), so it needs CORS.
// Allowed origins come from CORS_ORIGINS (comma-separated).
builder.Services.AddCors();
builder.Services.AddOptions<CorsOptions>().Configure<IConfiguration>((cors, configuration) =>
{
    var origins = (configuration["CORS_ORIGINS"] ?? "http://localhost:3000")
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    cors.AddDefaultPolicy(policy => policy
        .WithOrigins(origins)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .WithExposedHeaders("Location"));
});

var app = builder.Build();

// Fail fast: a missing connection string or an invalid HOLD_DURATION_SECONDS stops the
// process here with a clear message, instead of surfacing later as a 500 on some request.
DependencyInjection.RequireConnectionString(app.Configuration);
var options = app.Services.GetRequiredService<AdmissionOptions>();
app.Logger.LogInformation(
    "Hold duration {HoldSeconds}s; expiry sweeper {Sweeper}.",
    options.HoldDurationSeconds,
    options.SweeperEnabled ? $"every {options.SweepIntervalSeconds}s" : "disabled");

// Anything unexpected becomes a 500 ProblemDetails. The exception is logged by the
// middleware; nothing from it (message, stack trace, SQL) reaches the response body.
app.UseExceptionHandler(handler => handler.Run(async context =>
{
    var exception = context.Features.Get<IExceptionHandlerFeature>()?.Error;
    IResult result;
    if (exception is BadHttpRequestException badRequest)
    {
        // For example 413 when the body is larger than the limit set above.
        result = ApiProblem.Create(
            badRequest.StatusCode, ErrorCodes.ValidationFailed, "The request could not be read or is too large.");
    }
    else if (DatabaseFailures.IsUnavailable(exception))
    {
        // Database down, or no free connection in time during a rush. Not a bug: say
        // "busy, come back in a moment" so clients retry instead of giving up.
        context.Response.Headers.RetryAfter = "2";
        result = ApiProblem.Create(
            ErrorCodes.ServiceUnavailable, "The service is busy or temporarily unavailable. Please try again in a moment.");
    }
    else
    {
        result = ApiProblem.Create(ErrorCodes.InternalError, "Something went wrong on the server. Please try again.");
    }

    await result.ExecuteAsync(context);
}));

// Unknown routes (404) and wrong methods (405) have no body by default; give them the
// same ProblemDetails shape as every other error.
app.UseStatusCodePages(async statusContext =>
{
    var context = statusContext.HttpContext;
    var result = context.Response.StatusCode switch
    {
        StatusCodes.Status404NotFound => ApiProblem.Create(ErrorCodes.NotFound, "No such endpoint."),
        StatusCodes.Status405MethodNotAllowed => ApiProblem.Create(
            ErrorCodes.MethodNotAllowed, "This endpoint does not support that HTTP method."),
        var status => ApiProblem.Create(status, ErrorCodes.ValidationFailed, "The request was not accepted."),
    };
    await result.ExecuteAsync(context);
});

app.UseCors();

app.MapGet("/health", async (AdmissionDbContext db, CancellationToken ct) =>
    await db.Database.CanConnectAsync(ct)
        ? Results.Ok(new { status = "ok" })
        : Results.Json(new { status = "database unreachable" }, statusCode: StatusCodes.Status503ServiceUnavailable));

// Not part of the contract (extra endpoints are allowed): lets the UI state the real hold
// duration ("a seat is held for 10 minutes") instead of hard-coding the default.
app.MapGet("/settings", (AdmissionOptions settings) =>
    Results.Ok(new { holdDurationSeconds = settings.HoldDurationSeconds }));

app.MapClassEndpoints();
app.MapHoldEndpoints();

app.Run();
