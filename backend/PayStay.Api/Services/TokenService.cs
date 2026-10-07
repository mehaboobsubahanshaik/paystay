using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using PayStay.Api.Models;

namespace PayStay.Api.Services;

public class JwtOptions
{
    public string Key { get; set; } = "";
    public string Issuer { get; set; } = "PayStay";
    public string Audience { get; set; } = "PayStay";
    public int ExpiryHours { get; set; } = 24;

    /// <summary>The 256-bit signing key, derived from the configured secret so any secret length works.</summary>
    public static byte[] KeyBytes(string key) => SHA256.HashData(Encoding.UTF8.GetBytes(key));
}

public class TokenService(Microsoft.Extensions.Options.IOptions<JwtOptions> options)
{
    private readonly JwtOptions _o = options.Value;

    public (string Token, DateTime ExpiresAt) Create(User user)
    {
        var expires = DateTime.UtcNow.AddHours(_o.ExpiryHours);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new("role", user.Role.ToString()),
            new("name", user.Name),
            new("mobile4", user.Mobile.Length >= 4 ? user.Mobile[^4..] : user.Mobile),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };
        var key = new SymmetricSecurityKey(JwtOptions.KeyBytes(_o.Key));
        var token = new JwtSecurityToken(_o.Issuer, _o.Audience, claims,
            notBefore: DateTime.UtcNow, expires: expires,
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }
}

public static class ClaimsExtensions
{
    public static Guid UserId(this ClaimsPrincipal p) =>
        Guid.TryParse(p.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out var id) ? id : Guid.Empty;

    public static bool IsOwner(this ClaimsPrincipal p) => p.FindFirst("role")?.Value == nameof(UserRole.Owner);
}
