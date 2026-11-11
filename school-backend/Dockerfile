# syntax=docker/dockerfile:1

# ---- build: restore, compile and publish ---------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Project files first, so the restore layer is cached until a dependency changes.
COPY Directory.Build.props SchoolAdmission.sln ./
COPY src/SchoolAdmission.Domain/SchoolAdmission.Domain.csproj src/SchoolAdmission.Domain/
COPY src/SchoolAdmission.Application/SchoolAdmission.Application.csproj src/SchoolAdmission.Application/
COPY src/SchoolAdmission.Infrastructure/SchoolAdmission.Infrastructure.csproj src/SchoolAdmission.Infrastructure/
COPY src/SchoolAdmission.Api/SchoolAdmission.Api.csproj src/SchoolAdmission.Api/
COPY tests/SchoolAdmission.Tests/SchoolAdmission.Tests.csproj tests/SchoolAdmission.Tests/
RUN dotnet restore SchoolAdmission.sln

COPY . .
RUN dotnet publish src/SchoolAdmission.Api -c Release --no-restore -o /app/publish

# ---- test: the integration suite, run with `docker compose --profile test run --rm tests`
FROM build AS test
RUN dotnet build tests/SchoolAdmission.Tests -c Release --no-restore
ENTRYPOINT ["dotnet", "test", "tests/SchoolAdmission.Tests", "-c", "Release", "--no-build", "--logger", "console;verbosity=normal"]

# ---- final: the API on the small ASP.NET runtime image, as a non-root user -----------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
# Npgsql probes for GSSAPI when it opens a connection. Without this library the probe
# prints a harmless but alarming "Cannot load library libgssapi_krb5.so.2" to the log.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgssapi-krb5-2 \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "SchoolAdmission.Api.dll"]
