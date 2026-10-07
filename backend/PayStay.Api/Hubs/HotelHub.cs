using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using PayStay.Api.Services;

namespace PayStay.Api.Hubs;

/// <summary>
/// Live updates. Owners join the "owners" group; every signed-in user joins "user:{id}".
/// The server sends one event, "changed", with { entity, action, ... } and clients refetch what they show.
/// </summary>
[Authorize]
public class HotelHub : Hub
{
    public const string Owners = "owners";
    public static string UserGroup(Guid id) => $"user:{id}";

    public override async Task OnConnectedAsync()
    {
        var user = Context.User!;
        if (user.IsOwner()) await Groups.AddToGroupAsync(Context.ConnectionId, Owners);
        await Groups.AddToGroupAsync(Context.ConnectionId, UserGroup(user.UserId()));
        await base.OnConnectedAsync();
    }
}

public record HotelEvent(string Entity, string Action, string? Message = null, int? Room = null, Guid? Id = null);

public class Notifier(IHubContext<HotelHub> hub)
{
    public Task ToOwners(HotelEvent e) => hub.Clients.Group(HotelHub.Owners).SendAsync("changed", e);
    public Task ToUser(Guid userId, HotelEvent e) => hub.Clients.Group(HotelHub.UserGroup(userId)).SendAsync("changed", e);
    public Task ToAll(HotelEvent e) => hub.Clients.All.SendAsync("changed", e);
}
