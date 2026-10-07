namespace PayStay.Api.Services;

/// <summary>An error the guest or owner should see, with the HTTP status to send.</summary>
public class ApiException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}
