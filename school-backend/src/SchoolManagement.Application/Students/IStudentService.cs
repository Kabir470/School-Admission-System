using SchoolManagement.Application.Students.Dtos;

namespace SchoolManagement.Application.Students;

public interface IStudentService
{
    Task<IReadOnlyList<StudentDto>> GetAllAsync(CancellationToken ct = default);
    Task<StudentDto> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<StudentDto> CreateAsync(StudentRequest request, CancellationToken ct = default);
    Task<StudentDto> UpdateAsync(Guid id, StudentRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}
