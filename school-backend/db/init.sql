-- Initial schema for SchoolManagementDb (SQL Server).
-- Prefer EF Core migrations for ongoing changes; this script is for quick local setup / reference.

IF DB_ID('SchoolManagementDb') IS NULL
    CREATE DATABASE SchoolManagementDb;
GO

USE SchoolManagementDb;
GO

IF OBJECT_ID('dbo.Students', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Students (
        Id          UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        FirstName   NVARCHAR(100)    NOT NULL,
        LastName    NVARCHAR(100)    NOT NULL,
        Email       NVARCHAR(200)    NULL,
        DateOfBirth DATE             NOT NULL,
        Gender      NVARCHAR(10)     NOT NULL,
        ClassName   NVARCHAR(50)     NOT NULL,
        RollNumber  INT              NOT NULL,
        IsActive    BIT              NOT NULL DEFAULT 1,
        CreatedAt   DATETIME2        NOT NULL,
        UpdatedAt   DATETIME2        NULL,
        CONSTRAINT UX_Students_ClassName_RollNumber UNIQUE (ClassName, RollNumber)
    );
END
GO
