namespace SchoolAdmission.Application.Holds;

public interface ISweepRunner
{
    /// <summary>
    /// Writes EXPIRED on every overdue HELD row and returns how many it changed.
    /// Needed only for tidy stored data; reads are already correct without it (ADR 0002).
    /// </summary>
    Task<int> RunOnceAsync(CancellationToken ct = default);
}
