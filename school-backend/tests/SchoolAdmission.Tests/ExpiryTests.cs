using System.Net;
using SchoolAdmission.Tests.Support;
using static SchoolAdmission.Tests.Support.TestHelpers;

namespace SchoolAdmission.Tests;

/// <summary>
/// Stories 004 and 006: a hold expires on its own. Lazy expiry on reads is the guarantee;
/// the sweeper only makes the stored status catch up (ADR 0002).
/// </summary>
public class ExpiryTests
{
    [Fact]
    public async Task An_unpaid_hold_expires_and_frees_its_seat_with_no_api_call_and_no_sweeper()
    {
        // WHY: "the seat returns on its own". The sweeper is off for this whole test, so
        // only the read-time rule (HELD and not yet overdue) can make this pass.
        await using var app = await TestApp.StartAsync(holdSeconds: 1, sweeperEnabled: false);
        var classId = await app.CreateClassAsync("Class 6 - Morning Shift", 1);
        var holdId = await app.HoldAsync(classId, Student(1));
        (await app.ApplyAsync(classId, Student(2))).StatusCode.ShouldBe(HttpStatusCode.Conflict, "the only seat is held");

        // Lazy path: wait for the time to run out (polling, no fixed sleep).
        await Eventually(
            async () => (await app.GetHoldAsync(holdId)).GetProperty("status").GetString() == "EXPIRED",
            "the hold to read as EXPIRED");
        (await app.StoredStatusAsync(holdId)).ShouldBe("HELD", "nothing has written to the row; the read derived EXPIRED");
        (await app.GetHoldAsync(holdId)).GetProperty("remainingMs").GetInt64().ShouldBe(0, "time left never goes negative");
        var seats = await app.GetClassAsync(classId);
        seats.GetProperty("heldSeats").GetInt32().ShouldBe(0);
        seats.GetProperty("availableSeats").GetInt32().ShouldBe(1);
        var mine = (await (await app.MyHoldsAsync(Student(1))).Json()).EnumerateArray().Single();
        mine.GetProperty("status").GetString().ShouldBe("EXPIRED");

        // An overdue hold cannot be paid for or cancelled, even though its row still says HELD.
        var confirm = await app.ConfirmAsync(holdId, Student(1));
        confirm.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await confirm.Code()).ShouldBe("HOLD_EXPIRED");
        var cancel = await app.CancelAsync(holdId, Student(1));
        cancel.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await cancel.Code()).ShouldBe("HOLD_EXPIRED");
        (await app.StoredStatusAsync(holdId)).ShouldBe("HELD");

        // Sweeper path: one sweep writes the status down.
        (await app.RunSweepAsync()).ShouldBe(1);
        (await app.StoredStatusAsync(holdId)).ShouldBe("EXPIRED");
        (await app.GetHoldAsync(holdId)).GetProperty("status").GetString().ShouldBe("EXPIRED");
        var confirmAfterSweep = await app.ConfirmAsync(holdId, Student(1));
        confirmAfterSweep.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await confirmAfterSweep.Code()).ShouldBe("HOLD_EXPIRED");

        // The freed seat can be taken, and the same student may apply again.
        (await app.ApplyAsync(classId, Student(1))).StatusCode.ShouldBe(HttpStatusCode.Created);
    }

    [Fact]
    public async Task The_reported_expiry_time_is_never_earlier_than_the_real_one()
    {
        // WHY: expiresAt is sent in whole seconds, rounded UP. A client that waits until
        // the reported time has passed must find the hold expired, never still HELD.
        await using var app = await TestApp.StartAsync(holdSeconds: 2);
        var classId = await app.CreateClassAsync("Rounding", 1);
        var holdId = await app.HoldAsync(classId, Student(1));

        var reported = (await app.GetHoldAsync(holdId)).GetProperty("expiresAt").GetDateTimeOffset();
        var stored = await app.ScalarAsync<DateTime>("SELECT expires_at FROM holds WHERE id = $1", Guid.Parse(holdId));

        reported.Millisecond.ShouldBe(0);
        (reported.UtcDateTime - stored).TotalSeconds.ShouldBeInRange(0, 1);
    }

    [Fact]
    public async Task A_sweep_expires_every_overdue_hold_and_nothing_else()
    {
        await using var app = await TestApp.StartAsync(sweepBatchSize: 2); // smaller than the overdue set
        var classId = await app.CreateClassAsync("Sweep", 20);
        var live = await app.HoldAsync(classId, Student(10));
        var confirmed = await app.HoldAsync(classId, Student(11));
        await app.ConfirmAsync(confirmed, Student(11));
        var cancelled = await app.HoldAsync(classId, Student(12));
        await app.CancelAsync(cancelled, Student(12));

        // Seeded last: an apply to this class would itself expire overdue holds (its lazy
        // catch-up), and this test is about the sweeper doing it.
        var overdue = new List<string>();
        for (var i = 0; i < 5; i++)
        {
            overdue.Add(await app.InsertOverdueHoldAsync(classId, Student(i)));
        }

        (await app.RunSweepAsync()).ShouldBe(5, "one call must work through several batches");

        foreach (var id in overdue)
        {
            (await app.StoredStatusAsync(id)).ShouldBe("EXPIRED");
        }

        (await app.ScalarAsync<long>("SELECT count(*) FROM holds WHERE status = 'EXPIRED' AND expired_at IS NULL"))
            .ShouldBe(0, "expired_at records when the status was written");
        (await app.StoredStatusAsync(live)).ShouldBe("HELD");
        (await app.StoredStatusAsync(confirmed)).ShouldBe("CONFIRMED");
        (await app.StoredStatusAsync(cancelled)).ShouldBe("CANCELLED");
        (await app.RunSweepAsync()).ShouldBe(0, "a second sweep has nothing left to do");
    }

    [Fact]
    public async Task Sweepers_running_at_the_same_moment_never_expire_the_same_hold_twice()
    {
        // WHY: every backend process runs a sweeper. FOR UPDATE SKIP LOCKED must split the
        // work between them with no double-processing and no waiting.
        await using var app = await TestApp.StartAsync(sweepBatchSize: 5);
        var classId = await app.CreateClassAsync("Many sweepers", 100);
        for (var i = 0; i < 60; i++)
        {
            await app.InsertOverdueHoldAsync(classId, Student(i));
        }

        var counts = await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => Task.Run(app.RunSweepAsync)));

        counts.Sum().ShouldBe(60);
        (await app.ScalarAsync<long>("SELECT count(*) FROM holds WHERE status = 'HELD'")).ShouldBe(0);
    }

    [Fact]
    public async Task The_background_sweeper_writes_expired_on_its_own_timer()
    {
        // WHY: proves the hosted service is really wired to the timer, not only that the
        // runner works when called by hand. No API call is made while waiting.
        await using var app = await TestApp.StartAsync(holdSeconds: 1, sweeperEnabled: true, sweepIntervalSeconds: 1);
        var classId = await app.CreateClassAsync("Timer", 1);
        var holdId = await app.HoldAsync(classId, Student(1));

        await Eventually(
            async () => await app.StoredStatusAsync(holdId) == "EXPIRED",
            "the background sweeper to write EXPIRED into the row");
    }
}
