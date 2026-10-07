using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using PayStay.Api.Data;
using PayStay.Api.Models;

namespace PayStay.Api.Services;

public class OtpOptions
{
    /// <summary>"Mock" returns the code in the API response (development). Any other value expects an SMS provider.</summary>
    public string Mode { get; set; } = "Mock";
    public int ExpiryMinutes { get; set; } = 5;
    public int MaxAttempts { get; set; } = 5;
    public int MaxRequestsPer10Min { get; set; } = 5;
}

public interface ISmsSender
{
    Task SendOtpAsync(string mobile, string code, CancellationToken ct);
}

/// <summary>Development sender: writes the code to the server log. Replace with MSG91 / Twilio Verify for production.</summary>
public class ConsoleSmsSender(ILogger<ConsoleSmsSender> log) : ISmsSender
{
    public Task SendOtpAsync(string mobile, string code, CancellationToken ct)
    {
        log.LogInformation("OTP for ******{Last4}: {Code}", mobile[^4..], code);
        return Task.CompletedTask;
    }
}

public class OtpService(AppDbContext db, ISmsSender sms, Microsoft.Extensions.Options.IOptions<OtpOptions> options)
{
    private readonly OtpOptions _o = options.Value;
    public bool IsMock => string.Equals(_o.Mode, "Mock", StringComparison.OrdinalIgnoreCase);

    private static string Hash(string mobile, string code) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"paystay:{mobile}:{code}")));

    /// <returns>The code itself in mock mode, otherwise null.</returns>
    public async Task<string?> IssueAsync(string mobile, CancellationToken ct)
    {
        var since = DateTime.UtcNow.AddMinutes(-10);
        var recent = await db.OtpCodes.CountAsync(o => o.Mobile == mobile && o.CreatedAt > since, ct);
        if (recent >= _o.MaxRequestsPer10Min)
            throw new ApiException(429, "Too many codes requested. Wait 10 minutes and try again.");

        var code = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
        // Older unused codes for this number stop working.
        await db.OtpCodes.Where(o => o.Mobile == mobile && !o.Used).ExecuteUpdateAsync(s => s.SetProperty(o => o.Used, true), ct);
        db.OtpCodes.Add(new OtpCode { Mobile = mobile, CodeHash = Hash(mobile, code), ExpiresAt = DateTime.UtcNow.AddMinutes(_o.ExpiryMinutes) });
        await db.SaveChangesAsync(ct);
        await sms.SendOtpAsync(mobile, code, ct);
        return IsMock ? code : null;
    }

    public async Task VerifyAsync(string mobile, string code, CancellationToken ct)
    {
        var otp = await db.OtpCodes.Where(o => o.Mobile == mobile && !o.Used)
            .OrderByDescending(o => o.CreatedAt).FirstOrDefaultAsync(ct);
        if (otp is null || otp.ExpiresAt < DateTime.UtcNow)
            throw new ApiException(400, "This code has expired. Request a new one.");
        if (otp.Attempts >= _o.MaxAttempts)
            throw new ApiException(429, "Too many wrong attempts. Request a new code.");
        if (!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(otp.CodeHash), Encoding.UTF8.GetBytes(Hash(mobile, code))))
        {
            otp.Attempts++;
            await db.SaveChangesAsync(ct);
            throw new ApiException(400, "That code is not right. Check the digits and try again.");
        }
        otp.Used = true;
        await db.SaveChangesAsync(ct);
    }
}
