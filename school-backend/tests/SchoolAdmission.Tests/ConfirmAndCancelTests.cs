using System.Net;
using SchoolAdmission.Tests.Support;
using static SchoolAdmission.Tests.Support.TestHelpers;

namespace SchoolAdmission.Tests;

/// <summary>Story 005: paying the fee (confirm) and cancelling.</summary>
public class ConfirmAndCancelTests
{
    [Fact]
    public async Task Confirming_turns_a_held_seat_into_a_confirmed_one()
    {
        await using var app = await TestApp.StartAsync();
        var classId = await app.CreateClassAsync("Class 6 - Morning Shift", 3);
        var holdId = await app.HoldAsync(classId, Student(1));

        var response = await app.ConfirmAsync(holdId, Student(1));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await response.Json();
        body.GetProperty("holdId").GetString().ShouldBe(holdId);
        body.GetProperty("status").GetString().ShouldBe("CONFIRMED");
        var seats = await app.GetClassAsync(classId);
        seats.GetProperty("heldSeats").GetInt32().ShouldBe(0);
        seats.GetProperty("confirmedSeats").GetInt32().ShouldBe(1);
        seats.GetProperty("availableSeats").GetInt32().ShouldBe(2);
        (await app.GetHoldAsync(holdId)).GetProperty("status").GetString().ShouldBe("CONFIRMED");
    }

    [Fact]
    public async Task Ten_simultaneous_confirms_of_one_hold_all_succeed_and_count_once()
    {
        // WHY: a payment button pressed repeatedly, or a retried request, must not be
        // counted as several admissions; and every caller must hear "confirmed".
        await using var app = await TestApp.StartAsync();
        var classId = await app.CreateClassAsync("Class 6 - Day Shift", 5);
        var holdId = await app.HoldAsync(classId, Student(1));

        var responses = await FireTogether(10, _ => app.ConfirmAsync(holdId, Student(1)));

        foreach (var response in responses)
        {
            response.StatusCode.ShouldBe(HttpStatusCode.OK);
            (await response.Json()).GetProperty("status").GetString().ShouldBe("CONFIRMED");
        }

        var seats = await app.GetClassAsync(classId);
        seats.GetProperty("confirmedSeats").GetInt32().ShouldBe(1);
        seats.GetProperty("heldSeats").GetInt32().ShouldBe(0);
        seats.GetProperty("availableSeats").GetInt32().ShouldBe(4);
        (await app.ScalarAsync<long>("SELECT count(*) FROM holds WHERE status = 'CONFIRMED'")).ShouldBe(1);
    }

    [Fact]
    public async Task A_student_cannot_confirm_or_cancel_someone_elses_hold()
    {
        await using var app = await TestApp.StartAsync();
        var classId = await app.CreateClassAsync("Ownership", 3);
        var holdId = await app.HoldAsync(classId, Student(1));

        var confirm = await app.ConfirmAsync(holdId, Student(2));
        var cancel = await app.CancelAsync(holdId, Student(2));

        confirm.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await confirm.Code()).ShouldBe("NOT_YOUR_HOLD");
        cancel.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await cancel.Code()).ShouldBe("NOT_YOUR_HOLD");
        (await app.StoredStatusAsync(holdId)).ShouldBe("HELD", "the hold is untouched");
    }

    [Fact]
    public async Task Cancelling_frees_the_seat_and_returns_204_with_no_body()
    {
        await using var app = await TestApp.StartAsync();
        var classId = await app.CreateClassAsync("Cancel", 1);
        var holdId = await app.HoldAsync(classId, Student(1));

        var response = await app.CancelAsync(holdId, Student(1));

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await response.Content.ReadAsByteArrayAsync()).Length.ShouldBe(0);
        (await app.GetHoldAsync(holdId)).GetProperty("status").GetString().ShouldBe("CANCELLED");
        (await app.GetClassAsync(classId)).GetProperty("availableSeats").GetInt32().ShouldBe(1);

        // Someone else can now take the seat.
        (await app.ApplyAsync(classId, Student(2))).StatusCode.ShouldBe(HttpStatusCode.Created);
    }

    [Fact]
    public async Task Cancelling_twice_is_204_both_times()
    {
        await using var app = await TestApp.StartAsync();
        var holdId = await app.HoldAsync(await app.CreateClassAsync("Twice", 1), Student(1));

        (await app.CancelAsync(holdId, Student(1))).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await app.CancelAsync(holdId, Student(1))).StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task A_cancelled_hold_cannot_be_confirmed()
    {
        await using var app = await TestApp.StartAsync();
        var holdId = await app.HoldAsync(await app.CreateClassAsync("Gone", 1), Student(1));
        await app.CancelAsync(holdId, Student(1));

        var response = await app.ConfirmAsync(holdId, Student(1));

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await response.Code()).ShouldBe("HOLD_CANCELLED");
    }

    [Fact]
    public async Task A_confirmed_admission_cannot_be_cancelled_and_keeps_its_seat()
    {
        // WHY: it has been paid for; undoing it would be a refund, which is out of scope.
        await using var app = await TestApp.StartAsync();
        var classId = await app.CreateClassAsync("Paid", 1);
        var holdId = await app.HoldAsync(classId, Student(1));
        await app.ConfirmAsync(holdId, Student(1));

        var response = await app.CancelAsync(holdId, Student(1));

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await response.Code()).ShouldBe("HOLD_ALREADY_CONFIRMED");
        (await app.GetClassAsync(classId)).GetProperty("confirmedSeats").GetInt32().ShouldBe(1);
    }

    [Fact]
    public async Task After_cancelling_the_student_may_apply_again_but_not_after_confirming()
    {
        await using var app = await TestApp.StartAsync();
        var classId = await app.CreateClassAsync("Again", 3);
        var first = await app.HoldAsync(classId, Student(1));
        await app.CancelAsync(first, Student(1));

        var second = await app.HoldAsync(classId, Student(1));
        second.ShouldNotBe(first);
        await app.ConfirmAsync(second, Student(1));

        var third = await app.ApplyAsync(classId, Student(1));
        third.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await third.Code()).ShouldBe("ACTIVE_HOLD_EXISTS");
    }

    [Fact]
    public async Task Confirm_and_cancel_racing_on_one_hold_have_exactly_one_winner()
    {
        // WHY: a seat must end up either paid for or released, never both and never neither.
        await using var app = await TestApp.StartAsync();
        var classId = await app.CreateClassAsync("Race", 30);

        for (var i = 0; i < 20; i++)
        {
            var holdId = await app.HoldAsync(classId, Student(i));

            var responses = await FireTogether(2, n =>
                n == 0 ? app.ConfirmAsync(holdId, Student(i)) : app.CancelAsync(holdId, Student(i)));
            var (confirm, cancel) = (responses[0], responses[1]);

            var stored = await app.StoredStatusAsync(holdId);
            if (stored == "CONFIRMED")
            {
                confirm.StatusCode.ShouldBe(HttpStatusCode.OK);
                cancel.StatusCode.ShouldBe(HttpStatusCode.Conflict);
                (await cancel.Code()).ShouldBe("HOLD_ALREADY_CONFIRMED");
            }
            else
            {
                stored.ShouldBe("CANCELLED");
                cancel.StatusCode.ShouldBe(HttpStatusCode.NoContent);
                confirm.StatusCode.ShouldBe(HttpStatusCode.Conflict);
                (await confirm.Code()).ShouldBe("HOLD_CANCELLED");
            }
        }
    }

    [Theory]
    [InlineData("6f9619ff-8b86-d011-b42d-00c04fc964ff")]
    [InlineData("h_789")]
    public async Task Confirming_or_cancelling_an_unknown_hold_is_404(string holdId)
    {
        await using var app = await TestApp.StartAsync();

        var confirm = await app.ConfirmAsync(holdId, Student(1));
        var cancel = await app.CancelAsync(holdId, Student(1));

        confirm.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await confirm.Code()).ShouldBe("HOLD_NOT_FOUND");
        cancel.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await cancel.Code()).ShouldBe("HOLD_NOT_FOUND");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("not-a-student-id")]
    public async Task Confirm_and_cancel_require_a_valid_student_id(string? studentId)
    {
        await using var app = await TestApp.StartAsync();
        var holdId = await app.HoldAsync(await app.CreateClassAsync("Header", 1), Student(1));

        var confirm = await app.ConfirmAsync(holdId, studentId);
        var cancel = await app.CancelAsync(holdId, studentId);

        confirm.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await confirm.Code()).ShouldBe("INVALID_STUDENT_ID");
        cancel.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await cancel.Code()).ShouldBe("INVALID_STUDENT_ID");
        (await app.StoredStatusAsync(holdId)).ShouldBe("HELD");
    }
}
