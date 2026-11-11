using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using SchoolAdmission.Tests.Support;
using static SchoolAdmission.Tests.Support.TestHelpers;

namespace SchoolAdmission.Tests;

/// <summary>
/// Story 007: the exact wire contract of the eight endpoints. The API is graded by
/// automated tests, so every listed field must exist with the listed name and JSON type.
/// Extra fields are allowed; these tests therefore assert "contains", never "equals".
/// </summary>
public partial class ContractTests
{
    private const string ClassName = "Class 6 - Morning Shift";

    [GeneratedRegex(@"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")]
    private static partial Regex IsoUtcSeconds();

    [Fact]
    public async Task Endpoint_1_post_classes()
    {
        await using var app = await TestApp.StartAsync();

        var response = await app.Client.PostAsJsonAsync("/classes", new { name = ClassName, totalSeats = 120 });

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        response.Content.Headers.ContentType!.MediaType.ShouldBe("application/json");
        var body = await response.Json();
        ShouldBeString(body, "id");
        body.GetProperty("name").GetString().ShouldBe(ClassName);
        ShouldBeNumber(body, "totalSeats", 120);
    }

    [Fact]
    public async Task Endpoint_2_get_classes()
    {
        await using var app = await TestApp.StartAsync();
        var classId = await app.CreateClassAsync(ClassName, 120);

        var response = await app.Client.GetAsync("/classes");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await response.Json();
        body.ValueKind.ShouldBe(JsonValueKind.Array, "the list is a bare array, not wrapped in an object");
        ShouldBeClassWithSeats(body.EnumerateArray().Single(), classId);
    }

    [Fact]
    public async Task Endpoint_3_get_class()
    {
        await using var app = await TestApp.StartAsync();
        var classId = await app.CreateClassAsync(ClassName, 120);

        var response = await app.Client.GetAsync($"/classes/{classId}");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        ShouldBeClassWithSeats(await response.Json(), classId);
    }

    [Fact]
    public async Task Endpoint_4_post_hold()
    {
        await using var app = await TestApp.StartAsync();
        var classId = await app.CreateClassAsync(ClassName, 1);

        var response = await app.ApplyAsync(classId, Student(1));

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        var body = await response.Json();
        ShouldBeString(body, "holdId");
        body.GetProperty("classId").GetString().ShouldBe(classId);
        body.GetProperty("studentId").GetString().ShouldBe(Student(1));
        body.GetProperty("status").GetString().ShouldBe("HELD");
        ShouldBeTimestamp(body, "expiresAt");
        ShouldBeTimestamp(body, "serverTime");
        ShouldBeTimestamp(body, "createdAt");

        // "No seat available → 409".
        (await app.ApplyAsync(classId, Student(2))).StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Endpoint_5_get_hold()
    {
        await using var app = await TestApp.StartAsync();
        var classId = await app.CreateClassAsync(ClassName, 1);
        var holdId = await app.HoldAsync(classId, Student(1));

        var response = await app.Client.GetAsync($"/holds/{holdId}");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await response.Json();
        body.GetProperty("holdId").GetString().ShouldBe(holdId);
        body.GetProperty("classId").GetString().ShouldBe(classId);
        body.GetProperty("status").GetString().ShouldBe("HELD");
        ShouldBeTimestamp(body, "expiresAt");
        body.TryGetProperty("studentId", out _).ShouldBeFalse("this endpoint has no ownership check");
    }

    [Fact]
    public async Task Endpoint_5_status_is_one_of_the_four_uppercase_values()
    {
        await using var app = await TestApp.StartAsync();
        var classId = await app.CreateClassAsync(ClassName, 10);
        var held = await app.HoldAsync(classId, Student(1));
        var confirmed = await app.HoldAsync(classId, Student(2));
        var cancelled = await app.HoldAsync(classId, Student(3));
        var expired = await app.InsertOverdueHoldAsync(classId, Student(4));
        await app.ConfirmAsync(confirmed, Student(2));
        await app.CancelAsync(cancelled, Student(3));

        (await app.GetHoldAsync(held)).GetProperty("status").GetString().ShouldBe("HELD");
        (await app.GetHoldAsync(confirmed)).GetProperty("status").GetString().ShouldBe("CONFIRMED");
        (await app.GetHoldAsync(cancelled)).GetProperty("status").GetString().ShouldBe("CANCELLED");
        (await app.GetHoldAsync(expired)).GetProperty("status").GetString().ShouldBe("EXPIRED");
    }

    [Fact]
    public async Task Endpoint_6_confirm_hold()
    {
        await using var app = await TestApp.StartAsync();
        var holdId = await app.HoldAsync(await app.CreateClassAsync(ClassName, 1), Student(1));

        var response = await app.ConfirmAsync(holdId, Student(1));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await response.Json();
        body.GetProperty("holdId").GetString().ShouldBe(holdId);
        body.GetProperty("status").GetString().ShouldBe("CONFIRMED");
    }

    [Fact]
    public async Task Endpoint_7_delete_hold()
    {
        await using var app = await TestApp.StartAsync();
        var holdId = await app.HoldAsync(await app.CreateClassAsync(ClassName, 1), Student(1));

        var response = await app.CancelAsync(holdId, Student(1));

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await response.Content.ReadAsByteArrayAsync()).ShouldBeEmpty();
        response.Content.Headers.ContentType.ShouldBeNull();
    }

    [Fact]
    public async Task Endpoint_8_get_my_holds()
    {
        await using var app = await TestApp.StartAsync();
        var classId = await app.CreateClassAsync(ClassName, 1);
        var holdId = await app.HoldAsync(classId, Student(1));

        var response = await app.MyHoldsAsync(Student(1));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await response.Json();
        body.ValueKind.ShouldBe(JsonValueKind.Array);
        var hold = body.EnumerateArray().Single();
        hold.GetProperty("holdId").GetString().ShouldBe(holdId);
        hold.GetProperty("classId").GetString().ShouldBe(classId);
        hold.GetProperty("className").GetString().ShouldBe(ClassName);
        hold.GetProperty("status").GetString().ShouldBe("HELD");
        ShouldBeTimestamp(hold, "expiresAt");
    }

    private static void ShouldBeClassWithSeats(JsonElement body, string classId)
    {
        body.GetProperty("id").GetString().ShouldBe(classId);
        body.GetProperty("name").GetString().ShouldBe(ClassName);
        ShouldBeNumber(body, "totalSeats", 120);
        ShouldBeNumber(body, "heldSeats", 0);
        ShouldBeNumber(body, "confirmedSeats", 0);
        ShouldBeNumber(body, "availableSeats", 120);
    }

    private static void ShouldBeString(JsonElement body, string name)
    {
        body.GetProperty(name).ValueKind.ShouldBe(JsonValueKind.String, name);
        body.GetProperty(name).GetString().ShouldNotBeNullOrWhiteSpace();
    }

    private static void ShouldBeNumber(JsonElement body, string name, int expected)
    {
        body.GetProperty(name).ValueKind.ShouldBe(JsonValueKind.Number, name);
        body.GetProperty(name).GetInt32().ShouldBe(expected, name);
    }

    private static void ShouldBeTimestamp(JsonElement body, string name)
    {
        var value = body.GetProperty(name).GetString();
        value.ShouldNotBeNull();
        IsoUtcSeconds().IsMatch(value).ShouldBeTrue($"{name} was '{value}', expected ISO-8601 UTC like 2026-11-01T04:10:00Z");
    }
}
