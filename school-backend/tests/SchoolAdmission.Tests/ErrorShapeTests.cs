using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.Extensions.DependencyInjection;
using SchoolAdmission.Application.Classes;
using SchoolAdmission.Tests.Support;
using static SchoolAdmission.Tests.Support.TestHelpers;

namespace SchoolAdmission.Tests;

/// <summary>
/// Story 007: every failure is RFC 7807 ProblemDetails with a "code", so the UI can show
/// the right message; and no failure leaks server internals.
/// </summary>
public class ErrorShapeTests
{
    [Fact]
    public async Task A_business_error_is_problem_json_with_status_title_detail_and_code()
    {
        await using var app = await TestApp.StartAsync();
        var classId = await app.CreateClassAsync("Full", 1);
        await app.HoldAsync(classId, Student(1));

        var response = await app.ApplyAsync(classId, Student(2));

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        response.Content.Headers.ContentType!.MediaType.ShouldBe("application/problem+json");
        var problem = await response.Json();
        problem.GetProperty("status").GetInt32().ShouldBe(409);
        problem.GetProperty("title").GetString().ShouldNotBeNullOrWhiteSpace();
        problem.GetProperty("detail").GetString().ShouldNotBeNullOrWhiteSpace();
        problem.GetProperty("code").GetString().ShouldBe("SEATS_FULL");
    }

    [Fact]
    public async Task An_unknown_route_is_404_json_not_an_empty_page()
    {
        await using var app = await TestApp.StartAsync();

        var response = await app.Client.GetAsync("/no/such/route");

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        response.Content.Headers.ContentType!.MediaType.ShouldBe("application/problem+json");
        (await response.Code()).ShouldBe("NOT_FOUND");
    }

    [Fact]
    public async Task A_wrong_method_on_a_known_route_is_405_json()
    {
        await using var app = await TestApp.StartAsync();

        var response = await app.Client.PutAsJsonAsync("/classes", new { name = "X", totalSeats = 1 });

        response.StatusCode.ShouldBe(HttpStatusCode.MethodNotAllowed);
        (await response.Code()).ShouldBe("METHOD_NOT_ALLOWED");
    }

    [Fact]
    public async Task A_body_that_is_not_declared_as_json_is_still_validated_not_crashed()
    {
        await using var app = await TestApp.StartAsync();

        var response = await app.Client.PostAsync("/classes", new StringContent("name=Class 6", Encoding.UTF8, "text/plain"));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await response.Code()).ShouldBe("VALIDATION_FAILED");
    }

    [Fact]
    public async Task An_unexpected_failure_is_a_500_that_reveals_nothing_about_the_server()
    {
        // WHY: a stack trace or SQL text in a response is an information leak, and a parent
        // can do nothing with it. The UI only needs to know that the server failed.
        await using var app = await TestApp.StartAsync();
        var broken = app.AddHost(overrideServices: services =>
            services.AddScoped<IClassStore, ExplodingClassStore>());

        var response = await broken.GetAsync("/classes");

        response.StatusCode.ShouldBe(HttpStatusCode.InternalServerError);
        response.Content.Headers.ContentType!.MediaType.ShouldBe("application/problem+json");
        (await response.Code()).ShouldBe("INTERNAL_ERROR");
        var text = await response.Content.ReadAsStringAsync();
        text.ShouldNotContain(ExplodingClassStore.Secret);
        text.ShouldNotContain("Exception");
        text.ShouldNotContain("   at ");
    }

    [Fact]
    public async Task An_unreachable_database_is_a_503_with_retry_after_not_a_generic_500()
    {
        // WHY: the database restarting, or every connection being busy during a rush, is
        // "try again in a moment", not "the server is broken". Clients can tell them apart.
        await using var app = await TestApp.StartAsync();
        var noDatabase = app.AddHost(new Dictionary<string, string?>
        {
            // Nothing listens on port 1.
            ["ConnectionStrings:Default"] = "Host=127.0.0.1;Port=1;Username=x;Password=x;Database=x;Timeout=2",
        });

        var response = await noDatabase.GetAsync("/classes");

        response.StatusCode.ShouldBe(HttpStatusCode.ServiceUnavailable);
        (await response.Code()).ShouldBe("SERVICE_UNAVAILABLE");
        response.Headers.RetryAfter.ShouldNotBeNull();
        (await response.Content.ReadAsStringAsync()).ShouldNotContain("127.0.0.1");

        (await noDatabase.GetAsync("/health")).StatusCode.ShouldBe(HttpStatusCode.ServiceUnavailable);
    }

    private sealed class ExplodingClassStore : IClassStore
    {
        public const string Secret = "connection string password=hunter2";

        public Task<ClassCreated?> InsertAsync(string name, int totalSeats, CancellationToken ct) =>
            throw new InvalidOperationException(Secret);

        public Task<IReadOnlyList<ClassSeats>> ListAsync(CancellationToken ct) =>
            throw new InvalidOperationException(Secret);

        public Task<ClassSeats?> GetAsync(Guid classId, CancellationToken ct) =>
            throw new InvalidOperationException(Secret);
    }
}
