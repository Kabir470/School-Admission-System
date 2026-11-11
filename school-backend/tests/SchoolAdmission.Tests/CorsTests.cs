using System.Net;
using SchoolAdmission.Tests.Support;

namespace SchoolAdmission.Tests;

/// <summary>
/// Story 007: the UI runs on another origin (port 3000), so the browser asks permission
/// before sending X-Student-Id. Only origins listed in CORS_ORIGINS get it.
/// </summary>
public class CorsTests
{
    private static HttpRequestMessage Preflight(string origin, string method, string path)
    {
        var request = new HttpRequestMessage(HttpMethod.Options, path);
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", method);
        request.Headers.Add("Access-Control-Request-Headers", "content-type,x-student-id");
        return request;
    }

    [Theory]
    [InlineData("POST", "/classes/6f9619ff-8b86-d011-b42d-00c04fc964ff/holds")]
    [InlineData("DELETE", "/holds/6f9619ff-8b86-d011-b42d-00c04fc964ff")]
    public async Task The_default_ui_origin_may_send_the_student_header(string method, string path)
    {
        await using var app = await TestApp.StartAsync();

        var response = await app.Client.SendAsync(Preflight("http://localhost:3000", method, path));

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        response.Headers.GetValues("Access-Control-Allow-Origin").ShouldBe(["http://localhost:3000"]);
        string.Join(",", response.Headers.GetValues("Access-Control-Allow-Headers")).ToLowerInvariant()
            .ShouldContain("x-student-id");
        string.Join(",", response.Headers.GetValues("Access-Control-Allow-Methods")).ShouldContain(method);
    }

    [Fact]
    public async Task An_origin_that_is_not_listed_gets_no_cors_permission()
    {
        await using var app = await TestApp.StartAsync();

        var response = await app.Client.SendAsync(Preflight("http://evil.example", "POST", "/classes"));

        response.Headers.Contains("Access-Control-Allow-Origin").ShouldBeFalse();
    }

    [Fact]
    public async Task Allowed_origins_come_from_the_cors_origins_setting()
    {
        await using var app = await TestApp.StartAsync();
        var client = app.AddHost(new Dictionary<string, string?>
        {
            ["CORS_ORIGINS"] = "http://localhost:3000, http://school.example:8088",
        });

        var response = await client.SendAsync(Preflight("http://school.example:8088", "POST", "/classes"));

        response.Headers.GetValues("Access-Control-Allow-Origin").ShouldBe(["http://school.example:8088"]);
    }
}
