using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace SchoolAdmission.Api.Json;

/// <summary>
/// Writes timestamps as whole-second ISO-8601 UTC ending in "Z" ("2026-11-01T04:10:00Z"),
/// the exact shape of the API contract's examples. The database keeps microseconds.
/// </summary>
public abstract class WholeSecondConverter(bool roundUp) : JsonConverter<DateTimeOffset>
{
    public override DateTimeOffset Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        DateTimeOffset.Parse(reader.GetString()!, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal);

    public override void Write(Utf8JsonWriter writer, DateTimeOffset value, JsonSerializerOptions options)
    {
        var ticks = value.UtcTicks;
        var fraction = ticks % TimeSpan.TicksPerSecond;
        ticks -= fraction;
        if (roundUp && fraction != 0)
        {
            ticks += TimeSpan.TicksPerSecond;
        }

        writer.WriteStringValue(
            new DateTime(ticks, DateTimeKind.Utc).ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture));
    }
}

/// <summary>Default for every timestamp: drop the fraction.</summary>
public sealed class FloorSecondsConverter() : WholeSecondConverter(roundUp: false);

/// <summary>
/// For <c>expiresAt</c> only: round up to the next second. A client that waits until the
/// reported time has passed is then certain the hold really is expired on the server.
/// </summary>
public sealed class CeilingSecondsConverter() : WholeSecondConverter(roundUp: true);
