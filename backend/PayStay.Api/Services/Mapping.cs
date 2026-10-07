using PayStay.Api.Dtos;
using PayStay.Api.Models;

namespace PayStay.Api.Services;

public static class Mapping
{
    public static string? Hhmm(TimeOnly? t) => t?.ToString("HH:mm");

    /// <summary>upcoming, staying, completed or cancelled, from the hotel's point of view today.</summary>
    public static string Stage(Booking b)
    {
        var today = IndiaTime.Today;
        if (b.Status == BookingStatus.Cancelled) return "cancelled";
        if (b.CheckOut <= today) return "completed";
        if (b.CheckIn <= today) return "staying";
        return "upcoming";
    }

    public static BookingDto ToDto(this Booking b, int openRequests = 0) => new(
        b.Id, b.Code, b.GroupId, b.RoomId, b.Room?.Number ?? 0, b.Room?.Type ?? RoomType.Standard, b.Room?.Floor ?? 0,
        b.CheckIn, b.CheckOut, b.Nights, Hhmm(b.ArrivalTime), b.Guests, b.Price, b.Discount, b.Gst, b.Total,
        b.ReferralCode, b.Status, Stage(b), b.CreatedAt, b.User?.Name ?? "", Last4(b.User?.Mobile), openRequests);

    public static ServiceRequestDto ToDto(this ServiceRequest r) => new(
        r.Id, r.BookingId, r.Booking?.Room?.Number ?? 0, r.Booking?.User?.Name ?? "", r.Kind, r.Items, r.When, r.Note,
        r.Total, r.Status, r.CreatedAt, r.UpdatedAt);

    public static RoomDto ToDto(this Room r) => new(r.Id, r.Number, r.Floor, r.Type, r.Price, r.Capacity, r.Amenities);

    public static UserDto ToDto(this User u) => new(u.Id, u.Name, Last4(u.Mobile), u.Role);

    public static string Last4(string? mobile) => mobile is { Length: >= 4 } ? mobile[^4..] : "";
}
