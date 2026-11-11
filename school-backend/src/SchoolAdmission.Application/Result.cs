namespace SchoolAdmission.Application;

/// <summary>An expected failure: a code from <c>ErrorCodes</c> and a sentence for humans.</summary>
public sealed record Error(string Code, string Message);

/// <summary>
/// The outcome of a service call: a value, or an <see cref="Error"/>.
/// Expected failures (seats full, not your hold) travel as values, not exceptions;
/// the API maps the error code to an HTTP status in one place.
/// </summary>
public sealed class Result<T>
{
    private readonly T? _value;

    private Result(T? value, Error? error)
    {
        _value = value;
        Error = error;
    }

    public Error? Error { get; }

    public bool IsSuccess => Error is null;

    public T Value => IsSuccess
        ? _value!
        : throw new InvalidOperationException($"No value: the result failed with {Error!.Code}.");

    public static Result<T> Ok(T value) => new(value, null);

    public static Result<T> Fail(string code, string message) => new(default, new Error(code, message));
}
