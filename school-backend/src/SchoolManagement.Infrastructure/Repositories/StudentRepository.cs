using Microsoft.EntityFrameworkCore;
using SchoolManagement.Application.Common.Interfaces;
using SchoolManagement.Domain.Entities;
using SchoolManagement.Infrastructure.Persistence;

namespace SchoolManagement.Infrastructure.Repositories;

public class StudentRepository(SchoolDbContext db) : IStudentRepository
{
    public Task<Student?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        db.Students.FirstOrDefaultAsync(s => s.Id == id, ct);

    public async Task<IReadOnlyList<Student>> GetAllAsync(CancellationToken ct = default) =>
        await db.Students.AsNoTracking()
            .OrderBy(s => s.ClassName).ThenBy(s => s.RollNumber)
            .ToListAsync(ct);

    public Task<bool> RollNumberExistsAsync(string className, int rollNumber, Guid? excludeId = null, CancellationToken ct = default) =>
        db.Students.AnyAsync(s =>
            s.ClassName == className.Trim() &&
            s.RollNumber == rollNumber &&
            (excludeId == null || s.Id != excludeId), ct);

    public async Task AddAsync(Student student, CancellationToken ct = default) =>
        await db.Students.AddAsync(student, ct);

    public void Remove(Student student) => db.Students.Remove(student);
}
