namespace SchoolAdmission.Application.Classes;

public sealed record ClassCreated(Guid Id, string Name, int TotalSeats);

/// <summary>A class with its live seat counts. Counts are computed from hold rows, never stored.</summary>
public sealed record ClassSeats(Guid Id, string Name, int TotalSeats, int HeldSeats, int ConfirmedSeats)
{
    public int AvailableSeats => TotalSeats - HeldSeats - ConfirmedSeats;
}
