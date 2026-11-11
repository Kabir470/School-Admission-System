using SchoolAdmission.Domain;

namespace SchoolAdmission.Application.Classes;

public sealed class ClassService(IClassStore store)
{
    public async Task<Result<ClassCreated>> CreateAsync(string? name, int? totalSeats, CancellationToken ct)
    {
        var normalized = ClassRules.NormalizeName(name, out var problem);
        if (normalized is null)
        {
            return Result<ClassCreated>.Fail(ErrorCodes.ValidationFailed, problem!);
        }

        if (totalSeats is not { } seats || !ClassRules.IsValidSeatCount(seats))
        {
            return Result<ClassCreated>.Fail(
                ErrorCodes.ValidationFailed,
                $"totalSeats must be a whole number from {ClassRules.MinSeats} to {ClassRules.MaxSeats}.");
        }

        // No "does the name exist?" pre-check: that would be a race. The unique index decides.
        var created = await store.InsertAsync(normalized, seats, ct);
        return created is null
            ? Result<ClassCreated>.Fail(ErrorCodes.ClassNameTaken, $"A class named '{normalized}' already exists.")
            : Result<ClassCreated>.Ok(created);
    }

    public Task<IReadOnlyList<ClassSeats>> ListAsync(CancellationToken ct) => store.ListAsync(ct);

    public async Task<Result<ClassSeats>> GetAsync(string classId, CancellationToken ct)
    {
        var found = Guid.TryParse(classId, out var id) ? await store.GetAsync(id, ct) : null;
        return found is null
            ? Result<ClassSeats>.Fail(ErrorCodes.ClassNotFound, "Class not found.")
            : Result<ClassSeats>.Ok(found);
    }
}
