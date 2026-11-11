using System.Net;
using System.Text.Json;
using SchoolAdmission.Tests.Support;
using static SchoolAdmission.Tests.Support.TestHelpers;

namespace SchoolAdmission.Tests;

/// <summary>Story 004: reading one hold and listing a student's holds.</summary>
public class HoldReadTests
{
    [Fact]
    public async Task A_hold_can_be_read_without_a_student_header_and_never_reveals_the_student()
    {
        // WHY: the contract lists no header on this endpoint, so there is no ownership
        // check; the response must therefore not say whose application it is.
        await using var app = await TestApp.StartAsync();
        var classId = await app.CreateClassAsync("Class 6 - Morning Shift", 5);
        var holdId = await app.HoldAsync(classId, Student(1));

        var response = await app.Client.GetAsync($"/holds/{holdId}");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var hold = await response.Json();
        hold.GetProperty("holdId").GetString().ShouldBe(holdId);
        hold.GetProperty("classId").GetString().ShouldBe(classId);
        hold.GetProperty("status").GetString().ShouldBe("HELD");
        hold.GetProperty("expiresAt").GetDateTimeOffset().ShouldBeGreaterThan(DateTimeOffset.UtcNow);
        hold.TryGetProperty("studentId", out _).ShouldBeFalse();
        (await response.Content.ReadAsStringAsync()).ShouldNotContain(Student(1));
    }

    [Theory]
    [InlineData("6f9619ff-8b86-d011-b42d-00c04fc964ff")]
    [InlineData("h_789")]
    public async Task An_unknown_hold_id_is_404(string holdId)
    {
        await using var app = await TestApp.StartAsync();

        var response = await app.Client.GetAsync($"/holds/{holdId}");

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await response.Code()).ShouldBe("HOLD_NOT_FOUND");
    }

    [Fact]
    public async Task My_holds_lists_every_application_of_the_student_newest_first_in_every_status()
    {
        // WHY: this list is how a parent finds their applications again after closing the
        // browser, so it must contain all of them, including ended ones.
        await using var app = await TestApp.StartAsync();
        var a = await app.CreateClassAsync("Class A", 5);
        var b = await app.CreateClassAsync("Class B", 5);
        var c = await app.CreateClassAsync("Class C", 5);
        var d = await app.CreateClassAsync("Class D", 5);
        var confirmed = await app.HoldAsync(a, Student(1));
        var cancelled = await app.HoldAsync(b, Student(1));
        var held = await app.HoldAsync(c, Student(1));
        var expired = await app.InsertOverdueHoldAsync(d, Student(1));
        await app.ConfirmAsync(confirmed, Student(1));
        await app.CancelAsync(cancelled, Student(1));
        await app.HoldAsync(a, Student(2)); // someone else's; must not appear

        var response = await app.MyHoldsAsync(Student(1));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var list = await response.Json();
        list.ValueKind.ShouldBe(JsonValueKind.Array);
        var rows = list.EnumerateArray().ToArray();
        rows.Select(h => h.GetProperty("holdId").GetString()).ShouldBe([held, cancelled, confirmed, expired]);
        rows.Select(h => h.GetProperty("status").GetString()).ShouldBe(["HELD", "CANCELLED", "CONFIRMED", "EXPIRED"]);
        rows.Select(h => h.GetProperty("className").GetString()).ShouldBe(["Class C", "Class B", "Class A", "Class D"]);
        rows.Select(h => h.GetProperty("classId").GetString()).ShouldBe([c, b, a, d]);
    }

    [Fact]
    public async Task My_holds_is_an_empty_array_for_a_student_with_no_applications()
    {
        await using var app = await TestApp.StartAsync();

        var list = await (await app.MyHoldsAsync(Student(9))).Json();

        list.ValueKind.ShouldBe(JsonValueKind.Array);
        list.GetArrayLength().ShouldBe(0);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("123")]
    public async Task My_holds_requires_a_valid_student_id(string? studentId)
    {
        await using var app = await TestApp.StartAsync();

        var response = await app.MyHoldsAsync(studentId);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await response.Code()).ShouldBe("INVALID_STUDENT_ID");
    }
}
