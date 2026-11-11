using System.Net;
using SchoolAdmission.Tests.Support;
using static SchoolAdmission.Tests.Support.TestHelpers;

namespace SchoolAdmission.Tests;

/// <summary>
/// The core guarantee: for a class, held + confirmed never exceeds totalSeats, however
/// many requests arrive at once and however many backend processes serve them (ADR 0001).
/// </summary>
public class HoldConcurrencyTests
{
    [Fact]
    public async Task Two_hundred_simultaneous_applies_for_ten_seats_give_exactly_ten_holds()
    {
        // WHY: this is the rush when admission opens. A "count, then insert" without the
        // class row lock lets several requests see the same free seat and overbooks.
        await using var app = await TestApp.StartAsync();
        var classId = await app.CreateClassAsync("Class 6 - Morning Shift", 10);

        var responses = await FireTogether(200, i => app.ApplyAsync(classId, Student(i)));

        responses.Count(r => r.StatusCode == HttpStatusCode.Created).ShouldBe(10);
        var rejected = responses.Where(r => r.StatusCode != HttpStatusCode.Created).ToArray();
        rejected.Length.ShouldBe(190);
        foreach (var response in rejected)
        {
            response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
            (await response.Code()).ShouldBe("SEATS_FULL");
        }

        (await app.ActiveHoldCountAsync(classId)).ShouldBe(10, "the database must hold exactly totalSeats active holds");
        var seats = await app.GetClassAsync(classId);
        seats.GetProperty("heldSeats").GetInt32().ShouldBe(10);
        seats.GetProperty("availableSeats").GetInt32().ShouldBe(0);
    }

    [Fact]
    public async Task Twenty_simultaneous_applies_by_one_student_give_exactly_one_hold()
    {
        // WHY: a parent double-clicking, or retrying on a slow network, must not take
        // several seats in the same class.
        await using var app = await TestApp.StartAsync();
        var classId = await app.CreateClassAsync("Class 6 - Day Shift", 50);

        var responses = await FireTogether(20, _ => app.ApplyAsync(classId, Student(1)));

        responses.Count(r => r.StatusCode == HttpStatusCode.Created).ShouldBe(1);
        var rejected = responses.Where(r => r.StatusCode != HttpStatusCode.Created).ToArray();
        rejected.Length.ShouldBe(19);
        foreach (var response in rejected)
        {
            response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
            (await response.Code()).ShouldBe("ACTIVE_HOLD_EXISTS");
        }

        (await app.ActiveHoldCountAsync(classId)).ShouldBe(1);
    }

    [Fact]
    public async Task Two_backend_hosts_on_one_database_still_never_exceed_the_seats()
    {
        // WHY (bonus): the guard is a row lock inside PostgreSQL, not a lock inside one
        // process, so a second backend on another port cannot get around it.
        await using var app = await TestApp.StartAsync();
        var second = app.AddHost();
        var classId = await app.CreateClassAsync("Class 7 - Morning Shift", 10);

        var responses = await FireTogether(100, i =>
            app.ApplyAsync(classId, Student(i), i % 2 == 0 ? app.Client : second));

        responses.Count(r => r.StatusCode == HttpStatusCode.Created).ShouldBe(10);
        responses.Count(r => r.StatusCode == HttpStatusCode.Conflict).ShouldBe(90);
        (await app.ActiveHoldCountAsync(classId)).ShouldBe(10);

        // Both hosts see the same truth.
        foreach (var client in new[] { app.Client, second })
        {
            var seats = await (await client.GetAsync($"/classes/{classId}")).Json();
            seats.GetProperty("availableSeats").GetInt32().ShouldBe(0);
        }
    }

    [Fact]
    public async Task Applies_for_different_classes_do_not_take_each_others_seats()
    {
        await using var app = await TestApp.StartAsync();
        var morning = await app.CreateClassAsync("Class 8 - Morning Shift", 5);
        var day = await app.CreateClassAsync("Class 8 - Day Shift", 5);

        var responses = await FireTogether(40, i => app.ApplyAsync(i % 2 == 0 ? morning : day, Student(i)));

        responses.Count(r => r.StatusCode == HttpStatusCode.Created).ShouldBe(10);
        (await app.ActiveHoldCountAsync(morning)).ShouldBe(5);
        (await app.ActiveHoldCountAsync(day)).ShouldBe(5);
    }
}
