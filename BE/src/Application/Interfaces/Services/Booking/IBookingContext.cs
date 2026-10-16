using Application.Common.Models;
using Application.DTOs.Booking;
using Application.DTOs.Crm;
using Domain.Entities.Booking;

namespace Application.Interfaces.Services.Booking;

/// <summary>Người thao tác của request: họ tên chụp vào bản ghi, quyền hiệu lực.</summary>
public sealed record BookingActor(Guid? UserId, string FullName, UserAccess Access)
{
    public bool Has(string permission) => Access.HasPermission(permission);
}

/// <summary>Thông tin tiệm từ cài đặt <c>Store.*</c>, <c>Brand.*</c> (06 §3).</summary>
public sealed record StoreInfo(string Name, string Address, string Hotline, string? LogoUrl, string BankBin, string BankAccount, string BankAccountName);

/// <summary>
/// Hỗ trợ chung của nghiệp vụ Spa trong một request: đồng hồ theo giờ Việt Nam, người thao tác, dựng lịch một ngày cho
/// <see cref="ScheduleEngine"/>, mã chứng từ, chỉ số khách. Lưu tạm trong phạm vi request.
/// </summary>
public interface IBookingContext
{
    /// <summary>Thời điểm hiện tại (UTC), làm tròn xuống tới giây.</summary>
    DateTime UtcNow { get; }

    DateOnly Today { get; }

    /// <summary>Phút hiện tại trong ngày theo giờ Việt Nam.</summary>
    int NowMinute { get; }

    DateTime ToUtc(DateOnly date, int minute);

    (DateOnly Date, int Minute) ToLocal(DateTime utc);

    Task<BookingActor> GetActorAsync(CancellationToken ct = default);

    /// <summary>Giờ mở, đóng cửa (phút).</summary>
    Task<(int Open, int Close)> GetHoursAsync(CancellationToken ct = default);

    /// <summary>Lịch của ngày <paramref name="date"/>: KTV, ca, ngày nghỉ, dòng chiếm chỗ, khoảng giờ của khách.</summary>
    Task<DaySchedule> LoadDayAsync(DateOnly date, CancellationToken ct = default);

    /// <summary>Mã chứng từ kế tiếp (<c>LH</c>, <c>HD</c>, <c>GL</c> + yyMMdd + 3 số), kể cả mã đã cấp trong request này chưa lưu.</summary>
    Task<string> NextCodeAsync(string prefix, DateOnly date, CancellationToken ct = default);

    Task<StoreInfo> GetStoreAsync(CancellationToken ct = default);

    /// <summary>Số lần không đến trong 90 ngày (BR-13) theo khách.</summary>
    Task<IReadOnlyDictionary<Guid, int>> NoShowCountsAsync(IReadOnlyCollection<Guid> customerIds, CancellationToken ct = default);

    Task<CustomerDto> GetCustomerDtoAsync(Guid customerId, CancellationToken ct = default);

    /// <summary>Gói của khách (mọi trạng thái), kèm ngày trừ buổi gần nhất; lọc theo dịch vụ nếu có.</summary>
    Task<IReadOnlyList<CustomerPackageBrief>> GetCustomerPackagesAsync(Guid customerId, IReadOnlyCollection<Guid>? serviceIds, CancellationToken ct = default);
}
