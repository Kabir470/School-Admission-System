using SchoolManagement.Domain.Entities;
using SchoolManagement.Domain.Enums;
using SchoolManagement.Domain.Exceptions;

namespace SchoolManagement.UnitTests.Domain;

public class StudentTests
{
    [Fact]
    public void Create_WithValidData_NormalizesFields()
    {
        var student = Student.Create(" Rahim ", "Uddin", " RAHIM@Example.com ",
            new DateOnly(2012, 5, 14), Gender.Male, "Class 6", 1);

        Assert.Equal("Rahim", student.FirstName);
        Assert.Equal("rahim@example.com", student.Email);
        Assert.Equal("Rahim Uddin", student.FullName);
        Assert.True(student.IsActive);
    }

    [Theory]
    [InlineData("", "Uddin", "Class 6", 1)]
    [InlineData("Rahim", "", "Class 6", 1)]
    [InlineData("Rahim", "Uddin", "", 1)]
    [InlineData("Rahim", "Uddin", "Class 6", 0)]
    public void Create_WithInvalidData_Throws(string first, string last, string className, int roll)
    {
        Assert.Throws<DomainException>(() =>
            Student.Create(first, last, null, new DateOnly(2012, 1, 1), Gender.Male, className, roll));
    }
}
