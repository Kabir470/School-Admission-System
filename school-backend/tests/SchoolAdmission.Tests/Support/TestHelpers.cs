using System.Net.Http.Json;
using System.Text.Json;

namespace SchoolAdmission.Tests.Support;

internal static class TestHelpers
{
    /// <summary>A valid 17-digit birth registration number for student number <paramref name="n"/>.</summary>
    public static string Student(int n) => (20150000000000000L + n).ToString();

    public static async Task<JsonElement> Json(this HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    /// <summary>The "code" field of a ProblemDetails error body.</summary>
    public static async Task<string?> Code(this HttpResponseMessage response) =>
        (await response.Json()).GetProperty("code").GetString();

    /// <summary>
    /// Starts <paramref name="count"/> requests that all wait at one gate and are released
    /// together, so they genuinely overlap instead of running one after another.
    /// </summary>
    public static async Task<HttpResponseMessage[]> FireTogether(int count, Func<int, Task<HttpResponseMessage>> send)
    {
        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var tasks = Enumerable.Range(0, count)
            .Select(i => Task.Run(async () =>
            {
                await gate.Task;
                return await send(i);
            }))
            .ToArray();

        gate.SetResult();
        return await Task.WhenAll(tasks);
    }

    /// <summary>
    /// Polls until the condition holds or the deadline passes. Used instead of a fixed
    /// sleep, so a test waits exactly as long as it needs and never "usually passes".
    /// </summary>
    public static async Task Eventually(Func<Task<bool>> condition, string because, int timeoutSeconds = 15)
    {
        var deadline = DateTime.UtcNow.AddSeconds(timeoutSeconds);
        while (DateTime.UtcNow < deadline)
        {
            if (await condition())
            {
                return;
            }

            await Task.Delay(100);
        }

        throw new ShouldAssertException($"Timed out after {timeoutSeconds}s waiting for: {because}");
    }
}
