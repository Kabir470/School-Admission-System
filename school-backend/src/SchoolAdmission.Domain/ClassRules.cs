namespace SchoolAdmission.Domain;

/// <summary>Validation rules for a class (one class + shift).</summary>
public static class ClassRules
{
    public const int MaxNameLength = 100;
    public const int MinSeats = 1;
    public const int MaxSeats = 10_000;

    /// <summary>Returns the trimmed name, or null with a reason when the name is not acceptable.</summary>
    public static string? NormalizeName(string? name, out string? problem)
    {
        var trimmed = name?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            problem = "name is required.";
            return null;
        }

        if (trimmed.Length > MaxNameLength)
        {
            problem = $"name must be at most {MaxNameLength} characters.";
            return null;
        }

        // Control characters have no place in a name, and PostgreSQL refuses a NUL in
        // text outright, which would otherwise surface as a 500.
        if (trimmed.Any(char.IsControl))
        {
            problem = "name must not contain control characters.";
            return null;
        }

        problem = null;
        return trimmed;
    }

    public static bool IsValidSeatCount(int totalSeats) => totalSeats is >= MinSeats and <= MaxSeats;
}
