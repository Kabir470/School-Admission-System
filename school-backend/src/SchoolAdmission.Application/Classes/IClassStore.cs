namespace SchoolAdmission.Application.Classes;

public interface IClassStore
{
    /// <summary>Inserts the class. Returns null when the name is already taken (case-insensitive).</summary>
    Task<ClassCreated?> InsertAsync(string name, int totalSeats, CancellationToken ct);

    /// <summary>All classes with live seat counts, ordered by name.</summary>
    Task<IReadOnlyList<ClassSeats>> ListAsync(CancellationToken ct);

    Task<ClassSeats?> GetAsync(Guid classId, CancellationToken ct);
}
