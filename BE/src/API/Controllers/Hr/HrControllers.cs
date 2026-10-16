using API.Controllers.Booking;
using API.Filters;
using Application.DTOs.Booking;
using Application.DTOs.Hr;
using Application.Interfaces.Services.Hr;
using Microsoft.AspNetCore.Mvc;
using P = Application.Constants.ProjectPermissions;

namespace API.Controllers.Hr;

/// <summary>Nhân viên, dịch vụ làm được, ca tuần (07 §4.3).</summary>
[Route("api/staff-members")]
public sealed class StaffMembersController(IStaffMemberService service) : BookingControllerBase
{
    [HttpGet]
    [AuthorizePermission(P.StaffMembers.View)]
    public Task<IReadOnlyList<StaffMemberDto>> GetAll(CancellationToken ct) => service.GetAllAsync(ct);

    [HttpGet("options")]
    public Task<IReadOnlyList<StaffOption>> GetOptions(CancellationToken ct) => service.GetOptionsAsync(ct);

    [HttpGet("account-candidates")]
    [AuthorizePermission(P.StaffMembers.Update, P.StaffMembers.Create)]
    public Task<IReadOnlyList<AccountCandidate>> GetAccountCandidates(CancellationToken ct) => service.GetAccountCandidatesAsync(ct);

    [HttpGet("next-code")]
    [AuthorizePermission(P.StaffMembers.Create)]
    public Task<NextCodeDto> NextCode(CancellationToken ct) => service.NextCodeAsync(ct);

    [HttpPost]
    [AuthorizePermission(P.StaffMembers.Create)]
    public async Task<IActionResult> Create(SaveStaffMemberRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await service.CreateAsync(request, ct));

    [HttpPut("{id:guid}")]
    [AuthorizePermission(P.StaffMembers.Update)]
    public Task<StaffMemberDto> Update(Guid id, SaveStaffMemberRequest request, CancellationToken ct) => service.UpdateAsync(id, request, ct);

    [HttpPut("{id:guid}/shifts")]
    [AuthorizePermission(P.StaffMembers.Update)]
    public Task<StaffMemberDto> UpdateShifts(Guid id, UpdateShiftsRequest request, CancellationToken ct) => service.UpdateShiftsAsync(id, request, ct);

    [HttpPatch("{id:guid}/status")]
    [AuthorizePermission(P.StaffMembers.Update)]
    public Task<StaffMemberDto> SetStatus(Guid id, SetActiveRequest request, CancellationToken ct) => service.SetActiveAsync(id, request.IsActive, ct);

    [HttpDelete("{id:guid}")]
    [AuthorizePermission(P.StaffMembers.Delete)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return NoContent();
    }
}

/// <summary>Ngày nghỉ đột xuất, ngày tiệm nghỉ (07 §4.3).</summary>
[Route("api/days-off")]
public sealed class DaysOffController(IDayOffService service) : BookingControllerBase
{
    [HttpGet]
    [AuthorizePermission(P.StaffMembers.View)]
    public Task<IReadOnlyList<DayOffDto>> GetAll([FromQuery] DayOffQuery query, CancellationToken ct) => service.GetAsync(query, ct);

    [HttpPost]
    [AuthorizePermission(P.StaffMembers.Update)]
    public async Task<IActionResult> Create(CreateDayOffRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await service.CreateAsync(request, ct));

    [HttpDelete("{id:guid}")]
    [AuthorizePermission(P.StaffMembers.Update)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return NoContent();
    }
}

/// <summary>Bảng hoa hồng tháng, hoa hồng của tôi (07 §4.8).</summary>
[Route("api/commissions")]
public sealed class CommissionsController(ICommissionService service) : BookingControllerBase
{
    [HttpGet("sheet")]
    [AuthorizePermission(P.Commissions.View)]
    public Task<CommissionSheetDto> GetSheet([FromQuery] MonthQuery query, CancellationToken ct) => service.GetSheetAsync(query.Month, ct);

    [HttpGet("items")]
    [AuthorizePermission(P.Commissions.View)]
    public Task<IReadOnlyList<CommissionItemDto>> GetItems([FromQuery] CommissionItemsQuery query, CancellationToken ct) => service.GetItemsAsync(query, ct);

    [HttpPost("{month}/close")]
    [AuthorizePermission(P.Commissions.Close)]
    public Task<CommissionSheetDto> Close(string month, CancellationToken ct) => service.CloseAsync(month, ct);

    [HttpPost("{month}/pay")]
    [AuthorizePermission(P.Commissions.Close)]
    public Task<CommissionSheetDto> Pay(string month, CancellationToken ct) => service.PayAsync(month, ct);

    [HttpGet("my")]
    [AuthorizePermission(P.Commissions.ViewOwn)]
    public Task<MyCommissionsDto> GetMine([FromQuery] MonthQuery query, CancellationToken ct) => service.GetMineAsync(query.Month, ct);
}

/// <summary>Lịch của kỹ thuật viên đang đăng nhập (07 §4.8).</summary>
[Route("api/my-schedule")]
public sealed class MyScheduleController(IMyScheduleService service) : BookingControllerBase
{
    [HttpGet]
    [AuthorizePermission(P.Appointments.ViewOwn)]
    public Task<MyScheduleDto> Get([FromQuery] DateQuery query, CancellationToken ct) => service.GetAsync(query.Date, ct);
}
