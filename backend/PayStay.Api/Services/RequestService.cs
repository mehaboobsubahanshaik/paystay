using Microsoft.EntityFrameworkCore;
using PayStay.Api.Data;
using PayStay.Api.Dtos;
using PayStay.Api.Hubs;
using PayStay.Api.Models;

namespace PayStay.Api.Services;

/// <summary>Housekeeping, in-room dining, cabs and the city tour, requested from a guest's booking.</summary>
public class RequestService(AppDbContext db, Notifier notify)
{
    private static readonly Dictionary<RequestKind, string[]> StatusLabels = new()
    {
        [RequestKind.Housekeeping] = new[] { "Requested", "On the way", "Done" },
        [RequestKind.Dining] = new[] { "Ordered", "Preparing", "Delivered" },
        [RequestKind.Cab] = new[] { "Requested", "Confirmed", "Completed" },
        [RequestKind.Tour] = new[] { "Requested", "Confirmed", "Completed" },
    };

    public static string Label(RequestKind k) => k switch
    {
        RequestKind.Housekeeping => "Housekeeping", RequestKind.Dining => "In-room dining",
        RequestKind.Cab => "Cab", _ => "City tour",
    };

    /// <summary>Days the tour can run for this booking: from check-in (or today, or tomorrow once 9 AM has passed) up to check-out day.</summary>
    public static List<DateOnly> TourDays(Booking b)
    {
        var today = IndiaTime.Today;
        var start = b.CheckIn < today ? today : b.CheckIn;
        if (start == today && IndiaTime.Now.Hour >= 9) start = today.AddDays(1);
        var days = new List<DateOnly>();
        for (var d = start; d <= b.CheckOut; d = d.AddDays(1)) days.Add(d);
        return days;
    }

    public async Task<ServiceRequestDto> CreateAsync(Booking b, CreateRequestDto dto, CancellationToken ct)
    {
        var today = IndiaTime.Today;
        if (b.Status != BookingStatus.Confirmed || b.CheckOut < today)
            throw new ApiException(400, "Room services are only available for current or upcoming stays.");
        var inHouse = b.CheckIn <= today && today < b.CheckOut;
        var note = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim()[..Math.Min(140, dto.Note.Trim().Length)];
        var lines = dto.Items ?? Array.Empty<RequestLineDto>();
        var items = new List<RequestItem>();
        string when;
        decimal total;

        switch (dto.Kind)
        {
            case RequestKind.Housekeeping:
                if (!inHouse) throw new ApiException(400, "Housekeeping opens when you check in.");
                foreach (var l in lines)
                {
                    var hk = Catalog.Housekeeping.FirstOrDefault(x => x.Id == l.Id) ?? throw new ApiException(400, "Unknown housekeeping option.");
                    items.Add(new RequestItem { Name = hk.Name, Qty = 1, Price = 0 });
                }
                if (items.Count == 0) throw new ApiException(400, "Pick at least one housekeeping option.");
                when = Catalog.HousekeepingTimes.Contains(dto.When) ? dto.When! : Catalog.HousekeepingTimes[0];
                total = 0;
                break;

            case RequestKind.Dining:
                foreach (var l in lines.Where(l => l.Qty > 0))
                {
                    var dish = Catalog.Menu.FirstOrDefault(x => x.Id == l.Id) ?? throw new ApiException(400, "Unknown dish.");
                    items.Add(new RequestItem { Name = dish.Name, Qty = Math.Min(l.Qty, 20), Price = dish.Price });
                }
                if (items.Count == 0) throw new ApiException(400, "Add at least one dish to your order.");
                when = inHouse ? "As soon as possible"
                    : $"On arrival, {b.CheckIn:ddd d MMM}{(b.ArrivalTime is { } t ? " around " + t.ToString("h:mm tt") : "")}";
                total = Pricing.Round(items.Sum(i => i.Price * i.Qty) * (1 + Pricing.FoodGstRate));
                break;

            case RequestKind.Cab:
            {
                var cab = Catalog.Cabs.FirstOrDefault(x => x.Id == lines.FirstOrDefault()?.Id) ?? throw new ApiException(400, "Choose a ride.");
                var date = dto.Date ?? b.CheckOut;
                if (date < today || date < b.CheckIn || date > b.CheckOut) throw new ApiException(400, "Pick a date during your stay.");
                var time = TimeOnly.TryParse(dto.Time, out var tt) ? tt : new TimeOnly(9, 0);
                if (date == today && time.ToTimeSpan() <= IndiaTime.Now.TimeOfDay) throw new ApiException(400, "That pickup time has passed. Pick a later time.");
                items.Add(new RequestItem { Name = cab.Name, Qty = 1, Price = cab.Price });
                when = $"{date:ddd d MMM}, {time:h:mm tt}";
                total = cab.Price;
                break;
            }

            case RequestKind.Tour:
            {
                var tour = Catalog.Tour;
                var date = dto.Date ?? today;
                if (!TourDays(b).Contains(date)) throw new ApiException(400, "Pick a tour date during your stay. The tour starts at 9 AM.");
                var family = string.Equals(dto.TourPack, "family", StringComparison.OrdinalIgnoreCase);
                var count = Math.Clamp(dto.TourCount ?? 1, 1, family ? 3 : 12);
                items.Add(new RequestItem
                {
                    Name = family ? $"{tour.Name} · family pack of {tour.FamilySize}" : $"{tour.Name} · per person",
                    Qty = count, Price = family ? tour.FamilyPack : tour.PerPerson,
                });
                var people = family ? count * tour.FamilySize : count;
                when = $"{date:ddd d MMM}, 9 AM pickup · {people} traveller{(people > 1 ? "s" : "")}";
                total = items[0].Price * count;
                break;
            }

            default:
                throw new ApiException(400, "Unknown request type.");
        }

        var r = new ServiceRequest { BookingId = b.Id, Booking = b, Kind = dto.Kind, Items = items, When = when, Note = note, Total = total };
        db.ServiceRequests.Add(r);
        await db.SaveChangesAsync(ct);
        await notify.ToOwners(new HotelEvent("request", "created", $"Room {b.Room?.Number} · new {Label(dto.Kind).ToLowerInvariant()} request", b.Room?.Number, r.Id));
        return r.ToDto();
    }

    public async Task<ServiceRequestDto> SetStatusAsync(ServiceRequest r, RequestStatus status, bool byOwner, CancellationToken ct)
    {
        var allowed = byOwner
            ? (r.Status, status) is (RequestStatus.New, RequestStatus.Accepted) or (RequestStatus.Accepted, RequestStatus.Done)
                or (RequestStatus.New, RequestStatus.Done) or (RequestStatus.New, RequestStatus.Cancelled) or (RequestStatus.Accepted, RequestStatus.Cancelled)
            : r.Status == RequestStatus.New && status == RequestStatus.Cancelled;
        if (!allowed)
            throw new ApiException(400, byOwner ? "That status change isn't allowed." : "This request is already being handled. Call the front desk to change it.");
        r.Status = status;
        r.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        var idx = status switch { RequestStatus.Accepted => 1, RequestStatus.Done => 2, _ => -1 };
        var msg = idx > 0 ? $"Room {r.Booking?.Room?.Number}: {Label(r.Kind)} · {StatusLabels[r.Kind][idx]}" : $"Room {r.Booking?.Room?.Number}: {Label(r.Kind)} cancelled";
        var e = new HotelEvent("request", status.ToString().ToLowerInvariant(), msg, r.Booking?.Room?.Number, r.Id);
        await notify.ToOwners(e);
        if (r.Booking is not null) await notify.ToUser(r.Booking.UserId, e);
        return r.ToDto();
    }

    public IQueryable<ServiceRequest> WithDetails() =>
        db.ServiceRequests.Include(r => r.Booking).ThenInclude(b => b!.Room).Include(r => r.Booking).ThenInclude(b => b!.User);
}
