namespace SchoolManagement.Domain.Exceptions;

/// <summary>Thrown when a business rule inside the domain is violated.</summary>
public class DomainException(string message) : Exception(message);
