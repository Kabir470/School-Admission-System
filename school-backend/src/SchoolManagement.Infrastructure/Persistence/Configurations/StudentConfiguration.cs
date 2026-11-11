using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SchoolManagement.Domain.Entities;

namespace SchoolManagement.Infrastructure.Persistence.Configurations;

public class StudentConfiguration : IEntityTypeConfiguration<Student>
{
    public void Configure(EntityTypeBuilder<Student> builder)
    {
        builder.ToTable("Students");
        builder.HasKey(s => s.Id);

        builder.Property(s => s.FirstName).HasMaxLength(100).IsRequired();
        builder.Property(s => s.LastName).HasMaxLength(100).IsRequired();
        builder.Property(s => s.Email).HasMaxLength(200);
        builder.Property(s => s.ClassName).HasMaxLength(50).IsRequired();
        builder.Property(s => s.Gender).HasConversion<string>().HasMaxLength(10);

        builder.Ignore(s => s.FullName);

        builder.HasIndex(s => new { s.ClassName, s.RollNumber }).IsUnique();
    }
}
