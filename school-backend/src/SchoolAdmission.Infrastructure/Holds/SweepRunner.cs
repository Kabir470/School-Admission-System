using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Application;
using SchoolAdmission.Application.Holds;

namespace SchoolAdmission.Infrastructure.Holds;

public sealed class SweepRunner(AdmissionDbContext db, AdmissionOptions options) : ISweepRunner
{
    public async Task<int> RunOnceAsync(CancellationToken ct = default)
    {
        var batchSize = options.SweepBatchSize;
        var total = 0;

        while (true)
        {
            // SKIP LOCKED: a row another sweeper (another backend process) is already
            // expiring is left to it. Sweepers never wait on each other and never
            // count the same row twice, so no leader election is needed.
            var changed = await db.Database.ExecuteSqlAsync($"""
                UPDATE holds
                   SET status = 'EXPIRED', expired_at = now()
                 WHERE id IN (
                       SELECT id
                         FROM holds
                        WHERE status = 'HELD'
                          AND expires_at <= now()
                        ORDER BY expires_at
                        LIMIT {batchSize}
                          FOR UPDATE SKIP LOCKED)
                """, ct);

            if (changed == 0)
            {
                return total;
            }

            total += changed;
        }
    }
}
