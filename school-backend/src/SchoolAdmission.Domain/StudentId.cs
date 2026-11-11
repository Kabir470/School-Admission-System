namespace SchoolAdmission.Domain;

/// <summary>A student is identified by a birth registration number: exactly 17 ASCII digits.</summary>
public static class StudentId
{
    public const int Length = 17;

    public static bool IsValid(string? value)
    {
        if (value is null || value.Length != Length)
        {
            return false;
        }

        foreach (var c in value)
        {
            // Not char.IsDigit: that also accepts non-ASCII digits such as Bangla numerals.
            if (c is < '0' or > '9')
            {
                return false;
            }
        }

        return true;
    }
}
