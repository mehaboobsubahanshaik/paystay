using Microsoft.EntityFrameworkCore;
using PayStay.Api.Data;
using PayStay.Api.Dtos;
using PayStay.Api.Models;

namespace PayStay.Api.Services;

public class OwnerService(AppDbContext db, RequestService requests)
{
    public async Task<NightDto[]> NightsAsync(int days, CancellationToken ct)
    {
        var today = IndiaTime.Today;
        var end = today.AddDays(days);
        var stays = await db.Bookings.Where(b => b.Status == BookingStatus.Confirmed && b.CheckIn < end && b.CheckOut > today)
            .Select(b => new { b.CheckIn, b.CheckOut }).ToListAsync(ct);
        return Enumerable.Range(0, days).Select(i =>
        {
            var d = today.AddDays(i);
            return new NightDto(d, stays.Count(s => s.CheckIn <= d && d < s.CheckOut));
        }).ToArray();
    }

    public async Task<BoardRoomDto[]> BoardAsync(CancellationToken ct)
    {
        var today = IndiaTime.Today;
        var rooms = await db.Rooms.OrderBy(r => r.Floor).ThenBy(r => r.Number).ToListAsync(ct);
        var inHouse = await db.Bookings.Include(b => b.User)
            .Where(b => b.Status == BookingStatus.Confirmed && b.CheckIn <= today && today < b.CheckOut).ToListAsync(ct);
        return rooms.Select(r =>
        {
            var b = inHouse.FirstOrDefault(x => x.RoomId == r.Id);
            var status = b is not null ? "booked" : r.Status.ToString().ToLowerInvariant();
            return new BoardRoomDto(r.Id, r.Number, r.Floor, r.Type, status, b?.User?.Name, b?.Code, b?.CheckOut);
        }).ToArray();
    }

    public async Task<DashboardDto> DashboardAsync(CancellationToken ct)
    {
        var today = IndiaTime.Today;
        var board = await BoardAsync(ct);
        var feed = await db.Bookings.Include(b => b.Room).Include(b => b.User)
            .OrderByDescending(b => b.CreatedAt).Take(8).ToListAsync(ct);
        var open = await requests.WithDetails()
            .Where(r => r.Status == RequestStatus.New || r.Status == RequestStatus.Accepted)
            .OrderBy(r => r.Status).ThenByDescending(r => r.CreatedAt).Take(3).ToListAsync(ct);
        var newCount = await db.ServiceRequests.CountAsync(r => r.Status == RequestStatus.New, ct);
        var arrivals = await db.Bookings.CountAsync(b => b.Status == BookingStatus.Confirmed && b.CheckIn == today, ct);
        var departures = await db.Bookings.CountAsync(b => b.Status == BookingStatus.Confirmed && b.CheckOut == today, ct);
        var hasSample = await db.Bookings.AnyAsync(b => b.IsSample, ct) || await db.Rooms.AnyAsync(r => r.StatusFromSample, ct);

        return new DashboardDto(board.Length, board.Count(r => r.Status == "booked"), board.Count(r => r.Status == "available"),
            board.Count(r => r.Status == "cleaning"), board.Count(r => r.Status == "maintenance"), arrivals, departures,
            board, feed.Select(b => b.ToDto()).ToArray(), open.Select(r => r.ToDto()).ToArray(), newCount,
            await NightsAsync(7, ct), hasSample);
    }

    public async Task<AnalyticsDto> AnalyticsAsync(CancellationToken ct)
    {
        var all = await db.Bookings.Include(b => b.Room).ToListAsync(ct);
        var conf = all.Where(b => b.Status == BookingStatus.Confirmed).ToList();
        var nights = await NightsAsync(14, ct);
        var totalRooms = await db.Rooms.CountAsync(ct);
        var roomsByType = await db.Rooms.GroupBy(r => r.Type).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
        var byType = Enum.GetValues<RoomType>().Select(t => new TypeStatDto(t,
            conf.Count(b => b.Room?.Type == t), roomsByType.FirstOrDefault(x => x.Key == t)?.Count ?? 0,
            conf.Where(b => b.Room?.Type == t).Sum(b => b.Total))).ToArray();
        var referred = conf.Where(b => b.ReferralCode != null).ToList();
        return new AnalyticsDto(conf.Sum(b => b.Total), conf.Count, all.Count - conf.Count,
            conf.Count == 0 ? 0 : conf.Average(b => b.Nights),
            totalRooms == 0 ? 0 : nights.Average(n => n.Booked) / totalRooms,
            nights, byType, await db.ReferralCodes.CountAsync(ct), referred.Count, referred.Sum(b => b.Discount), referred.Sum(b => b.Total));
    }
}
