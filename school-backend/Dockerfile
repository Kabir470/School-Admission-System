# ---------- build ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Directory.Build.props SchoolManagement.sln ./
COPY src/SchoolManagement.Api/SchoolManagement.Api.csproj                       src/SchoolManagement.Api/
COPY src/SchoolManagement.Application/SchoolManagement.Application.csproj       src/SchoolManagement.Application/
COPY src/SchoolManagement.Domain/SchoolManagement.Domain.csproj                 src/SchoolManagement.Domain/
COPY src/SchoolManagement.Infrastructure/SchoolManagement.Infrastructure.csproj src/SchoolManagement.Infrastructure/
RUN dotnet restore src/SchoolManagement.Api/SchoolManagement.Api.csproj

COPY src/ src/
RUN dotnet publish src/SchoolManagement.Api/SchoolManagement.Api.csproj -c Release -o /app/publish --no-restore

# ---------- runtime ----------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "SchoolManagement.Api.dll"]
