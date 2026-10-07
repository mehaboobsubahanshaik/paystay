using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using PayStay.Api.Data;
using PayStay.Api.Dtos;
using PayStay.Api.Hubs;
using PayStay.Api.Models;

namespace PayStay.Api.Services;

public class BookingService(AppDbContext db, Notifier notify)
{
    public const int MaxNights = 30, MaxRooms = 5, MaxDaysAhead = 180;

    /// <summary>Rooms free for every night from checkIn up to (not including) checkOut. Rooms under maintenance are never offered.</summary>
    public async Task<List<Room>> AvailableAsync(DateOnly checkIn, DateOnly checkOut, CancellationToken ct)
    {
        var busy = db.Bookings.Where(b => b.Status == BookingStatus.Confirmed && b.CheckIn < checkOut && checkIn < b.CheckOut)
            .Select(b => b.RoomId);
        return await db.Rooms.Where(r => r.Status != RoomStatus.Maintenance && !busy.Contains(r.Id))
            .OrderBy(r => r.Floor).ThenBy(r => r.Number).ToListAsync(ct);
    }

    public static TimeOnly? ParseArrival(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || value == "flex") return null;
        if (TimeOnly.TryParse(value, out var t) && t.Minute % 30 == 0) return new TimeOnly(t.Hour, t.Minute);
        throw new ApiException(400, "Choose an arrival time on the hour or half hour, or 'not sure yet'.");
    }

    public static string ReferralCodeFor(Guid groupId)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes("ref:" + groupId));
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var sb = new StringBuilder("STAY");
        for (var i = 0; i < 6; i++) sb.Append(alphabet[hash[i] % alphabet.Length]);
        return sb.ToString();
    }

    private static string NewBookingCode()
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var sb = new StringBuilder("PS");
        for (var i = 0; i < 8; i++) sb.Append(alphabet[RandomNumberGenerator.GetInt32(alphabet.Length)]);
        return sb.ToString();
    }

    public async Task<ReferralCheckResult> CheckReferralAsync(Guid userId, string? code, CancellationToken ct)
    {
        var c = (code ?? "").Trim().ToUpperInvariant();
        if (c.Length == 0) return new(false, 0, "Enter a referral code.");
        var rc = await db.ReferralCodes.FirstOrDefaultAsync(r => r.Code == c, ct);
        if (rc is null) return new(false, 0, "That code is not valid. Check the letters and numbers and try again.");
        if (rc.OwnerUserId == userId) return new(false, 0, "You can't use your own referral code. Share it with friends instead.");
        return new(true, Pricing.ReferralDiscount * 100, $"{Pricing.ReferralDiscount * 100:0}% off room charges applied.");
    }

    public async Task<CreateBookingResult> CreateAsync(Guid userId, CreateBookingDto dto, CancellationToken ct)
    {
        var today = IndiaTime.Today;
        if (dto.CheckIn < today) throw new ApiException(400, "Check-in can't be in the past.");
        if (dto.CheckIn > today.AddDays(MaxDaysAhead)) throw new ApiException(400, $"Bookings open {MaxDaysAhead} days ahead.");
        if (dto.Nights < 1 || dto.Nights > MaxNights) throw new ApiException(400, $"Stay must be 1 to {MaxNights} nights.");
        var roomIds = (dto.RoomIds ?? Array.Empty<int>()).Distinct().ToArray();
        if (roomIds.Length is < 1 or > MaxRooms) throw new ApiException(400, $"Choose 1 to {MaxRooms} rooms.");
        if (dto.Guests < roomIds.Length) throw new ApiException(400, "Each room needs at least one guest.");
        var arrival = ParseArrival(dto.ArrivalTime);
        if (dto.CheckIn == today && arrival is { } a && a.ToTimeSpan() <= IndiaTime.Now.TimeOfDay)
            throw new ApiException(400, "That arrival time has already passed today. Pick a later time.");

        string? referral = null;
        if (!string.IsNullOrWhiteSpace(dto.ReferralCode))
        {
            var check = await CheckReferralAsync(userId, dto.ReferralCode, ct);
            if (!check.Valid) throw new ApiException(400, check.Message);
            referral = dto.ReferralCode.Trim().ToUpperInvariant();
        }

        var checkOut = dto.CheckIn.AddDays(dto.Nights);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        // Lock the chosen rooms so two guests can't book the same room at the same moment.
        await db.Database.ExecuteSqlRawAsync("SELECT \"Id\" FROM \"Rooms\" WHERE \"Id\" = ANY({0}) FOR UPDATE", new object[] { roomIds }, ct);

        var rooms = await db.Rooms.Where(r => roomIds.Contains(r.Id)).ToListAsync(ct);
        if (rooms.Count != roomIds.Length) throw new ApiException(404, "One of the rooms no longer exists.");
        if (rooms.FirstOrDefault(r => r.Status == RoomStatus.Maintenance) is { } m)
            throw new ApiException(409, $"Room {m.Number} is under maintenance. Pick another room.");
        var clash = await db.Bookings.Where(b => roomIds.Contains(b.RoomId) && b.Status == BookingStatus.Confirmed
                && b.CheckIn < checkOut && dto.CheckIn < b.CheckOut).Select(b => b.Room!.Number).FirstOrDefaultAsync(ct);
        if (clash != 0) throw new ApiException(409, $"Room {clash} was just booked for these dates. Pick another room.");
        var capacity = rooms.Sum(r => r.Capacity);
        if (capacity < dto.Guests) throw new ApiException(400, $"These rooms sleep {capacity}. Choose larger rooms or add a room.");

        var groupId = Guid.NewGuid();
        var left = dto.Guests;
        var list = new List<Booking>();
        var ordered = rooms.OrderBy(r => r.Number).ToList();
        for (var i = 0; i < ordered.Count; i++)
        {
            var r = ordered[i];
            var guests = i == ordered.Count - 1 ? left : Math.Min(r.Capacity, (int)Math.Ceiling(left / (double)(ordered.Count - i)));
            left -= guests;
            var sub = r.Price * dto.Nights;
            var discount = referral is null ? 0 : Pricing.Round(sub * Pricing.ReferralDiscount);
            var gst = Pricing.Round((sub - discount) * Pricing.RoomGstRate(r.Price));
            var booking = new Booking
            {
                Code = NewBookingCode(), GroupId = groupId, UserId = userId, RoomId = r.Id, Room = r,
                CheckIn = dto.CheckIn, CheckOut = checkOut, ArrivalTime = arrival, Guests = Math.Max(1, guests),
                Price = r.Price, Discount = discount, Gst = gst, Total = sub - discount + gst, ReferralCode = referral,
            };
            list.Add(booking);
            db.Bookings.Add(booking);
        }

        string? earned = null;
        if (dto.Nights >= Pricing.ReferralMinNights)
        {
            earned = ReferralCodeFor(groupId);
            db.ReferralCodes.Add(new ReferralCode { Code = earned, OwnerUserId = userId, SourceGroupId = groupId });
        }

        try
        {
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: "23P01" })
        {
            throw new ApiException(409, "One of these rooms was just booked for these dates. Pick another room.");
        }

        var user = await db.Users.FindAsync(new object[] { userId }, ct);
        list.ForEach(b => b.User = user);
        var dtos = list.Select(b => b.ToDto()).ToArray();
        await notify.ToOwners(new HotelEvent("booking", "created",
            $"New booking · Room{(list.Count > 1 ? "s" : "")} {string.Join(", ", list.Select(b => b.Room!.Number))} · {user?.Name}",
            list[0].Room!.Number, list[0].Id));
        return new CreateBookingResult(dtos, earned);
    }

    public async Task<Booking> GetOwnedAsync(Guid userId, Guid bookingId, CancellationToken ct) =>
        await db.Bookings.Include(b => b.Room).Include(b => b.User)
            .FirstOrDefaultAsync(b => b.Id == bookingId && b.UserId == userId, ct)
        ?? throw new ApiException(404, "Booking not found.");

    public async Task<BookingDto> CancelAsync(Booking b, bool byOwner, CancellationToken ct)
    {
        if (b.Status == BookingStatus.Cancelled) return b.ToDto();
        if (!byOwner && b.CheckIn <= IndiaTime.Today)
            throw new ApiException(400, "Bookings can be cancelled until the day before check-in. Call the front desk for help.");
        b.Status = BookingStatus.Cancelled;
        b.CancelledAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        var e = new HotelEvent("booking", "cancelled", $"Booking cancelled · Room {b.Room?.Number}", b.Room?.Number, b.Id);
        await notify.ToOwners(e);
        await notify.ToUser(b.UserId, e);
        return b.ToDto();
    }

    public async Task<BookingDto[]> ChangeArrivalAsync(Booking b, string? arrival, CancellationToken ct)
    {
        if (b.Status != BookingStatus.Confirmed || b.CheckOut <= IndiaTime.Today)
            throw new ApiException(400, "This booking can no longer be changed.");
        var t = ParseArrival(arrival);
        var group = await db.Bookings.Include(x => x.Room).Include(x => x.User)
            .Where(x => x.GroupId == b.GroupId && x.Status == BookingStatus.Confirmed).ToListAsync(ct);
        group.ForEach(x => x.ArrivalTime = t);
        await db.SaveChangesAsync(ct);
        await notify.ToOwners(new HotelEvent("booking", "updated", $"Room {b.Room?.Number}: arrival {(t is null ? "not fixed" : t.Value.ToString("h:mm tt"))}", b.Room?.Number, b.Id));
        return group.Select(x => x.ToDto()).ToArray();
    }
}
