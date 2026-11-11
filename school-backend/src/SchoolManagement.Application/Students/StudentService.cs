using SchoolManagement.Application.Common.Exceptions;
using SchoolManagement.Application.Common.Interfaces;
using SchoolManagement.Application.Students.Dtos;
using SchoolManagement.Domain.Entities;

namespace SchoolManagement.Application.Students;

public class StudentService(IStudentRepository repository, IUnitOfWork unitOfWork) : IStudentService
{
    public async Task<IReadOnlyList<StudentDto>> GetAllAsync(CancellationToken ct = default)
    {
        var students = await repository.GetAllAsync(ct);
        return students.Select(StudentDto.FromEntity).ToList();
    }

    public async Task<StudentDto> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var student = await GetOrThrowAsync(id, ct);
        return StudentDto.FromEntity(student);
    }

    public async Task<StudentDto> CreateAsync(StudentRequest request, CancellationToken ct = default)
    {
        await EnsureRollNumberIsFreeAsync(request, null, ct);

        var student = Student.Create(
            request.FirstName, request.LastName, request.Email,
            request.DateOfBirth, request.Gender, request.ClassName, request.RollNumber);

        await repository.AddAsync(student, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return StudentDto.FromEntity(student);
    }

    public async Task<StudentDto> UpdateAsync(Guid id, StudentRequest request, CancellationToken ct = default)
    {
        var student = await GetOrThrowAsync(id, ct);
        await EnsureRollNumberIsFreeAsync(request, id, ct);

        student.Update(
            request.FirstName, request.LastName, request.Email,
            request.DateOfBirth, request.Gender, request.ClassName, request.RollNumber);

        await unitOfWork.SaveChangesAsync(ct);
        return StudentDto.FromEntity(student);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var student = await GetOrThrowAsync(id, ct);
        repository.Remove(student);
        await unitOfWork.SaveChangesAsync(ct);
    }

    private async Task<Student> GetOrThrowAsync(Guid id, CancellationToken ct) =>
        await repository.GetByIdAsync(id, ct) ?? throw new NotFoundException(nameof(Student), id);

    private async Task EnsureRollNumberIsFreeAsync(StudentRequest request, Guid? excludeId, CancellationToken ct)
    {
        if (await repository.RollNumberExistsAsync(request.ClassName, request.RollNumber, excludeId, ct))
            throw new ConflictException(
                $"Roll number {request.RollNumber} is already taken in class '{request.ClassName}'.");
    }
}
