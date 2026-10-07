using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PayStay.Api.Data;
using PayStay.Api.Dtos;
using PayStay.Api.Hubs;
using PayStay.Api.Models;
using PayStay.Api.Services;

namespace PayStay.Api.Controllers;

[ApiController]
[Route("api/owner")]
[Authorize(Roles = nameof(UserRole.Owner))]
public class OwnerController(AppDbContext db, OwnerService owner, BookingService bookings, RequestService requests, Notifier notify) : ControllerBase
{
    [HttpGet("dashboard")]
    public Task<DashboardDto> Dashboard(CancellationToken ct) => owner.DashboardAsync(ct);

    [HttpGet("analytics")]
    public Task<AnalyticsDto> Analytics(CancellationToken ct) => owner.AnalyticsAsync(ct);

    // ---------- rooms ----------
    [HttpGet("rooms")]
    public Task<BoardRoomDto[]> Rooms(CancellationToken ct) => owner.BoardAsync(ct);

    /// <summary>Mark a room ready (Available), Cleaning or Maintenance. Occupied rooms can't change.</summary>
    [HttpPut("rooms/{id:int}/status")]
    public async Task<BoardRoomDto> SetRoomStatus(int id, StatusDto<RoomStatus> dto, CancellationToken ct)
    {
        var room = await db.Rooms.FindAsync(new object[] { id }, ct) ?? throw new ApiException(404, "Room not found.");
        var today = IndiaTime.Today;
        if (await db.Bookings.AnyAsync(b => b.RoomId == id && b.Status == BookingStatus.Confirmed && b.CheckIn <= today && today < b.CheckOut, ct))
            throw new ApiException(409, $"Room {room.Number} is occupied. Change its status after the guest checks out.");
        room.Status = dto.Status;
        room.StatusFromSample = false;
        room.StatusUpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        await notify.ToAll(new HotelEvent("room", "updated", $"Room {room.Number} marked {dto.Status.ToString().ToLowerInvariant()}", room.Number));
        return (await owner.BoardAsync(ct)).First(r => r.Id == id);
    }

    // ---------- bookings ----------
    [HttpGet("bookings")]
    public async Task<BookingDto[]> Bookings([FromQuery] string? stage, [FromQuery] string? q, CancellationToken ct)
    {
        var list = await db.Bookings.Include(b => b.Room).Include(b => b.User).OrderByDescending(b => b.CreatedAt).Take(500).ToListAsync(ct);
        var rows = list.Select(b => b.ToDto());
        if (!string.IsNullOrWhiteSpace(stage) && stage != "all") rows = rows.Where(b => b.Stage == stage);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var s = q.Trim().ToLowerInvariant();
            rows = rows.Where(b => b.GuestName.ToLowerInvariant().Contains(s) || b.Code.ToLowerInvariant().Contains(s)
                || b.RoomNumber.ToString().Contains(s) || b.MobileLast4.Contains(s));
        }
        return rows.ToArray();
    }

    [HttpPost("bookings/{id:guid}/cancel")]
    public async Task<BookingDto> Cancel(Guid id, CancellationToken ct)
    {
        var b = await db.Bookings.Include(x => x.Room).Include(x => x.User).FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new ApiException(404, "Booking not found.");
        return await bookings.CancelAsync(b, byOwner: true, ct);
    }

    // ---------- guest requests ----------
    [HttpGet("requests")]
    public async Task<ServiceRequestDto[]> Requests([FromQuery] string filter = "open", CancellationToken ct = default)
    {
        var q = requests.WithDetails();
        q = filter switch
        {
            "open" => q.Where(r => r.Status == RequestStatus.New || r.Status == RequestStatus.Accepted),
            "done" => q.Where(r => r.Status == RequestStatus.Done || r.Status == RequestStatus.Cancelled),
            _ => q,
        };
        var list = await q.OrderBy(r => r.Status).ThenByDescending(r => r.CreatedAt).Take(300).ToListAsync(ct);
        return list.Select(r => r.ToDto()).ToArray();
    }

    [HttpPut("requests/{id:guid}/status")]
    public async Task<ServiceRequestDto> SetRequestStatus(Guid id, StatusDto<RequestStatus> dto, CancellationToken ct)
    {
        var r = await requests.WithDetails().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new ApiException(404, "Request not found.");
        return await requests.SetStatusAsync(r, dto.Status, byOwner: true, ct);
    }

    // ---------- demo data ----------
    [HttpPost("sample-data")]
    public async Task<object> AddSample(CancellationToken ct)
    {
        var n = await SampleData.AddAsync(db, ct);
        await notify.ToAll(new HotelEvent("sample", "added", $"{n} sample bookings added"));
        return new { added = n };
    }

    [HttpDelete("sample-data")]
    public async Task<IActionResult> RemoveSample(CancellationToken ct)
    {
        await SampleData.RemoveAsync(db, ct);
        await notify.ToAll(new HotelEvent("sample", "removed", "Sample data removed"));
        return NoContent();
    }
}
