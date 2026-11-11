using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using SchoolAdmission.Application.Holds;

namespace SchoolAdmission.Tests.Support;

/// <summary>One in-memory backend host. Settings arrive the way environment variables do.</summary>
internal sealed class ApiFactory(
    IReadOnlyDictionary<string, string?> settings,
    Action<IServiceCollection>? overrideServices = null) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Production");
        foreach (var (key, value) in settings)
        {
            builder.UseSetting(key, value);
        }

        if (overrideServices is not null)
        {
            builder.ConfigureTestServices(overrideServices);
        }
    }
}

/// <summary>
/// A throwaway PostgreSQL database with the real schema applied, plus one or more backend
/// hosts running against it. Every test gets its own, so tests cannot affect each other.
/// The background sweeper is off unless a test asks for it; tests call the sweep directly.
/// </summary>
internal sealed class TestApp : IAsyncDisposable
{
    private static readonly string AdminConnectionString =
        Environment.GetEnvironmentVariable("TEST_DB_CONNECTION")
        ?? "Host=localhost;Port=55432;Username=postgres;Password=postgres;Database=postgres";

    private readonly string _databaseName;
    private readonly Dictionary<string, string?> _settings;
    private readonly List<ApiFactory> _hosts = [];

    private TestApp(string databaseName, Dictionary<string, string?> settings)
    {
        _databaseName = databaseName;
        _settings = settings;
        ConnectionString = settings["ConnectionStrings:Default"]!;
        Client = AddHost();
    }

    public string ConnectionString { get; }

    /// <summary>Client of the first host.</summary>
    public HttpClient Client { get; }

    public IServiceProvider Services => _hosts[0].Services;

    public static async Task<TestApp> StartAsync(
        int holdSeconds = 600,
        bool sweeperEnabled = false,
        int sweepIntervalSeconds = 1,
        int sweepBatchSize = 500)
    {
        var databaseName = "sas_test_" + Guid.NewGuid().ToString("N");

        await using (var admin = new NpgsqlConnection(AdminConnectionString))
        {
            await admin.OpenAsync();
            await using var create = new NpgsqlCommand($"CREATE DATABASE {databaseName}", admin);
            await create.ExecuteNonQueryAsync();
        }

        var connectionString = new NpgsqlConnectionStringBuilder(AdminConnectionString)
        {
            Database = databaseName,
            MaxPoolSize = 30,
            Timeout = 60,
            IncludeErrorDetail = true,
        }.ConnectionString;

        var schema = await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "db", "001_schema.sql"));
        await using (var connection = new NpgsqlConnection(connectionString))
        {
            await connection.OpenAsync();
            await using var apply = new NpgsqlCommand(schema, connection);
            await apply.ExecuteNonQueryAsync();
        }

        return new TestApp(databaseName, new Dictionary<string, string?>
        {
            ["ConnectionStrings:Default"] = connectionString,
            ["HOLD_DURATION_SECONDS"] = holdSeconds.ToString(),
            ["SWEEPER_ENABLED"] = sweeperEnabled ? "true" : "false",
            ["SWEEP_INTERVAL_SECONDS"] = sweepIntervalSeconds.ToString(),
            ["SWEEP_BATCH_SIZE"] = sweepBatchSize.ToString(),
        });
    }

    /// <summary>Starts another backend host on the same database, like a second process would be.</summary>
    public HttpClient AddHost(
        IReadOnlyDictionary<string, string?>? extraSettings = null,
        Action<IServiceCollection>? overrideServices = null)
    {
        var settings = new Dictionary<string, string?>(_settings);
        foreach (var (key, value) in extraSettings ?? new Dictionary<string, string?>())
        {
            settings[key] = value;
        }

        var host = new ApiFactory(settings, overrideServices);
        _hosts.Add(host);
        return host.CreateClient();
    }

    // ---- API helpers ---------------------------------------------------------------

    public async Task<string> CreateClassAsync(string name, int totalSeats)
    {
        var response = await Client.PostAsJsonAsync("/classes", new { name, totalSeats });
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.Created, await response.Content.ReadAsStringAsync());
        return (await response.Json()).GetProperty("id").GetString()!;
    }

    public Task<HttpResponseMessage> ApplyAsync(string classId, string? studentId, HttpClient? client = null) =>
        Send(client, HttpMethod.Post, $"/classes/{classId}/holds", studentId);

    /// <summary>Applies and returns the new hold's id; fails the test if the apply did not succeed.</summary>
    public async Task<string> HoldAsync(string classId, string studentId)
    {
        var response = await ApplyAsync(classId, studentId);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.Created, await response.Content.ReadAsStringAsync());
        return (await response.Json()).GetProperty("holdId").GetString()!;
    }

    public Task<HttpResponseMessage> ConfirmAsync(string holdId, string? studentId) =>
        Send(null, HttpMethod.Post, $"/holds/{holdId}/confirm", studentId);

    public Task<HttpResponseMessage> CancelAsync(string holdId, string? studentId) =>
        Send(null, HttpMethod.Delete, $"/holds/{holdId}", studentId);

    public Task<HttpResponseMessage> MyHoldsAsync(string? studentId) =>
        Send(null, HttpMethod.Get, "/me/holds", studentId);

    public async Task<JsonElement> GetHoldAsync(string holdId) =>
        await (await Client.GetAsync($"/holds/{holdId}")).Json();

    public async Task<JsonElement> GetClassAsync(string classId) =>
        await (await Client.GetAsync($"/classes/{classId}")).Json();

    private Task<HttpResponseMessage> Send(HttpClient? client, HttpMethod method, string path, string? studentId)
    {
        var request = new HttpRequestMessage(method, path);
        if (studentId is not null)
        {
            request.Headers.TryAddWithoutValidation("X-Student-Id", studentId);
        }

        return (client ?? Client).SendAsync(request);
    }

    // ---- Direct access, for assertions the API cannot make -------------------------

    public async Task<int> RunSweepAsync()
    {
        await using var scope = Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<ISweepRunner>().RunOnceAsync();
    }

    public async Task<T> ScalarAsync<T>(string sql, params object[] parameters)
    {
        await using var connection = new NpgsqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        foreach (var parameter in parameters)
        {
            command.Parameters.Add(new NpgsqlParameter { Value = parameter });
        }

        return (T)(await command.ExecuteScalarAsync())!;
    }

    /// <summary>The status actually stored in the row, which may lag the effective status.</summary>
    public Task<string> StoredStatusAsync(string holdId) =>
        ScalarAsync<string>("SELECT status FROM holds WHERE id = $1", Guid.Parse(holdId));

    public async Task<int> ActiveHoldCountAsync(string classId) =>
        (int)await ScalarAsync<long>(
            "SELECT count(*) FROM holds WHERE class_id = $1 AND status IN ('HELD','CONFIRMED')",
            Guid.Parse(classId));

    /// <summary>Inserts a HELD row whose time ran out an hour ago, as if nobody had paid.</summary>
    public async Task<string> InsertOverdueHoldAsync(string classId, string studentId)
    {
        var id = Guid.NewGuid();
        await ScalarAsync<Guid>(
            """
            INSERT INTO holds (id, class_id, student_id, status, created_at, expires_at)
            VALUES ($1, $2, $3, 'HELD', now() - interval '2 hours', now() - interval '1 hour')
            RETURNING id
            """,
            id, Guid.Parse(classId), studentId);
        return id.ToString();
    }

    public async ValueTask DisposeAsync()
    {
        foreach (var host in _hosts)
        {
            await host.DisposeAsync();
        }

        await using var admin = new NpgsqlConnection(AdminConnectionString);
        await admin.OpenAsync();
        await using var drop = new NpgsqlCommand($"DROP DATABASE IF EXISTS {_databaseName} WITH (FORCE)", admin);
        await drop.ExecuteNonQueryAsync();
    }
}
