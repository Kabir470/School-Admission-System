using System.ComponentModel.DataAnnotations;
using SchoolManagement.Domain.Enums;

namespace SchoolManagement.Application.Students.Dtos;

/// <summary>Payload used for both creating and updating a student.</summary>
public record StudentRequest(
    [Required, MaxLength(100)] string FirstName,
    [Required, MaxLength(100)] string LastName,
    [EmailAddress, MaxLength(200)] string? Email,
    DateOnly DateOfBirth,
    Gender Gender,
    [Required, MaxLength(50)] string ClassName,
    [Range(1, int.MaxValue)] int RollNumber);
