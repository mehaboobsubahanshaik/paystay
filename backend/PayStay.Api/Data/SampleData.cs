using Microsoft.EntityFrameworkCore;
using PayStay.Api.Models;
using PayStay.Api.Services;

namespace PayStay.Api.Data;

/// <summary>Owner-triggered demo data, flagged IsSample so it can be removed in one step.</summary>
public static class SampleData
{
    private static readonly string[] Names =
    {
        "Priya Nair", "Arjun Reddy", "Meera Iyer", "Kabir Khan", "Ananya Rao", "Rohan Mehta", "Fatima Ali", "Vikram Singh",
        "Sneha Kulkarni", "Aditya Varma", "Kavya Menon", "Imran Shaikh", "Neha Gupta", "Rahul Das", "Lakshmi Bose",
    };

    public static async Task<int> AddAsync(AppDbContext db, CancellationToken ct)
    {
        var rnd = new Random(7);
        var today = IndiaTime.Today;
        var users = new List<User>();
        for (var i = 0; i < Names.Length; i++)
        {
            var mobile = "98000" + (10000 + i * 37).ToString("00000");
            var u = await db.Users.FirstOrDefaultAsync(x => x.Mobile == mobile, ct);
            if (u is null) { u = new User { Mobile = mobile, Name = Names[i], IsSample = true }; db.Users.Add(u); }
            users.Add(u);
        }

        var busy = await db.Bookings.Where(b => b.Status == BookingStatus.Confirmed && b.CheckOut > today).Select(b => b.RoomId).ToListAsync(ct);
        var rooms = await db.Rooms.Where(r => !busy.Contains(r.Id) && r.Status == RoomStatus.Available).OrderBy(r => r.Number).ToListAsync(ct);
        var created = new List<Booking>();
        var k = 0;
        foreach (var room in rooms)
        {
            var roll = rnd.NextDouble();
            var nights = 1 + rnd.Next(3);
            DateOnly? checkIn = roll < .6 ? today.AddDays(-rnd.Next(nights)) : roll < .85 ? today.AddDays(1 + rnd.Next(9)) : null;
            if (checkIn is null) continue;
            var cancelled = rnd.NextDouble() < .08 && checkIn > today;
            var sub = room.Price * nights;
            var gst = Pricing.Round(sub * Pricing.RoomGstRate(room.Price));
            var b = new Booking
            {
                Code = "SP" + (100000 + k).ToString(), GroupId = Guid.NewGuid(), User = users[k % users.Count], Room = room, RoomId = room.Id,
                CheckIn = checkIn.Value, CheckOut = checkIn.Value.AddDays(nights), ArrivalTime = new TimeOnly(12 + rnd.Next(9), 0),
                Guests = 1 + rnd.Next(room.Capacity), Price = room.Price, Gst = gst, Total = sub + gst,
                Status = cancelled ? BookingStatus.Cancelled : BookingStatus.Confirmed, IsSample = true,
                CreatedAt = DateTime.UtcNow.AddMinutes(-rnd.Next(5 * 24 * 60)),
            };
            if (b.CheckOut <= today) continue;
            created.Add(b);
            db.Bookings.Add(b);
            k++;
        }

        var inHouse = created.Where(b => b.Status == BookingStatus.Confirmed && b.CheckIn <= today).Select(b => b.RoomId).ToHashSet();
        foreach (var (room, i) in rooms.Where(r => !inHouse.Contains(r.Id)).Take(4).Select((r, i) => (r, i)))
        {
            room.Status = i < 3 ? RoomStatus.Cleaning : RoomStatus.Maintenance;
            room.StatusFromSample = true;
            room.StatusUpdatedAt = DateTime.UtcNow;
        }

        var stays = created.Where(b => b.Status == BookingStatus.Confirmed && b.CheckIn <= today).Take(5).ToList();
        void Req(int i, RequestKind kind, RequestStatus st, string when, params RequestItem[] items)
        {
            if (stays.Count <= i) return;
            var sub = items.Sum(x => x.Price * x.Qty);
            db.ServiceRequests.Add(new ServiceRequest
            {
                Booking = stays[i], Kind = kind, Items = items.ToList(), When = when, Status = st, IsSample = true,
                Total = kind == RequestKind.Dining ? Pricing.Round(sub * (1 + Pricing.FoodGstRate)) : sub,
                CreatedAt = DateTime.UtcNow.AddMinutes(-(i + 1) * 17), UpdatedAt = DateTime.UtcNow,
            });
        }
        Req(0, RequestKind.Dining, RequestStatus.New, "As soon as possible",
            new RequestItem { Name = "Hyderabadi Chicken Dum Biryani", Qty = 2, Price = 420 }, new RequestItem { Name = "Irani Chai", Qty = 2, Price = 50 });
        Req(1, RequestKind.Housekeeping, RequestStatus.New, "In 1 hour",
            new RequestItem { Name = "Room cleaning", Qty = 1 }, new RequestItem { Name = "Fresh towels", Qty = 1 });
        Req(2, RequestKind.Cab, RequestStatus.Accepted, $"{(stays.Count > 2 ? stays[2].CheckOut : today):ddd d MMM}, 9:00 AM",
            new RequestItem { Name = "Airport drop", Qty = 1, Price = 1200 });
        Req(3, RequestKind.Tour, RequestStatus.New, $"{today.AddDays(1):ddd d MMM}, 9 AM pickup · 4 travellers",
            new RequestItem { Name = "Hyderabad in a Day · family pack of 4", Qty = 1, Price = 1499 });
        Req(4, RequestKind.Dining, RequestStatus.Done, "As soon as possible",
            new RequestItem { Name = "Masala Dosa", Qty = 1, Price = 180 }, new RequestItem { Name = "Filter Coffee", Qty = 1, Price = 70 });

        await db.SaveChangesAsync(ct);
        return created.Count;
    }

    public static async Task RemoveAsync(AppDbContext db, CancellationToken ct)
    {
        await db.ServiceRequests.Where(r => r.IsSample || r.Booking!.IsSample).ExecuteDeleteAsync(ct);
        var sampleUsers = db.Users.Where(u => u.IsSample).Select(u => u.Id);
        await db.ReferralCodes.Where(r => sampleUsers.Contains(r.OwnerUserId)).ExecuteDeleteAsync(ct);
        await db.Bookings.Where(b => b.IsSample).ExecuteDeleteAsync(ct);
        await db.Users.Where(u => u.IsSample && !db.Bookings.Any(b => b.UserId == u.Id)).ExecuteDeleteAsync(ct);
        await db.Rooms.Where(r => r.StatusFromSample).ExecuteUpdateAsync(s => s
            .SetProperty(r => r.Status, RoomStatus.Available).SetProperty(r => r.StatusFromSample, false)
            .SetProperty(r => r.StatusUpdatedAt, DateTime.UtcNow), ct);
    }
}
