namespace SchoolAdmission.Application;

/// <summary>Runtime settings, read from environment variables and validated at startup.</summary>
public sealed record AdmissionOptions
{
    /// <summary>HOLD_DURATION_SECONDS. How long a seat stays held before it expires.</summary>
    public int HoldDurationSeconds { get; init; } = 600;

    /// <summary>SWEEPER_ENABLED. Off in integration tests, which call the sweep directly.</summary>
    public bool SweeperEnabled { get; init; } = true;

    /// <summary>SWEEP_INTERVAL_SECONDS. How often the sweeper writes EXPIRED on overdue holds.</summary>
    public int SweepIntervalSeconds { get; init; } = 5;

    /// <summary>SWEEP_BATCH_SIZE. Rows per sweep statement.</summary>
    public int SweepBatchSize { get; init; } = 500;
}
