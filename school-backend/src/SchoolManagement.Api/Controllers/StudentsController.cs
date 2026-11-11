using Microsoft.AspNetCore.Mvc;
using SchoolManagement.Application.Students;
using SchoolManagement.Application.Students.Dtos;

namespace SchoolManagement.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StudentsController(IStudentService studentService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<StudentDto>>> GetAll(CancellationToken ct) =>
        Ok(await studentService.GetAllAsync(ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<StudentDto>> GetById(Guid id, CancellationToken ct) =>
        Ok(await studentService.GetByIdAsync(id, ct));

    [HttpPost]
    public async Task<ActionResult<StudentDto>> Create(StudentRequest request, CancellationToken ct)
    {
        var created = await studentService.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<StudentDto>> Update(Guid id, StudentRequest request, CancellationToken ct) =>
        Ok(await studentService.UpdateAsync(id, request, ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await studentService.DeleteAsync(id, ct);
        return NoContent();
    }
}
