using Microsoft.EntityFrameworkCore;
using SchoolManagement.Application.Common.Interfaces;
using SchoolManagement.Domain.Entities;

namespace SchoolManagement.Infrastructure.Persistence;

public class SchoolDbContext(DbContextOptions<SchoolDbContext> options) : DbContext(options), IUnitOfWork
{
    public DbSet<Student> Students => Set<Student>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SchoolDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }
}
