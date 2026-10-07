using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using PayStay.Api.Models;

namespace PayStay.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<OtpCode> OtpCodes => Set<OtpCode>();
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<ServiceRequest> ServiceRequests => Set<ServiceRequest>();
    public DbSet<ReferralCode> ReferralCodes => Set<ReferralCode>();

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>(e =>
        {
            e.HasIndex(x => x.Mobile).IsUnique();
            e.Property(x => x.Mobile).HasMaxLength(10);
            e.Property(x => x.Name).HasMaxLength(80);
            e.Property(x => x.Role).HasConversion<string>().HasMaxLength(16);
        });

        b.Entity<OtpCode>(e =>
        {
            e.HasIndex(x => new { x.Mobile, x.CreatedAt });
            e.Property(x => x.Mobile).HasMaxLength(10);
        });

        b.Entity<Room>(e =>
        {
            e.HasIndex(x => x.Number).IsUnique();
            e.Property(x => x.Type).HasConversion<string>().HasMaxLength(16);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(16);
            e.Property(x => x.Price).HasPrecision(10, 2);
        });

        b.Entity<Booking>(e =>
        {
            e.HasIndex(x => x.Code).IsUnique();
            e.HasIndex(x => new { x.RoomId, x.CheckIn, x.CheckOut });
            e.HasIndex(x => x.GroupId);
            e.Property(x => x.Code).HasMaxLength(16);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(16);
            e.Property(x => x.ReferralCode).HasMaxLength(16);
            foreach (var p in new[] { nameof(Booking.Price), nameof(Booking.Discount), nameof(Booking.Gst), nameof(Booking.Total) })
                e.Property(p).HasPrecision(10, 2);
            e.HasOne(x => x.User).WithMany(u => u.Bookings).HasForeignKey(x => x.UserId);
            e.HasOne(x => x.Room).WithMany().HasForeignKey(x => x.RoomId);
        });

        b.Entity<ServiceRequest>(e =>
        {
            e.Property(x => x.Kind).HasConversion<string>().HasMaxLength(16);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(16);
            e.Property(x => x.Total).HasPrecision(10, 2);
            e.Property(x => x.When).HasMaxLength(80);
            e.Property(x => x.Note).HasMaxLength(140);
            e.Property(x => x.Items)
                .HasColumnType("jsonb")
                .HasConversion(
                    v => JsonSerializer.Serialize(v, Json),
                    v => JsonSerializer.Deserialize<List<RequestItem>>(v, Json) ?? new List<RequestItem>(),
                    new ValueComparer<List<RequestItem>>(
                        (a, c) => JsonSerializer.Serialize(a, Json) == JsonSerializer.Serialize(c, Json),
                        v => JsonSerializer.Serialize(v, Json).GetHashCode(),
                        v => JsonSerializer.Deserialize<List<RequestItem>>(JsonSerializer.Serialize(v, Json), Json)!));
            e.HasOne(x => x.Booking).WithMany().HasForeignKey(x => x.BookingId);
            e.HasIndex(x => new { x.Status, x.CreatedAt });
        });

        b.Entity<ReferralCode>(e =>
        {
            e.HasKey(x => x.Code);
            e.Property(x => x.Code).HasMaxLength(16);
            e.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerUserId);
        });
    }
}
