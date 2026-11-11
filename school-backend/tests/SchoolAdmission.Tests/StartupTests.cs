using System.Net;
using Npgsql;
using SchoolAdmission.Tests.Support;
using static SchoolAdmission.Tests.Support.TestHelpers;

namespace SchoolAdmission.Tests;

/// <summary>Story 001: the host starts, checks its configuration loudly, and the schema carries the rules.</summary>
public class StartupTests
{
    [Fact]
    public async Task Health_is_200_when_the_database_answers()
    {
        await using var app = await TestApp.StartAsync();

        var response = await app.Client.GetAsync("/health");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("-5")]
    [InlineData("abc")]
    [InlineData("10.5")]
    public async Task An_invalid_hold_duration_stops_startup_instead_of_silently_using_a_default(string value)
    {
        // WHY: a typo in HOLD_DURATION_SECONDS must not quietly become a 10-minute (or 0-second) hold.
        await using var app = await TestApp.StartAsync();

        var error = Should.Throw<InvalidOperationException>(() =>
            app.AddHost(new Dictionary<string, string?> { ["HOLD_DURATION_SECONDS"] = value }));

        error.Message.ShouldContain("HOLD_DURATION_SECONDS");
    }

    [Fact]
    public async Task An_unset_hold_duration_defaults_to_600_seconds()
    {
        await using var app = await TestApp.StartAsync();
        var client = app.AddHost(new Dictionary<string, string?> { ["HOLD_DURATION_SECONDS"] = null });
        var classId = await app.CreateClassAsync("Default duration", 1);

        var hold = await (await app.ApplyAsync(classId, Student(1), client)).Json();

        var lifetime = hold.GetProperty("expiresAt").GetDateTimeOffset() - hold.GetProperty("createdAt").GetDateTimeOffset();
        lifetime.TotalSeconds.ShouldBeInRange(599, 601);
    }

    [Fact]
    public async Task Settings_report_the_configured_hold_duration_so_the_ui_never_states_a_wrong_one()
    {
        // WHY: the UI tells parents how long a seat is held. HOLD_DURATION_SECONDS is
        // configurable, so a hard-coded "10 minutes" in the UI would be wrong when it changes.
        await using var app = await TestApp.StartAsync(holdSeconds: 90);

        var response = await app.Client.GetAsync("/settings");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await response.Json()).GetProperty("holdDurationSeconds").GetInt32().ShouldBe(90);
    }

    [Fact]
    public async Task A_missing_connection_string_stops_startup_and_names_the_variable()
    {
        await using var app = await TestApp.StartAsync();

        var error = Should.Throw<InvalidOperationException>(() =>
            app.AddHost(new Dictionary<string, string?> { ["ConnectionStrings:Default"] = "" }));

        error.Message.ShouldContain("ConnectionStrings__Default");
    }

    [Fact]
    public async Task The_database_itself_refuses_a_second_active_hold_for_one_student_in_one_class()
    {
        // WHY: "one active application per student per class" must hold even if application
        // code is wrong, so it is a unique index, checked here without going through the API.
        await using var app = await TestApp.StartAsync();
        var classId = Guid.Parse(await app.CreateClassAsync("Index check", 5));
        const string insert = """
            INSERT INTO holds (id, class_id, student_id, status, created_at, expires_at)
            VALUES (gen_random_uuid(), $1, $2, $3, now(), now() + interval '10 minutes')
            RETURNING id
            """;

        await app.ScalarAsync<Guid>(insert, classId, Student(1), "HELD");

        var duplicate = await Should.ThrowAsync<PostgresException>(() =>
            app.ScalarAsync<Guid>(insert, classId, Student(1), "CONFIRMED"));
        duplicate.SqlState.ShouldBe(PostgresErrorCodes.UniqueViolation);

        // Ended holds are outside the index: any number of them may exist.
        await app.ScalarAsync<Guid>(insert, classId, Student(1), "CANCELLED");
        await app.ScalarAsync<Guid>(insert, classId, Student(1), "EXPIRED");
    }
}
