using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SchoolAdmission.Application;
using SchoolAdmission.Application.Classes;
using SchoolAdmission.Application.Holds;
using SchoolAdmission.Infrastructure.Classes;
using SchoolAdmission.Infrastructure.Holds;

namespace SchoolAdmission.Infrastructure;

public static class DependencyInjection
{
    public const string ConnectionStringName = "Default";

    public static IServiceCollection AddAdmission(this IServiceCollection services)
    {
        // Settings are resolved from IConfiguration when first needed, not while services
        // are being registered, so a host that layers configuration late (the integration
        // tests do) is honoured. Program.cs resolves both at startup to fail fast.
        services.AddSingleton(sp => LoadOptions(sp.GetRequiredService<IConfiguration>()));

        services.AddDbContext<AdmissionDbContext>((sp, db) =>
            db.UseNpgsql(RequireConnectionString(sp.GetRequiredService<IConfiguration>())));

        services.AddScoped<IClassStore, ClassStore>();
        services.AddScoped<IHoldStore, HoldStore>();
        services.AddScoped<ISweepRunner, SweepRunner>();
        services.AddScoped<ClassService>();
        services.AddScoped<HoldService>();

        services.AddHostedService<ExpirySweeper>();

        return services;
    }

    public static string RequireConnectionString(IConfiguration configuration)
    {
        var value = configuration.GetConnectionString(ConnectionStringName);
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException(
                "The database connection string is not set. " +
                "Set the environment variable ConnectionStrings__Default.");
        }

        return value;
    }

    public static AdmissionOptions LoadOptions(IConfiguration configuration)
    {
        var defaults = new AdmissionOptions();
        return new AdmissionOptions
        {
            HoldDurationSeconds = PositiveInt(configuration, "HOLD_DURATION_SECONDS", defaults.HoldDurationSeconds),
            SweepIntervalSeconds = PositiveInt(configuration, "SWEEP_INTERVAL_SECONDS", defaults.SweepIntervalSeconds),
            SweepBatchSize = PositiveInt(configuration, "SWEEP_BATCH_SIZE", defaults.SweepBatchSize),
            SweeperEnabled = Bool(configuration, "SWEEPER_ENABLED", defaults.SweeperEnabled),
        };
    }

    // An unset variable uses the default. A set-but-invalid one stops the process:
    // silently falling back would hide a typo such as HOLD_DURATION_SECONDS=10m.
    private static int PositiveInt(IConfiguration configuration, string key, int fallback)
    {
        var raw = configuration[key];
        if (string.IsNullOrWhiteSpace(raw))
        {
            return fallback;
        }

        if (int.TryParse(raw.Trim(), NumberStyles.None, CultureInfo.InvariantCulture, out var value) && value > 0)
        {
            return value;
        }

        throw new InvalidOperationException($"{key} must be a positive whole number, but was '{raw}'.");
    }

    private static bool Bool(IConfiguration configuration, string key, bool fallback)
    {
        var raw = configuration[key];
        if (string.IsNullOrWhiteSpace(raw))
        {
            return fallback;
        }

        if (bool.TryParse(raw.Trim(), out var value))
        {
            return value;
        }

        throw new InvalidOperationException($"{key} must be 'true' or 'false', but was '{raw}'.");
    }
}
