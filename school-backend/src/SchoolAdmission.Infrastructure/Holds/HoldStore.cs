using Microsoft.EntityFrameworkCore;
using Npgsql;
using SchoolAdmission.Application.Holds;
using SchoolAdmission.Domain;

namespace SchoolAdmission.Infrastructure.Holds;

/// <summary>
/// All hold SQL lives here. Two rules hold for every statement in this file:
/// the database decides (no check in C# followed by a write), and the database clock
/// is the only clock (no DateTime.UtcNow anywhere near an expiry decision).
/// </summary>
public sealed class HoldStore(AdmissionDbContext db) : IHoldStore
{
    /// <summary>
    /// ADR 0001. One transaction; the class row lock makes "count, then insert" safe
    /// against every other apply for the same class, from any backend process.
    /// </summary>
    public async Task<CreateHoldResult> CreateAsync(
        Guid classId, string studentId, int holdSeconds, CancellationToken ct)
    {
        // READ COMMITTED (the default) is enough: the row lock serializes the applies.
        // Disposing the transaction without a commit rolls it back and releases the lock.
        await using var tx = await db.Database.BeginTransactionAsync(ct);

        // 1. Lock the class row. Every other apply for this class waits here until we finish.
        var locked = await db.Database
            .SqlQuery<LockedClassRow>($"""
                SELECT name AS "Name", total_seats AS "TotalSeats"
                  FROM classes
                 WHERE id = {classId}
                   FOR UPDATE
                """)
            .ToListAsync(ct);
        if (locked.Count == 0)
        {
            return new CreateHoldResult(CreateHoldOutcome.ClassNotFound);
        }

        var cls = locked[0];

        // From here on the clock is clock_timestamp(), not now(): now() is frozen at
        // transaction start and is stale by however long we waited in the lock queue.

        // 2. Lazy catch-up: holds of this class whose time ran out stop occupying a seat.
        await db.Database.ExecuteSqlAsync($"""
            UPDATE holds
               SET status = 'EXPIRED', expired_at = clock_timestamp()
             WHERE class_id = {classId}
               AND status = 'HELD'
               AND expires_at <= clock_timestamp()
            """, ct);

        // 3 + 4. Count the active holds, and this student's share of them, under the lock.
        var counts = (await db.Database
            .SqlQuery<ActiveCountsRow>($"""
                SELECT count(*)::int                                          AS "Active",
                       (count(*) FILTER (WHERE student_id = {studentId}))::int AS "Mine"
                  FROM holds
                 WHERE class_id = {classId}
                   AND status IN ('HELD', 'CONFIRMED')
                """)
            .ToListAsync(ct))[0];

        if (counts.Mine > 0)
        {
            return new CreateHoldResult(CreateHoldOutcome.ActiveHoldExists);
        }

        if (counts.Active >= cls.TotalSeats)
        {
            return new CreateHoldResult(CreateHoldOutcome.SeatsFull);
        }

        // 5. Take the seat. The expiry is computed by the database from its own clock.
        var holdId = Guid.NewGuid();
        InsertedRow inserted;
        try
        {
            inserted = (await db.Database
                .SqlQuery<InsertedRow>($"""
                    INSERT INTO holds (id, class_id, student_id, status, created_at, expires_at)
                    SELECT {holdId}, {classId}, {studentId}, 'HELD',
                           t.at, t.at + make_interval(secs => {(double)holdSeconds})
                      FROM (SELECT clock_timestamp() AS at) t
                    RETURNING created_at AS "CreatedAt", expires_at AS "ExpiresAt"
                    """)
                .ToListAsync(ct))[0];
        }
        catch (PostgresException e) when (e.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            // Backstop for step 3: the partial unique index ux_holds_active_per_student.
            return new CreateHoldResult(CreateHoldOutcome.ActiveHoldExists);
        }

        // Not cancellable: if the client disconnects at this instant, the commit must still
        // run to a definite end rather than be abandoned half-way with an unknown outcome.
        await tx.CommitAsync(CancellationToken.None);

        return new CreateHoldResult(
            CreateHoldOutcome.Created,
            new HoldView(
                holdId, classId, cls.Name, studentId, HoldStatus.Held,
                inserted.CreatedAt, inserted.ExpiresAt, ServerTime: inserted.CreatedAt,
                RemainingMs: holdSeconds * 1000L));
    }

    // ADR 0002: a HELD row whose time has run out is reported as EXPIRED on every read,
    // so the answer is right even if no sweeper has touched the row.
    private const string HoldSelect = """
        SELECT h.id         AS "HoldId",
               h.class_id   AS "ClassId",
               c.name       AS "ClassName",
               h.student_id AS "StudentId",
               CASE WHEN h.status = 'HELD' AND h.expires_at <= now()
                    THEN 'EXPIRED' ELSE h.status END AS "Status",
               h.created_at AS "CreatedAt",
               h.expires_at AS "ExpiresAt",
               now()        AS "ServerTime",
               GREATEST(0, ceil(extract(epoch FROM h.expires_at - now()) * 1000))::bigint AS "RemainingMs"
          FROM holds h
          JOIN classes c ON c.id = h.class_id
        """;

    public async Task<HoldView?> GetAsync(Guid holdId, CancellationToken ct)
    {
        var rows = await db.Database
            .SqlQueryRaw<HoldRow>(HoldSelect + " WHERE h.id = {0}", holdId)
            .ToListAsync(ct);
        return rows.Count == 0 ? null : ToView(rows[0]);
    }

    public async Task<IReadOnlyList<HoldView>> ListForStudentAsync(string studentId, CancellationToken ct)
    {
        var rows = await db.Database
            .SqlQueryRaw<HoldRow>(
                HoldSelect + " WHERE h.student_id = {0} ORDER BY h.created_at DESC, h.id",
                studentId)
            .ToListAsync(ct);
        return rows.ConvertAll(ToView);
    }

    public async Task<bool> TryConfirmAsync(Guid holdId, string studentId, CancellationToken ct)
    {
        // One statement decides. Ten parallel confirms: the first changes the row, the other
        // nine re-check the WHERE after it commits, find CONFIRMED, and change nothing.
        var changed = await db.Database.ExecuteSqlAsync($"""
            UPDATE holds
               SET status = 'CONFIRMED', confirmed_at = now()
             WHERE id = {holdId}
               AND student_id = {studentId}
               AND status = 'HELD'
               AND expires_at > now()
            """, ct);
        return changed == 1;
    }

    public async Task<bool> TryCancelAsync(Guid holdId, string studentId, CancellationToken ct)
    {
        var changed = await db.Database.ExecuteSqlAsync($"""
            UPDATE holds
               SET status = 'CANCELLED', cancelled_at = now()
             WHERE id = {holdId}
               AND student_id = {studentId}
               AND status = 'HELD'
               AND expires_at > now()
            """, ct);
        return changed == 1;
    }

    private static HoldView ToView(HoldRow r) =>
        new(r.HoldId, r.ClassId, r.ClassName, r.StudentId, r.Status, r.CreatedAt, r.ExpiresAt, r.ServerTime, r.RemainingMs);

    private sealed class LockedClassRow
    {
        public string Name { get; set; } = "";

        public int TotalSeats { get; set; }
    }

    private sealed class ActiveCountsRow
    {
        public int Active { get; set; }

        public int Mine { get; set; }
    }

    private sealed class InsertedRow
    {
        public DateTimeOffset CreatedAt { get; set; }

        public DateTimeOffset ExpiresAt { get; set; }
    }

    private sealed class HoldRow
    {
        public Guid HoldId { get; set; }

        public Guid ClassId { get; set; }

        public string ClassName { get; set; } = "";

        public string StudentId { get; set; } = "";

        public string Status { get; set; } = "";

        public DateTimeOffset CreatedAt { get; set; }

        public DateTimeOffset ExpiresAt { get; set; }

        public DateTimeOffset ServerTime { get; set; }

        public long RemainingMs { get; set; }
    }
}
