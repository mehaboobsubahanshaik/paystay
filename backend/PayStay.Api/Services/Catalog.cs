using PayStay.Api.Models;

namespace PayStay.Api.Services;

public record RoomTypeInfo(RoomType Type, decimal Price, int Capacity, string[] Amenities);
public record CatalogItem(string Id, string Name, string Description, decimal Price, bool Veg = true, string? Category = null);
public record TourStop(string Time, string Name, string Description);
public record TourInfo(string Name, decimal PerPerson, decimal FamilyPack, int FamilySize, string Pickup, string Drop,
    TourStop[] Stops, string[] Includes, string[] Excludes);

/// <summary>Everything a guest can order. Prices live here, on the server, so the browser cannot change them.</summary>
public static class Catalog
{
    public const string HotelName = "PayStay Hyderabad";

    public static readonly RoomTypeInfo[] RoomTypes =
    {
        new(RoomType.Standard, 2500, 2, new[] { "AC", "Wi-Fi", "TV", "Work desk" }),
        new(RoomType.Deluxe, 3800, 3, new[] { "AC", "Wi-Fi", "Smart TV", "City view", "Mini fridge" }),
        new(RoomType.Suite, 6500, 4, new[] { "AC", "Wi-Fi", "Living area", "Bathtub", "Breakfast" }),
    };

    public static readonly CatalogItem[] Housekeeping =
    {
        new("clean", "Room cleaning", "Full clean and fresh linen", 0),
        new("towels", "Fresh towels", "Bath and hand towels", 0),
        new("pillows", "Extra pillows", "With a blanket", 0),
        new("water", "Drinking water", "2 sealed bottles", 0),
        new("turndown", "Turn-down service", "Evening tidy-up", 0),
        new("laundry", "Laundry pickup", "Charged per item at the desk", 0),
    };

    public static readonly string[] HousekeepingTimes =
        { "As soon as possible", "In 1 hour", "This evening, 6–8 PM", "Tomorrow morning, 9–11 AM" };

    public static readonly CatalogItem[] Menu =
    {
        new("dosa", "Masala Dosa", "Potato masala, coconut chutney, sambar", 180, true, "Breakfast · 7–11 AM"),
        new("idli", "Idli Vada", "2 idli, 1 medu vada, sambar", 150, true, "Breakfast · 7–11 AM"),
        new("poha", "Kanda Poha", "With sev and lemon", 140, true, "Breakfast · 7–11 AM"),
        new("omelette", "Masala Omelette", "2 eggs, buttered toast", 160, false, "Breakfast · 7–11 AM"),
        new("biryani", "Hyderabadi Chicken Dum Biryani", "Mirchi ka salan, raita", 420, false, "Mains · 12–11 PM"),
        new("vbiryani", "Veg Dum Biryani", "Mirchi ka salan, raita", 340, true, "Mains · 12–11 PM"),
        new("paneer", "Paneer Butter Masala", "With 2 butter naan", 360, true, "Mains · 12–11 PM"),
        new("dal", "Dal Tadka and Jeera Rice", "Home-style", 280, true, "Mains · 12–11 PM"),
        new("samosa", "Samosa, 2 pcs", "Mint chutney", 90, true, "Snacks"),
        new("c65", "Chicken 65", "Hyderabad style", 320, false, "Snacks"),
        new("fries", "French Fries", "Peri-peri salt", 160, true, "Snacks"),
        new("irani", "Irani Chai", "Classic Hyderabad tea", 50, true, "Drinks"),
        new("coffee", "Filter Coffee", "South Indian", 70, true, "Drinks"),
        new("lime", "Fresh Lime Soda", "Sweet or salted", 90, true, "Drinks"),
    };

    public static readonly CatalogItem[] Cabs =
    {
        new("airport-drop", "Airport drop", "Rajiv Gandhi International Airport", 1200),
        new("airport-pick", "Airport pickup", "Meet and greet at arrivals", 1200),
        new("station", "Railway station drop", "Secunderabad or Kacheguda", 500),
        new("citytour", "City tour cab", "8 hours, 80 km, with driver", 2800),
    };

    public static readonly TourInfo Tour = new(
        "Hyderabad in a Day", 499, 1499, 4, "9:00 AM", "8:00 PM",
        new[]
        {
            new TourStop("9:00 AM", "Pickup at PayStay Hyderabad", "Guide meets you in the lobby"),
            new TourStop("9:45 AM", "Birla Mandir", "White marble temple on Naubat Pahad, city views"),
            new TourStop("10:45 AM", "Salar Jung Museum", "One of the largest single collections in India"),
            new TourStop("12:30 PM", "Charminar and Laad Bazaar", "Bangles and pearls. Lunch break here, food on your own"),
            new TourStop("2:30 PM", "Chowmahalla Palace", "Seat of the Nizams, restored courtyards"),
            new TourStop("4:00 PM", "Golconda Fort", "Climb to the top for the view at golden hour"),
            new TourStop("6:30 PM", "Hussain Sagar and Tank Bund", "Buddha statue and sunset by the lake"),
            new TourStop("8:00 PM", "Drop at PayStay Hyderabad", "Back in time for dinner"),
        },
        new[] { "AC vehicle with driver", "Pickup and drop at the hotel", "Local guide for the day" },
        new[] { "Food and drinks, pay on your own" });

    public static RoomTypeInfo TypeInfo(RoomType t) => RoomTypes.First(x => x.Type == t);
}
