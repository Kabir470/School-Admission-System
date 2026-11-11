using Npgsql;

namespace SchoolAdmission.Infrastructure;

public static class DatabaseFailures
{
    /// <summary>
    /// True when the failure means "the database could not be reached or had no free
    /// connection", as opposed to a bug: the database is down or restarting, or every
    /// pooled connection stayed busy until the pool timeout (possible when a rush of
    /// applies is queued on one class's row lock). The caller should retry shortly.
    /// </summary>
    public static bool IsUnavailable(Exception? exception)
    {
        for (var e = exception; e is not null; e = e.InnerException)
        {
            // PostgresException is an error reported BY the server about a statement,
            // so the server is reachable; everything else Npgsql throws is connection-level.
            if (e is NpgsqlException and not PostgresException || e is TimeoutException)
            {
                return true;
            }
        }

        return false;
    }
}
