using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using SchoolAdmission.Tests.Support;
using static SchoolAdmission.Tests.Support.TestHelpers;

namespace SchoolAdmission.Tests;

/// <summary>Story 002: create, list and read classes.</summary>
public class ClassesTests
{
    [Fact]
    public async Task Creating_a_class_returns_201_with_its_id_name_and_seats()
    {
        await using var app = await TestApp.StartAsync();

        var response = await app.Client.PostAsJsonAsync(
            "/classes", new { name = "  Class 6 - Morning Shift  ", totalSeats = 120 });

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        var body = await response.Json();
        var id = body.GetProperty("id").GetString()!;
        Guid.TryParse(id, out _).ShouldBeTrue("ids are UUIDs so they cannot be guessed");
        body.GetProperty("name").GetString().ShouldBe("Class 6 - Morning Shift", "the name is trimmed");
        body.GetProperty("totalSeats").GetInt32().ShouldBe(120);
        response.Headers.Location!.ToString().ShouldBe($"/classes/{id}");
    }

    [Fact]
    public async Task A_new_class_has_all_its_seats_available()
    {
        await using var app = await TestApp.StartAsync();
        var id = await app.CreateClassAsync("Class 7 - Day Shift", 40);

        var one = await app.GetClassAsync(id);

        one.GetProperty("id").GetString().ShouldBe(id);
        one.GetProperty("name").GetString().ShouldBe("Class 7 - Day Shift");
        one.GetProperty("totalSeats").GetInt32().ShouldBe(40);
        one.GetProperty("heldSeats").GetInt32().ShouldBe(0);
        one.GetProperty("confirmedSeats").GetInt32().ShouldBe(0);
        one.GetProperty("availableSeats").GetInt32().ShouldBe(40);
    }

    [Fact]
    public async Task The_class_list_is_a_bare_array_ordered_by_name()
    {
        await using var app = await TestApp.StartAsync();

        var empty = await (await app.Client.GetAsync("/classes")).Json();
        empty.ValueKind.ShouldBe(JsonValueKind.Array);
        empty.GetArrayLength().ShouldBe(0);

        await app.CreateClassAsync("Class 8 - Morning Shift", 10);
        await app.CreateClassAsync("class 6 - Day Shift", 20);
        await app.CreateClassAsync("Class 7 - Morning Shift", 30);

        var list = await (await app.Client.GetAsync("/classes")).Json();

        list.EnumerateArray().Select(c => c.GetProperty("name").GetString()).ShouldBe(
            ["class 6 - Day Shift", "Class 7 - Morning Shift", "Class 8 - Morning Shift"]);
    }

    [Fact]
    public async Task Seat_counts_follow_the_holds_of_the_class()
    {
        // WHY: counts are computed from hold rows, so they must move with every apply,
        // confirm and cancel, and always add up to totalSeats.
        await using var app = await TestApp.StartAsync();
        var id = await app.CreateClassAsync("Counting", 5);
        var paid = await app.HoldAsync(id, Student(1));
        await app.HoldAsync(id, Student(2));
        var cancelled = await app.HoldAsync(id, Student(3));
        (await app.ConfirmAsync(paid, Student(1))).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await app.CancelAsync(cancelled, Student(3))).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var one = await app.GetClassAsync(id);
        var listed = (await (await app.Client.GetAsync("/classes")).Json()).EnumerateArray().Single();

        foreach (var c in new[] { one, listed })
        {
            c.GetProperty("heldSeats").GetInt32().ShouldBe(1);
            c.GetProperty("confirmedSeats").GetInt32().ShouldBe(1);
            c.GetProperty("availableSeats").GetInt32().ShouldBe(3);
        }
    }

    public static TheoryData<string> InvalidBodies => new()
    {
        """{"totalSeats":10}""",                                   // name missing
        """{"name":null,"totalSeats":10}""",
        """{"name":"","totalSeats":10}""",
        """{"name":"   ","totalSeats":10}""",
        """{"name":123,"totalSeats":10}""",
        """{"name":"a\u0000b","totalSeats":10}""",                 // NUL: PostgreSQL would reject it with an error
        """{"name":"line\nbreak","totalSeats":10}""",              // control character
        """{"name":"\ud800","totalSeats":10}""",                   // lone surrogate: not valid text
        $$"""{"name":"{{new string('x', 101)}}","totalSeats":10}""", // 101 characters
        """{"name":"A"}""",                                        // totalSeats missing
        """{"name":"A","totalSeats":0}""",
        """{"name":"A","totalSeats":-1}""",
        """{"name":"A","totalSeats":10001}""",
        """{"name":"A","totalSeats":"12"}""",
        """{"name":"A","totalSeats":12.5}""",
        """{"name":"A","totalSeats":null}""",
        """{"name":"A","totalSeats":99999999999}""",
        """{"name":"A","totalSeats":""",                           // malformed JSON
        "",                                                        // empty body
        "[]",
        "\"just a string\"",
    };

    [Theory]
    [MemberData(nameof(InvalidBodies))]
    public async Task Invalid_input_is_rejected_with_400_and_creates_nothing(string json)
    {
        await using var app = await TestApp.StartAsync();

        var response = await app.Client.PostAsync(
            "/classes", new StringContent(json, Encoding.UTF8, "application/json"));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest, json);
        (await response.Code()).ShouldBe("VALIDATION_FAILED");
        (await app.ScalarAsync<long>("SELECT count(*) FROM classes")).ShouldBe(0);
    }

    [Fact]
    public async Task An_oversized_body_is_refused_with_413_before_it_is_read()
    {
        // WHY: without a cap, anyone could make the server buffer megabytes per request.
        await using var app = await TestApp.StartAsync();
        var huge = $$"""{"name":"{{new string('x', 100_000)}}","totalSeats":1}""";

        var response = await app.Client.PostAsync(
            "/classes", new StringContent(huge, Encoding.UTF8, "application/json"));

        response.StatusCode.ShouldBe(HttpStatusCode.RequestEntityTooLarge);
        (await response.Code()).ShouldBe("VALIDATION_FAILED");
    }

    [Theory]
    [InlineData(1)]
    [InlineData(10000)]
    public async Task The_seat_limits_themselves_are_accepted(int totalSeats)
    {
        await using var app = await TestApp.StartAsync();

        var response = await app.Client.PostAsJsonAsync("/classes", new { name = new string('x', 100), totalSeats });

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
    }

    [Fact]
    public async Task A_duplicate_name_is_409_even_when_only_case_or_spacing_differs()
    {
        await using var app = await TestApp.StartAsync();
        await app.CreateClassAsync("Class 6 - Morning Shift", 120);

        var response = await app.Client.PostAsJsonAsync(
            "/classes", new { name = " class 6 - MORNING shift ", totalSeats = 50 });

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await response.Code()).ShouldBe("CLASS_NAME_TAKEN");
    }

    [Fact]
    public async Task Two_simultaneous_creates_with_one_name_produce_exactly_one_class()
    {
        // WHY: uniqueness is decided by the database index, not by a SELECT-then-INSERT
        // that two requests could both pass.
        await using var app = await TestApp.StartAsync();

        var responses = await FireTogether(10, _ =>
            app.Client.PostAsJsonAsync("/classes", new { name = "Racing", totalSeats = 10 }));

        responses.Count(r => r.StatusCode == HttpStatusCode.Created).ShouldBe(1);
        responses.Count(r => r.StatusCode == HttpStatusCode.Conflict).ShouldBe(9);
        (await app.ScalarAsync<long>("SELECT count(*) FROM classes")).ShouldBe(1);
    }

    [Theory]
    [InlineData("6f9619ff-8b86-d011-b42d-00c04fc964ff")] // well-formed, unknown
    [InlineData("c_123")]                                // not a UUID at all
    public async Task An_unknown_class_id_is_404(string classId)
    {
        await using var app = await TestApp.StartAsync();

        var response = await app.Client.GetAsync($"/classes/{classId}");

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await response.Code()).ShouldBe("CLASS_NOT_FOUND");
    }
}
