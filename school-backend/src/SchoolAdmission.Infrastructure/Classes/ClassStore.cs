using Microsoft.EntityFrameworkCore;
using Npgsql;
using SchoolAdmission.Application.Classes;

namespace SchoolAdmission.Infrastructure.Classes;

public sealed class ClassStore(AdmissionDbContext db) : IClassStore
{
    private const string NameIndex = "ux_classes_name_ci";

    // Seat counts are computed from hold rows on every read (ADR 0002). A HELD row counts
    // only while its time has not run out on the DATABASE clock, so a seat is free the
    // instant its hold expires, whether or not the sweeper has written EXPIRED yet.
    private const string SeatsSelect = """
        SELECT c.id          AS "Id",
               c.name        AS "Name",
               c.total_seats AS "TotalSeats",
               (count(*) FILTER (WHERE h.status = 'HELD' AND h.expires_at > now()))::int AS "HeldSeats",
               (count(*) FILTER (WHERE h.status = 'CONFIRMED'))::int                     AS "ConfirmedSeats"
          FROM classes c
          LEFT JOIN holds h
                 ON h.class_id = c.id
                AND h.status IN ('HELD', 'CONFIRMED')
        """;

    public async Task<ClassCreated?> InsertAsync(string name, int totalSeats, CancellationToken ct)
    {
        var entity = new ClassEntity { Id = Guid.NewGuid(), Name = name, TotalSeats = totalSeats };
        db.Classes.Add(entity);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation,
            ConstraintName: NameIndex,
        })
        {
            // The unique index on lower(name) is the check. Two parallel creates with the
            // same name cannot both pass it, which a SELECT-then-INSERT could not promise.
            db.Entry(entity).State = EntityState.Detached;
            return null;
        }

        return new ClassCreated(entity.Id, entity.Name, entity.TotalSeats);
    }

    public async Task<IReadOnlyList<ClassSeats>> ListAsync(CancellationToken ct)
    {
        var rows = await db.Database
            .SqlQueryRaw<ClassSeatsRow>(SeatsSelect + " GROUP BY c.id ORDER BY lower(c.name), c.name")
            .ToListAsync(ct);
        return rows.ConvertAll(ToSeats);
    }

    public async Task<ClassSeats?> GetAsync(Guid classId, CancellationToken ct)
    {
        var rows = await db.Database
            .SqlQueryRaw<ClassSeatsRow>(SeatsSelect + " WHERE c.id = {0} GROUP BY c.id", classId)
            .ToListAsync(ct);
        return rows.Count == 0 ? null : ToSeats(rows[0]);
    }

    private static ClassSeats ToSeats(ClassSeatsRow r) =>
        new(r.Id, r.Name, r.TotalSeats, r.HeldSeats, r.ConfirmedSeats);

    private sealed class ClassSeatsRow
    {
        public Guid Id { get; set; }

        public string Name { get; set; } = "";

        public int TotalSeats { get; set; }

        public int HeldSeats { get; set; }

        public int ConfirmedSeats { get; set; }
    }
}
