namespace SchoolManagement.Application.Common.Exceptions;

public class NotFoundException(string entity, object key)
    : Exception($"{entity} with id '{key}' was not found.");
