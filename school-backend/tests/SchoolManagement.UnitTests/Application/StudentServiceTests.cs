using SchoolManagement.Application.Common.Exceptions;
using SchoolManagement.Application.Common.Interfaces;
using SchoolManagement.Application.Students;
using SchoolManagement.Application.Students.Dtos;
using SchoolManagement.Domain.Entities;
using SchoolManagement.Domain.Enums;

namespace SchoolManagement.UnitTests.Application;

public class StudentServiceTests
{
    private readonly InMemoryStudentRepository _repo = new();
    private readonly StudentService _service;

    public StudentServiceTests() => _service = new StudentService(_repo, _repo);

    private static StudentRequest Request(int roll = 1) =>
        new("Rahim", "Uddin", null, new DateOnly(2012, 5, 14), Gender.Male, "Class 6", roll);

    [Fact]
    public async Task Create_AddsStudent()
    {
        var dto = await _service.CreateAsync(Request());

        Assert.Single(await _service.GetAllAsync());
        Assert.Equal("Rahim Uddin", dto.FullName);
    }

    [Fact]
    public async Task Create_WithDuplicateRollNumber_ThrowsConflict()
    {
        await _service.CreateAsync(Request());
        await Assert.ThrowsAsync<ConflictException>(() => _service.CreateAsync(Request()));
    }

    [Fact]
    public async Task GetById_Unknown_ThrowsNotFound()
    {
        await Assert.ThrowsAsync<NotFoundException>(() => _service.GetByIdAsync(Guid.NewGuid()));
    }

    private sealed class InMemoryStudentRepository : IStudentRepository, IUnitOfWork
    {
        private readonly List<Student> _items = [];

        public Task<Student?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
            Task.FromResult(_items.FirstOrDefault(s => s.Id == id));
        public Task<IReadOnlyList<Student>> GetAllAsync(CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyList<Student>>(_items.ToList());
        public Task<bool> RollNumberExistsAsync(string className, int rollNumber, Guid? excludeId = null, CancellationToken ct = default) =>
            Task.FromResult(_items.Any(s => s.ClassName == className && s.RollNumber == rollNumber && s.Id != excludeId));
        public Task AddAsync(Student student, CancellationToken ct = default) { _items.Add(student); return Task.CompletedTask; }
        public void Remove(Student student) => _items.Remove(student);
        public Task<int> SaveChangesAsync(CancellationToken ct = default) => Task.FromResult(0);
    }
}
