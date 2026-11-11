using Microsoft.Extensions.DependencyInjection;
using SchoolManagement.Application.Students;

namespace SchoolManagement.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IStudentService, StudentService>();
        return services;
    }
}
