using Application.DTOs.Booking;
using Application.DTOs.Hr;

namespace Application.Interfaces.Services.Hr;

/// <summary>Nhân viên, dịch vụ làm được, ca tuần (UC-02; 07 §4.3).</summary>
public interface IStaffMemberService
{
    Task<IReadOnlyList<StaffMemberDto>> GetAllAsync(CancellationToken ct = default);
    Task<IReadOnlyList<StaffOption>> GetOptionsAsync(CancellationToken ct = default);
    Task<IReadOnlyList<AccountCandidate>> GetAccountCandidatesAsync(CancellationToken ct = default);
    Task<NextCodeDto> NextCodeAsync(CancellationToken ct = default);
    Task<StaffMemberDto> CreateAsync(SaveStaffMemberRequest request, CancellationToken ct = default);
    Task<StaffMemberDto> UpdateAsync(Guid id, SaveStaffMemberRequest request, CancellationToken ct = default);
    Task<StaffMemberDto> UpdateShiftsAsync(Guid id, UpdateShiftsRequest request, CancellationToken ct = default);
    Task<StaffMemberDto> SetActiveAsync(Guid id, bool isActive, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

/// <summary>Ngày nghỉ đột xuất, ngày tiệm nghỉ (UC-02 1a, FR-07).</summary>
public interface IDayOffService
{
    Task<IReadOnlyList<DayOffDto>> GetAsync(DayOffQuery query, CancellationToken ct = default);
    Task<DayOffDto> CreateAsync(CreateDayOffRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

/// <summary>Bảng hoa hồng tháng, chốt, chi trả, hoa hồng của tôi (UC-11, UC-12).</summary>
public interface ICommissionService
{
    Task<CommissionSheetDto> GetSheetAsync(string? month, CancellationToken ct = default);
    Task<IReadOnlyList<CommissionItemDto>> GetItemsAsync(CommissionItemsQuery query, CancellationToken ct = default);
    Task<CommissionSheetDto> CloseAsync(string month, CancellationToken ct = default);
    Task<CommissionSheetDto> PayAsync(string month, CancellationToken ct = default);
    Task<MyCommissionsDto> GetMineAsync(string? month, CancellationToken ct = default);
}

/// <summary>Lịch của KTV đang đăng nhập (UC-12).</summary>
public interface IMyScheduleService
{
    Task<MyScheduleDto> GetAsync(string? date, CancellationToken ct = default);
}
