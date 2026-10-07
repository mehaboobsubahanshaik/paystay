using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PayStay.Api.Data;
using PayStay.Api.Dtos;
using PayStay.Api.Models;
using PayStay.Api.Services;

namespace PayStay.Api.Controllers;

[ApiController]
[Route("api/auth")]
public partial class AuthController(AppDbContext db, OtpService otp, TokenService tokens) : ControllerBase
{
    [GeneratedRegex("^[6-9][0-9]{9}$")]
    private static partial Regex IndianMobile();

    private static string Clean(string? mobile) => Regex.Replace(mobile ?? "", "[^0-9]", "") is var d && d.Length == 12 && d.StartsWith("91") ? d[2..] : Regex.Replace(mobile ?? "", "[^0-9]", "");

    /// <summary>Step 1: send a 6-digit code to the mobile number. In Mock mode the code is returned as devCode.</summary>
    [HttpPost("otp/request")]
    public async Task<ActionResult<OtpRequestResult>> RequestOtp(OtpRequestDto dto, CancellationToken ct)
    {
        var mobile = Clean(dto.Mobile);
        if (!IndianMobile().IsMatch(mobile))
            throw new ApiException(400, "Enter a 10-digit mobile number starting with 6, 7, 8 or 9.");
        if (dto.Role == UserRole.Owner && !await db.Users.AnyAsync(u => u.Mobile == mobile && u.Role == UserRole.Owner, ct))
            throw new ApiException(403, "This number is not registered as a hotel owner.");
        var code = await otp.IssueAsync(mobile, ct);
        return new OtpRequestResult(true, code, 300);
    }

    /// <summary>Step 2: verify the code and receive a JWT. New guests are created here; needsName tells the app to ask for their name.</summary>
    [HttpPost("otp/verify")]
    public async Task<ActionResult<AuthResult>> Verify(OtpVerifyDto dto, CancellationToken ct)
    {
        var mobile = Clean(dto.Mobile);
        await otp.VerifyAsync(mobile, (dto.Code ?? "").Trim(), ct);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Mobile == mobile, ct);
        if (dto.Role == UserRole.Owner)
        {
            if (user is null || user.Role != UserRole.Owner) throw new ApiException(403, "This number is not registered as a hotel owner.");
        }
        else
        {
            if (user is null)
            {
                user = new User { Mobile = mobile, Role = UserRole.Customer };
                db.Users.Add(user);
                await db.SaveChangesAsync(ct);
            }
            else if (user.Role == UserRole.Owner)
                throw new ApiException(400, "This is the owner's number. Choose Hotel owner to sign in.");
        }
        var (token, expires) = tokens.Create(user);
        return new AuthResult(token, expires, user.ToDto(), string.IsNullOrWhiteSpace(user.Name));
    }
}
