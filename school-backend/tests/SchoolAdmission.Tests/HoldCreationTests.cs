using System.Net;
using SchoolAdmission.Tests.Support;
using static SchoolAdmission.Tests.Support.TestHelpers;

namespace SchoolAdmission.Tests;

/// <summary>Story 003: applying for a seat.</summary>
public class HoldCreationTests
{
    [Fact]
    public async Task Applying_holds_a_seat_until_the_database_clock_plus_the_hold_duration()
    {
        await using var app = await TestApp.StartAsync(holdSeconds: 300);
        var classId = await app.CreateClassAsync("Class 6 - Morning Shift", 3);

        var response = await app.ApplyAsync(classId, Student(1));

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        var hold = await response.Json();
        var holdId = hold.GetProperty("holdId").GetString()!;
        Guid.TryParse(holdId, out _).ShouldBeTrue();
        hold.GetProperty("classId").GetString().ShouldBe(classId);
        hold.GetProperty("studentId").GetString().ShouldBe(Student(1));
        hold.GetProperty("status").GetString().ShouldBe("HELD");
        hold.GetProperty("className").GetString().ShouldBe("Class 6 - Morning Shift");
        response.Headers.Location!.ToString().ShouldBe($"/holds/{holdId}");

        // remainingMs is the exact time left on the database clock. The UI counts down from
        // it, so its countdown does not depend on the device clock or on rounded timestamps.
        hold.GetProperty("remainingMs").GetInt64().ShouldBe(300_000);
        var remainingOnRead = (await app.GetHoldAsync(holdId)).GetProperty("remainingMs").GetInt64();
        remainingOnRead.ShouldBeInRange(290_000, 300_000);

        // The expiry is set by the database, from its own clock.
        var storedLifetime = await app.ScalarAsync<double>(
            "SELECT extract(epoch FROM expires_at - created_at)::float8 FROM holds WHERE id = $1", Guid.Parse(holdId));
        storedLifetime.ShouldBe(300d);
        var secondsLeft = await app.ScalarAsync<double>(
            "SELECT extract(epoch FROM expires_at - now())::float8 FROM holds WHERE id = $1", Guid.Parse(holdId));
        secondsLeft.ShouldBeInRange(290, 300);

        var seats = await app.GetClassAsync(classId);
        seats.GetProperty("heldSeats").GetInt32().ShouldBe(1);
        seats.GetProperty("availableSeats").GetInt32().ShouldBe(2);
    }

    [Fact]
    public async Task The_last_seat_goes_to_the_first_applicant_and_the_next_gets_409()
    {
        await using var app = await TestApp.StartAsync();
        var classId = await app.CreateClassAsync("One seat", 1);
        await app.HoldAsync(classId, Student(1));

        var response = await app.ApplyAsync(classId, Student(2));

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await response.Code()).ShouldBe("SEATS_FULL");
    }

    [Fact]
    public async Task A_student_with_a_seat_in_a_full_class_is_told_about_their_own_application()
    {
        // WHY: "you already applied" is the useful answer; "class is full" would send the
        // parent away thinking they have no seat.
        await using var app = await TestApp.StartAsync();
        var classId = await app.CreateClassAsync("Full", 1);
        await app.HoldAsync(classId, Student(1));

        var response = await app.ApplyAsync(classId, Student(1));

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await response.Code()).ShouldBe("ACTIVE_HOLD_EXISTS");
    }

    [Fact]
    public async Task One_student_may_hold_seats_in_two_different_classes()
    {
        // Each shift is its own class, and the one-application rule is per class.
        await using var app = await TestApp.StartAsync();
        var morning = await app.CreateClassAsync("Class 6 - Morning Shift", 5);
        var day = await app.CreateClassAsync("Class 6 - Day Shift", 5);

        (await app.ApplyAsync(morning, Student(1))).StatusCode.ShouldBe(HttpStatusCode.Created);
        (await app.ApplyAsync(day, Student(1))).StatusCode.ShouldBe(HttpStatusCode.Created);
    }

    [Theory]
    [InlineData(null)]                    // header missing
    [InlineData("")]
    [InlineData("2015269123456789")]      // 16 digits
    [InlineData("201526912345678901")]    // 18 digits
    [InlineData("2015269123456789a")]     // a letter
    [InlineData("2015269 123456789")]     // a space inside
    [InlineData("-2015269123456789")]     // a sign
    [InlineData("২০১৫২৬৯১২৩৪৫৬৭৮৯০")]      // 17 Bangla digits: digits, but not ASCII
    public async Task An_invalid_student_id_is_400_and_takes_no_seat(string? studentId)
    {
        await using var app = await TestApp.StartAsync();
        var classId = await app.CreateClassAsync("Strict", 5);

        var response = await app.ApplyAsync(classId, studentId);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await response.Code()).ShouldBe("INVALID_STUDENT_ID");
        (await app.ActiveHoldCountAsync(classId)).ShouldBe(0);
    }

    [Theory]
    [InlineData("6f9619ff-8b86-d011-b42d-00c04fc964ff")]
    [InlineData("c_123")]
    public async Task Applying_to_an_unknown_class_is_404(string classId)
    {
        await using var app = await TestApp.StartAsync();

        var response = await app.ApplyAsync(classId, Student(1));

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await response.Code()).ShouldBe("CLASS_NOT_FOUND");
    }

    [Fact]
    public async Task A_class_full_of_overdue_holds_accepts_a_new_applicant_at_once()
    {
        // WHY: an expired hold must free its seat on its own. Here nothing has swept the
        // overdue rows; the apply itself must see through them.
        await using var app = await TestApp.StartAsync();
        var classId = await app.CreateClassAsync("Stale", 2);
        var stale = await app.InsertOverdueHoldAsync(classId, Student(1));
        await app.InsertOverdueHoldAsync(classId, Student(2));

        var response = await app.ApplyAsync(classId, Student(3));

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        (await app.StoredStatusAsync(stale)).ShouldBe("EXPIRED", "the apply writes EXPIRED on overdue holds of its class");
        (await app.ActiveHoldCountAsync(classId)).ShouldBe(1);
    }
}
