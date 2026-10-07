using Microsoft.EntityFrameworkCore;
using PayStay.Api.Models;
using PayStay.Api.Services;

namespace PayStay.Api.Data;

public static class DbInitializer
{
    /// <summary>Creates the schema if needed, adds the double-booking guard, the 50 rooms and the owner account.</summary>
    public static async Task InitializeAsync(AppDbContext db, string ownerMobile, ILogger log)
    {
        await db.Database.EnsureCreatedAsync();

        // Database-level guard: two confirmed bookings for one room can never overlap.
        try
        {
            await db.Database.ExecuteSqlRawAsync("CREATE EXTENSION IF NOT EXISTS btree_gist;");
            await db.Database.ExecuteSqlRawAsync(@"
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_no_overlap') THEN
    ALTER TABLE ""Bookings"" ADD CONSTRAINT bookings_no_overlap
      EXCLUDE USING gist (""RoomId"" WITH =, daterange(""CheckIn"", ""CheckOut"") WITH &&)
      WHERE (""Status"" = 'Confirmed');
  END IF;
END $$;");
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "Could not add the overlap constraint (needs the btree_gist extension). Booking checks still run in the API.");
        }

        if (!await db.Rooms.AnyAsync())
        {
            for (var floor = 1; floor <= 5; floor++)
            for (var i = 1; i <= 10; i++)
            {
                var type = i <= 5 ? RoomType.Standard : i <= 8 ? RoomType.Deluxe : RoomType.Suite;
                var info = Catalog.TypeInfo(type);
                db.Rooms.Add(new Room { Number = floor * 100 + i, Floor = floor, Type = type, Price = info.Price, Capacity = info.Capacity, Amenities = info.Amenities });
            }
            log.LogInformation("Added 50 rooms.");
        }

        if (!await db.Users.AnyAsync(u => u.Mobile == ownerMobile))
        {
            db.Users.Add(new User { Mobile = ownerMobile, Name = "Hotel owner", Role = UserRole.Owner });
            log.LogInformation("Added owner account ******{Last4}.", ownerMobile[^4..]);
        }
        await db.SaveChangesAsync();
    }
}
