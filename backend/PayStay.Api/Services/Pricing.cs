namespace PayStay.Api.Services;

public static class Pricing
{
    /// <summary>GST on hotel rooms: 5% up to ₹7,500 a night, 18% above.</summary>
    public static decimal RoomGstRate(decimal nightlyRate) => nightlyRate <= 7500m ? 0.05m : 0.18m;

    /// <summary>GST on restaurant food served in the hotel.</summary>
    public const decimal FoodGstRate = 0.05m;

    /// <summary>Discount on room charges when a guest uses a friend's referral code.</summary>
    public const decimal ReferralDiscount = 0.10m;

    /// <summary>Consecutive nights needed to earn a referral code.</summary>
    public const int ReferralMinNights = 5;

    public static decimal Round(decimal v) => Math.Round(v, 0, MidpointRounding.AwayFromZero);
}
