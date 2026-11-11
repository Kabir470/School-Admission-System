using SchoolManagement.Domain.Common;
using SchoolManagement.Domain.Enums;
using SchoolManagement.Domain.Exceptions;

namespace SchoolManagement.Domain.Entities;

public class Student : BaseEntity
{
    public string FirstName { get; private set; } = default!;
    public string LastName { get; private set; } = default!;
    public string? Email { get; private set; }
    public DateOnly DateOfBirth { get; private set; }
    public Gender Gender { get; private set; }
    public string ClassName { get; private set; } = default!;
    public int RollNumber { get; private set; }
    public bool IsActive { get; private set; } = true;

    public string FullName => $"{FirstName} {LastName}";

    private Student() { } // for EF Core

    public static Student Create(
        string firstName, string lastName, string? email,
        DateOnly dateOfBirth, Gender gender, string className, int rollNumber)
    {
        var student = new Student();
        student.SetDetails(firstName, lastName, email, dateOfBirth, gender, className, rollNumber);
        return student;
    }

    public void Update(
        string firstName, string lastName, string? email,
        DateOnly dateOfBirth, Gender gender, string className, int rollNumber)
    {
        SetDetails(firstName, lastName, email, dateOfBirth, gender, className, rollNumber);
        MarkUpdated();
    }

    public void Deactivate()
    {
        IsActive = false;
        MarkUpdated();
    }

    private void SetDetails(
        string firstName, string lastName, string? email,
        DateOnly dateOfBirth, Gender gender, string className, int rollNumber)
    {
        if (string.IsNullOrWhiteSpace(firstName)) throw new DomainException("First name is required.");
        if (string.IsNullOrWhiteSpace(lastName)) throw new DomainException("Last name is required.");
        if (string.IsNullOrWhiteSpace(className)) throw new DomainException("Class name is required.");
        if (rollNumber <= 0) throw new DomainException("Roll number must be greater than zero.");
        if (dateOfBirth > DateOnly.FromDateTime(DateTime.UtcNow))
            throw new DomainException("Date of birth cannot be in the future.");

        FirstName = firstName.Trim();
        LastName = lastName.Trim();
        Email = string.IsNullOrWhiteSpace(email) ? null : email.Trim().ToLowerInvariant();
        DateOfBirth = dateOfBirth;
        Gender = gender;
        ClassName = className.Trim();
        RollNumber = rollNumber;
    }
}
