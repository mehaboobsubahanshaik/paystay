using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using PayStay.Api.Data;
using PayStay.Api.Hubs;
using PayStay.Api.Services;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

// ---------- configuration ----------
builder.Services.Configure<JwtOptions>(config.GetSection("Jwt"));
builder.Services.Configure<OtpOptions>(config.GetSection("Otp"));
var jwt = config.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
if (string.IsNullOrWhiteSpace(jwt.Key))
    throw new InvalidOperationException("Jwt:Key is missing. Set it in appsettings.json or the Jwt__Key environment variable.");
if (!builder.Environment.IsDevelopment() && jwt.Key.StartsWith("CHANGE-ME", StringComparison.Ordinal))
    Console.WriteLine("WARNING: Jwt__Key is still the development key. Set a long random value before going live.");

// ---------- database ----------
// Hosts like Render, Neon and Heroku give one DATABASE_URL (postgres://user:pass@host:port/db?sslmode=require).
// Npgsql wants key=value form, so convert it; otherwise use ConnectionStrings:Default from appsettings.
builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(ConnectionStringFor(config)));

static string ConnectionStringFor(IConfiguration config)
{
    var url = config["DATABASE_URL"];
    if (string.IsNullOrWhiteSpace(url) || !url.StartsWith("postgres", StringComparison.OrdinalIgnoreCase))
        return config.GetConnectionString("Default") ?? throw new InvalidOperationException("Set ConnectionStrings:Default or DATABASE_URL.");
    var uri = new Uri(url);
    var userInfo = uri.UserInfo.Split(':', 2);
    var query = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(uri.Query);
    var sslMode = (query.TryGetValue("sslmode", out var v) ? v.ToString() : "prefer").ToLowerInvariant() switch
    {
        "require" or "verify-ca" or "verify-full" => "Require",
        "disable" => "Disable",
        _ => "Prefer",
    };
    return $"Host={uri.Host};Port={(uri.Port > 0 ? uri.Port : 5432)};Database={uri.AbsolutePath.TrimStart('/')};" +
           $"Username={Uri.UnescapeDataString(userInfo[0])};Password={(userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "")};" +
           $"SSL Mode={sslMode}";
}

// ---------- auth: JWT with roles; SignalR sends the token in the query string ----------
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
{
    o.MapInboundClaims = false;
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true, ValidIssuer = jwt.Issuer,
        ValidateAudience = true, ValidAudience = jwt.Audience,
        ValidateIssuerSigningKey = true, IssuerSigningKey = new SymmetricSecurityKey(JwtOptions.KeyBytes(jwt.Key)),
        ValidateLifetime = true, ClockSkew = TimeSpan.FromMinutes(1),
        RoleClaimType = "role", NameClaimType = "name",
    };
    o.Events = new JwtBearerEvents
    {
        OnMessageReceived = ctx =>
        {
            var token = ctx.Request.Query["access_token"];
            if (!string.IsNullOrEmpty(token) && ctx.HttpContext.Request.Path.StartsWithSegments("/hubs")) ctx.Token = token;
            return Task.CompletedTask;
        },
    };
});
builder.Services.AddAuthorization();

// ---------- app services ----------
builder.Services.AddScoped<OtpService>();
builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<BookingService>();
builder.Services.AddScoped<RequestService>();
builder.Services.AddScoped<OwnerService>();
builder.Services.AddScoped<Notifier>();
builder.Services.AddSingleton<ISmsSender, ConsoleSmsSender>();
builder.Services.AddSignalR().AddJsonProtocol(o => o.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddControllers().AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

var origins = config.GetSection("Cors:Origins").Get<string[]>() ?? new[] { "http://localhost:5173" };
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));

// ---------- Swagger ----------
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "PayStay Hyderabad API", Version = "v1", Description = "Rooms, bookings, room services and the owner dashboard. Sign in with /api/auth/otp/request then /api/auth/otp/verify, then click Authorize and paste the token." });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization", Type = SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT", In = ParameterLocation.Header,
        Description = "Paste the token from /api/auth/otp/verify",
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        { new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }, Array.Empty<string>() },
    });
});

var app = builder.Build();

// ---------- errors: ApiException → { message } with its status ----------
app.UseExceptionHandler(e => e.Run(async ctx =>
{
    var ex = ctx.Features.Get<IExceptionHandlerFeature>()?.Error;
    var (status, message) = ex switch
    {
        ApiException api => (api.Status, api.Message),
        BadHttpRequestException bad => (400, bad.Message),
        _ => (500, "Something went wrong on the server. Try again."),
    };
    if (status == 500) app.Logger.LogError(ex, "Unhandled error");
    ctx.Response.StatusCode = status;
    await ctx.Response.WriteAsJsonAsync(new { message });
}));

if (app.Environment.IsDevelopment() || config.GetValue("Swagger:Enabled", true))
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.DocumentTitle = "PayStay API");
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<HotelHub>("/hubs/hotel");
app.MapGet("/health", () => Results.Ok(new { status = "ok", hotel = Catalog.HotelName, time = IndiaTime.Now }));

// ---------- database setup with retry (the database container may still be starting) ----------
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var owner = config["Owner:Mobile"] ?? "9000000001";
    for (var attempt = 1; ; attempt++)
    {
        try { await DbInitializer.InitializeAsync(db, owner, app.Logger); break; }
        catch (Exception ex) when (attempt < 10)
        {
            app.Logger.LogWarning("Database not ready ({Message}). Retrying in 3 s ({Attempt}/10)...", ex.Message, attempt);
            await Task.Delay(3000);
        }
    }
}

app.Run();
