using System.ComponentModel.DataAnnotations.Schema;

namespace PayStay.Api.Models;

public enum UserRole { Customer, Owner }
public enum RoomType { Standard, Deluxe, Suite }
/// <summary>Housekeeping status set by the owner. "Booked" is derived from bookings, never stored.</summary>
public enum RoomStatus { Available, Cleaning, Maintenance }
public enum BookingStatus { Confirmed, Cancelled }
public enum RequestKind { Housekeeping, Dining, Cab, Tour }
public enum RequestStatus { New, Accepted, Done, Cancelled }

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Mobile { get; set; } = "";
    public string Name { get; set; } = "";
    public UserRole Role { get; set; } = UserRole.Customer;
    public bool IsSample { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<Booking> Bookings { get; set; } = new();
}

public class OtpCode
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Mobile { get; set; } = "";
    public string CodeHash { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
    public int Attempts { get; set; }
    public bool Used { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Room
{
    public int Id { get; set; }
    public int Number { get; set; }
    public int Floor { get; set; }
    public RoomType Type { get; set; }
    public decimal Price { get; set; }
    public int Capacity { get; set; }
    public string[] Amenities { get; set; } = Array.Empty<string>();
    public RoomStatus Status { get; set; } = RoomStatus.Available;
    public bool StatusFromSample { get; set; }
    public DateTime StatusUpdatedAt { get; set; } = DateTime.UtcNow;
}

public class Booking
{
    public Guid Id { get; set; } = Guid.NewGuid();
    /// <summary>Human-friendly booking ID shown to guests, e.g. PS7KQ2M9.</summary>
    public string Code { get; set; } = "";
    /// <summary>Rooms booked together share a group.</summary>
    public Guid GroupId { get; set; }
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public int RoomId { get; set; }
    public Room? Room { get; set; }
    public DateOnly CheckIn { get; set; }
    public DateOnly CheckOut { get; set; }
    /// <summary>Null means the guest has not fixed an arrival time yet.</summary>
    public TimeOnly? ArrivalTime { get; set; }
    public int Guests { get; set; }
    public decimal Price { get; set; }
    public decimal Discount { get; set; }
    public decimal Gst { get; set; }
    public decimal Total { get; set; }
    public string? ReferralCode { get; set; }
    public BookingStatus Status { get; set; } = BookingStatus.Confirmed;
    public bool IsSample { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CancelledAt { get; set; }

    [NotMapped] public int Nights => CheckOut.DayNumber - CheckIn.DayNumber;
}

public class RequestItem
{
    public string Name { get; set; } = "";
    public int Qty { get; set; }
    public decimal Price { get; set; }
}

public class ServiceRequest
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BookingId { get; set; }
    public Booking? Booking { get; set; }
    public RequestKind Kind { get; set; }
    public List<RequestItem> Items { get; set; } = new();
    public string When { get; set; } = "";
    public string? Note { get; set; }
    public decimal Total { get; set; }
    public RequestStatus Status { get; set; } = RequestStatus.New;
    public bool IsSample { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class ReferralCode
{
    public string Code { get; set; } = "";
    public Guid OwnerUserId { get; set; }
    public User? Owner { get; set; }
    public Guid SourceGroupId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
