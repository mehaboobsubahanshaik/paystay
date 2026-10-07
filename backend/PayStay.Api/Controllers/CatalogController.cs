using Microsoft.AspNetCore.Mvc;
using PayStay.Api.Dtos;
using PayStay.Api.Services;

namespace PayStay.Api.Controllers;

[ApiController]
[Route("api/catalog")]
public class CatalogController : ControllerBase
{
    /// <summary>Room types, housekeeping options, menu, cabs and the city tour, with prices.</summary>
    [HttpGet]
    public CatalogDto Get() => new(Catalog.HotelName, Catalog.RoomTypes, Catalog.Housekeeping, Catalog.HousekeepingTimes,
        Catalog.Menu, Catalog.Cabs, Catalog.Tour, Pricing.ReferralDiscount * 100, Pricing.ReferralMinNights);
}
