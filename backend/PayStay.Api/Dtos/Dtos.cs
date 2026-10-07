using PayStay.Api.Models;
using PayStay.Api.Services;

namespace PayStay.Api.Dtos;

// ---------- auth ----------
public record OtpRequestDto(string Mobile, UserRole Role);
public record OtpRequestResult(bool Sent, string? DevCode, int ExpiresInSeconds);
public record OtpVerifyDto(string Mobile, string Code, UserRole Role);
public record UserDto(Guid Id, string Name, string MobileLast4, UserRole Role);
public record AuthResult(string Token, DateTime ExpiresAt, UserDto User, bool NeedsName);
public record ProfileDto(string Name);

// ---------- rooms & bookings ----------
public record RoomDto(int Id, int Number, int Floor, RoomType Type, decimal Price, int Capacity, string[] Amenities);
public record CreateBookingDto(DateOnly CheckIn, int Nights, string? ArrivalTime, int Guests, int[] RoomIds, string? ReferralCode);
public record ArrivalDto(string? ArrivalTime);
public record BookingDto(Guid Id, string Code, Guid GroupId, int RoomId, int RoomNumber, RoomType RoomType, int Floor,
    DateOnly CheckIn, DateOnly CheckOut, int Nights, string? ArrivalTime, int Guests, decimal Price, decimal Discount,
    decimal Gst, decimal Total, string? ReferralCode, BookingStatus Status, string Stage, DateTime CreatedAt,
    string GuestName, string MobileLast4, int OpenRequests);
public record CreateBookingResult(BookingDto[] Bookings, string? EarnedReferralCode);
public record ReferralCheckDto(string Code);
public record ReferralCheckResult(bool Valid, decimal DiscountPercent, string Message);
public record MyReferralDto(string Code, int Uses, DateTime CreatedAt);

// ---------- service requests ----------
public record RequestLineDto(string Id, int Qty);
public record CreateRequestDto(RequestKind Kind, RequestLineDto[] Items, string? When, string? Note,
    DateOnly? Date, string? Time, string? TourPack, int? TourCount);
public record ServiceRequestDto(Guid Id, Guid BookingId, int RoomNumber, string GuestName, RequestKind Kind,
    List<RequestItem> Items, string When, string? Note, decimal Total, RequestStatus Status, DateTime CreatedAt, DateTime UpdatedAt);
public record StatusDto<T>(T Status);

// ---------- owner ----------
public record BoardRoomDto(int Id, int Number, int Floor, RoomType Type, string Status, string? GuestName,
    string? BookingCode, DateOnly? CheckOut);
public record NightDto(DateOnly Date, int Booked);
public record DashboardDto(int TotalRooms, int Booked, int Available, int Cleaning, int Maintenance,
    int ArrivalsToday, int DeparturesToday, BoardRoomDto[] Board, BookingDto[] Feed, ServiceRequestDto[] OpenRequests,
    int NewRequests, NightDto[] Next7Nights, bool HasSampleData);
public record TypeStatDto(RoomType Type, int Bookings, int Rooms, decimal Value);
public record AnalyticsDto(decimal BookingValue, int Confirmed, int Cancelled, double AvgStay, double AvgOccupancy14,
    NightDto[] Next14Nights, TypeStatDto[] ByType, int ReferralCodesIssued, int ReferredBookings, decimal ReferralDiscount,
    decimal ReferredValue);

// ---------- catalogue ----------
public record CatalogDto(string HotelName, RoomTypeInfo[] RoomTypes, CatalogItem[] Housekeeping, string[] HousekeepingTimes,
    CatalogItem[] Menu, CatalogItem[] Cabs, TourInfo Tour, decimal ReferralDiscountPercent, int ReferralMinNights);
