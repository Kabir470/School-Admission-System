using SchoolManagement.Domain.Entities;

namespace SchoolManagement.Application.Common.Interfaces;

public interface IStudentRepository
{
    Task<Student?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<Student>> GetAllAsync(CancellationToken ct = default);
    Task<bool> RollNumberExistsAsync(string className, int rollNumber, Guid? excludeId = null, CancellationToken ct = default);
    Task AddAsync(Student student, CancellationToken ct = default);
    void Remove(Student student);
}
