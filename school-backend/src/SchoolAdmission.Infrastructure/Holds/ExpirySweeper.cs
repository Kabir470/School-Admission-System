using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SchoolAdmission.Application;
using SchoolAdmission.Application.Holds;

namespace SchoolAdmission.Infrastructure.Holds;

/// <summary>
/// Writes EXPIRED on overdue holds every few seconds, in every backend process.
/// This is for timeliness of the stored status only. Correctness never depends on it:
/// reads and the hold transaction already ignore overdue holds (ADR 0002).
/// </summary>
public sealed class ExpirySweeper(
    IServiceScopeFactory scopeFactory,
    AdmissionOptions options,
    ILogger<ExpirySweeper> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.SweeperEnabled)
        {
            logger.LogInformation("Expiry sweeper is disabled (SWEEPER_ENABLED=false).");
            return;
        }

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(options.SweepIntervalSeconds));
        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                await SweepAsync(stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Normal shutdown.
        }
    }

    private async Task SweepAsync(CancellationToken ct)
    {
        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var expired = await scope.ServiceProvider.GetRequiredService<ISweepRunner>().RunOnceAsync(ct);
            if (expired > 0)
            {
                logger.LogInformation("Expiry sweeper marked {Count} hold(s) as EXPIRED.", expired);
            }
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            // One bad tick (for example the database restarting) must not stop the
            // sweeper for the rest of the process's life. Log it and try again next tick.
            logger.LogError(e, "Expiry sweep failed; will retry on the next tick.");
        }
    }
}
