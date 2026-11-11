using Microsoft.EntityFrameworkCore;

namespace SchoolAdmission.Infrastructure;

public sealed class ClassEntity
{
    public Guid Id { get; set; }

    public string Name { get; set; } = "";

    public int TotalSeats { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary>
/// Database-first (ADR 0003): this context maps onto tables created by
/// <c>backend/db/init/001_schema.sql</c>. It must never create or migrate the schema.
/// It owns the connection and transactions; holds are read and written with explicit SQL
/// because every hold query depends on the database clock.
/// </summary>
public sealed class AdmissionDbContext(DbContextOptions<AdmissionDbContext> options) : DbContext(options)
{
    public DbSet<ClassEntity> Classes => Set<ClassEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ClassEntity>(e =>
        {
            e.ToTable("classes");
            e.HasKey(c => c.Id);
            e.Property(c => c.Id).HasColumnName("id").ValueGeneratedNever();
            e.Property(c => c.Name).HasColumnName("name").HasMaxLength(100);
            e.Property(c => c.TotalSeats).HasColumnName("total_seats");
            // The database fills created_at from its own clock.
            e.Property(c => c.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
        });
    }
}
