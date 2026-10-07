using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PayStay.Api.Data;
using PayStay.Api.Dtos;
using PayStay.Api.Models;
using PayStay.Api.Services;

namespace PayStay.Api.Controllers;

[ApiController]
[Route("api/customer")]
[Authorize(Roles = nameof(UserRole.Customer))]
public class CustomerController(AppDbContext db, BookingService bookings, RequestService requests, TokenService tokens) : ControllerBase
{
    private Guid Me => User.UserId();

    // ---------- profile ----------
    [HttpGet("profile")]
    public async Task<UserDto> Profile(CancellationToken ct) =>
        (await db.Users.FindAsync(new object[] { Me }, ct) ?? throw new ApiException(404, "Account not found.")).ToDto();

    /// <summary>Save the guest's name. Returns a fresh token that carries the name.</summary>
    [HttpPut("profile")]
    public async Task<AuthResult> UpdateProfile(ProfileDto dto, CancellationToken ct)
    {
        var name = (dto.Name ?? "").Trim();
        if (name.Length is < 2 or > 80) throw new ApiException(400, "Enter your name as it appears on your ID.");
        var user = await db.Users.FindAsync(new object[] { Me }, ct) ?? throw new ApiException(404, "Account not found.");
        user.Name = name;
        await db.SaveChangesAsync(ct);
        var (token, expires) = tokens.Create(user);
        return new AuthResult(token, expires, user.ToDto(), false);
    }

    // ---------- rooms ----------
    /// <summary>Rooms free for the whole stay that fit the guests per room.</summary>
    [HttpGet("rooms/available")]
    public async Task<RoomDto[]> Available([FromQuery] DateOnly checkIn, [FromQuery] int nights = 1, [FromQuery] int guests = 1,
        [FromQuery] int rooms = 1, [FromQuery] RoomType? type = null, CancellationToken ct = default)
    {
        if (checkIn < IndiaTime.Today) throw new ApiException(400, "Check-in can't be in the past.");
        nights = Math.Clamp(nights, 1, BookingService.MaxNights);
        rooms = Math.Clamp(rooms, 1, BookingService.MaxRooms);
        var perRoom = (int)Math.Ceiling(Math.Max(guests, rooms) / (double)rooms);
        var free = await bookings.AvailableAsync(checkIn, checkIn.AddDays(nights), ct);
        return free.Where(r => r.Capacity >= perRoom && (type is null || r.Type == type)).Select(r => r.ToDto()).ToArray();
    }

    // ---------- bookings ----------
    [HttpGet("bookings")]
    public async Task<BookingDto[]> MyBookings(CancellationToken ct)
    {
        var list = await db.Bookings.Include(b => b.Room).Include(b => b.User).Where(b => b.UserId == Me)
            .OrderBy(b => b.CheckIn).ToListAsync(ct);
        var ids = list.Select(b => b.Id).ToList();
        var open = await db.ServiceRequests.Where(r => ids.Contains(r.BookingId) && (r.Status == RequestStatus.New || r.Status == RequestStatus.Accepted))
            .GroupBy(r => r.BookingId).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
        return list.Select(b => b.ToDto(open.FirstOrDefault(o => o.Key == b.Id)?.Count ?? 0)).ToArray();
    }

    [HttpPost("bookings")]
    public async Task<ActionResult<CreateBookingResult>> Book(CreateBookingDto dto, CancellationToken ct)
    {
        var me = await db.Users.FindAsync(new object[] { Me }, ct);
        if (me is null || string.IsNullOrWhiteSpace(me.Name)) throw new ApiException(400, "Add your name before booking.");
        return await bookings.CreateAsync(Me, dto, ct);
    }

    [HttpPost("bookings/{id:guid}/cancel")]
    public async Task<BookingDto> Cancel(Guid id, CancellationToken ct) =>
        await bookings.CancelAsync(await bookings.GetOwnedAsync(Me, id, ct), byOwner: false, ct);

    /// <summary>Change the arrival time for every room in the booking. Send null or "flex" for "not sure yet".</summary>
    [HttpPatch("bookings/{id:guid}/arrival")]
    public async Task<BookingDto[]> ChangeArrival(Guid id, ArrivalDto dto, CancellationToken ct) =>
        await bookings.ChangeArrivalAsync(await bookings.GetOwnedAsync(Me, id, ct), dto.ArrivalTime, ct);

    // ---------- referrals ----------
    [HttpPost("referrals/check")]
    public Task<ReferralCheckResult> CheckReferral(ReferralCheckDto dto, CancellationToken ct) => bookings.CheckReferralAsync(Me, dto.Code, ct);

    [HttpGet("referrals")]
    public async Task<MyReferralDto[]> MyReferrals(CancellationToken ct)
    {
        var codes = await db.ReferralCodes.Where(r => r.OwnerUserId == Me).OrderBy(r => r.CreatedAt).ToListAsync(ct);
        var list = codes.Select(c => c.Code).ToList();
        var uses = await db.Bookings.Where(b => b.ReferralCode != null && list.Contains(b.ReferralCode) && b.Status == BookingStatus.Confirmed)
            .GroupBy(b => new { b.ReferralCode, b.GroupId }).Select(g => g.Key.ReferralCode).ToListAsync(ct);
        return codes.Select(c => new MyReferralDto(c.Code, uses.Count(u => u == c.Code), c.CreatedAt)).ToArray();
    }

    // ---------- room services ----------
    [HttpGet("bookings/{id:guid}/requests")]
    public async Task<ServiceRequestDto[]> Requests(Guid id, CancellationToken ct)
    {
        await bookings.GetOwnedAsync(Me, id, ct);
        var list = await requests.WithDetails().Where(r => r.BookingId == id).OrderByDescending(r => r.CreatedAt).ToListAsync(ct);
        return list.Select(r => r.ToDto()).ToArray();
    }

    [HttpPost("bookings/{id:guid}/requests")]
    public async Task<ServiceRequestDto> CreateRequest(Guid id, CreateRequestDto dto, CancellationToken ct) =>
        await requests.CreateAsync(await bookings.GetOwnedAsync(Me, id, ct), dto, ct);

    [HttpPost("requests/{id:guid}/cancel")]
    public async Task<ServiceRequestDto> CancelRequest(Guid id, CancellationToken ct)
    {
        var r = await requests.WithDetails().FirstOrDefaultAsync(x => x.Id == id && x.Booking!.UserId == Me, ct)
            ?? throw new ApiException(404, "Request not found.");
        return await requests.SetStatusAsync(r, RequestStatus.Cancelled, byOwner: false, ct);
    }
}
