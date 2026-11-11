using SchoolManagement.Domain.Entities;
using SchoolManagement.Domain.Enums;

namespace SchoolManagement.Application.Students.Dtos;

public record StudentDto(
    Guid Id,
    string FirstName,
    string LastName,
    string FullName,
    string? Email,
    DateOnly DateOfBirth,
    Gender Gender,
    string ClassName,
    int RollNumber,
    bool IsActive)
{
    public static StudentDto FromEntity(Student s) => new(
        s.Id, s.FirstName, s.LastName, s.FullName, s.Email,
        s.DateOfBirth, s.Gender, s.ClassName, s.RollNumber, s.IsActive);
}
