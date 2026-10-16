using Domain.Common;
using Domain.Entities.Booking;

namespace Application.Common.Exceptions;

/// <summary>Mã lỗi nghiệp vụ (07 §2.2); FE dựa vào trường <c>code</c> của ProblemDetails.</summary>
public static class BookingErrorCodes
{
    public const string LichKhongHopLe = "LichKhongHopLe";
    public const string GioDaCoNguoiDat = "GioDaCoNguoiDat";
    public const string TrungLichKhach = "TrungLichKhach";
    public const string QuaSoLichCho = "QuaSoLichCho";
    public const string TamKhoaTraCuu = "TamKhoaTraCuu";
    public const string LichBiAnhHuong = "LichBiAnhHuong";
    public const string DaPhatSinh = "DaPhatSinh";
    public const string TrangThaiKhongHopLe = "TrangThaiKhongHopLe";
    public const string TongTienDaDoi = "TongTienDaDoi";
    public const string ThangDaChot = "ThangDaChot";
    public const string GoiDaDung = "GoiDaDung";
    public const string ChuaHetThang = "ChuaHetThang";
}

/// <summary>Tạo exception có <c>code</c> cho ExceptionMiddleware của nền (400 DomainException, 409 ConflictException).</summary>
public static class BookingProblems
{
    public static ConflictException Conflict(string code, string message, string? field = null, IReadOnlyDictionary<string, object?>? extra = null)
    {
        var extensions = new Dictionary<string, object?> { ["code"] = code };
        if (extra is not null)
        {
            foreach (var (key, value) in extra)
                extensions[key] = value;
        }

        return new ConflictException(message, field, extensions);
    }

    public static DomainException Domain(string code, string message, IReadOnlyDictionary<string, object?>? extra = null)
    {
        var extensions = new Dictionary<string, object?> { ["code"] = code };
        if (extra is not null)
        {
            foreach (var (key, value) in extra)
                extensions[key] = value;
        }

        return new DomainException(message, extensions);
    }

    public static ConflictException InvalidState(string message) => Conflict(BookingErrorCodes.TrangThaiKhongHopLe, message);

    public static ConflictException InUse(string message) => Conflict(BookingErrorCodes.DaPhatSinh, message);
}

/// <summary>429 kèm <c>code</c>, <c>retryAfterSeconds</c> (NFR-05). Bộ lọc <c>BookingProblemAttribute</c> của API trả ProblemDetails.</summary>
public sealed class TooManyRequestsException(string message, string code, int retryAfterSeconds) : Exception(message)
{
    public string Code { get; } = code;
    public int RetryAfterSeconds { get; } = retryAfterSeconds;
}

/// <summary>404 kèm <c>code</c>.</summary>
public sealed class CodedNotFoundException(string message, string code) : NotFoundException(message)
{
    public string Code { get; } = code;
}

/// <summary>Lỗi kiểm tra lịch (BR-01 đến BR-05): 400 <c>LichKhongHopLe</c> kèm từng dòng (07 §2.2).</summary>
public static class ScheduleProblem
{
    public static DomainException From(DraftCheck check, Func<int, DateTime> toUtc)
    {
        var first = check.First?.Message ?? "Lịch hẹn không hợp lệ";
        return BookingProblems.Domain(BookingErrorCodes.LichKhongHopLe, first, new Dictionary<string, object?>
        {
            ["issues"] = check.Issues.Select(i => new { i.Code, i.Message }).ToList(),
            ["lines"] = check.Lines.Select(l => new
            {
                l.Index,
                StartAt = toUtc(l.Start),
                EndAt = toUtc(l.End),
                BlockEndAt = toUtc(l.BlockEnd),
                Issues = l.Issues.Select(i => new { i.Code, i.Message }).ToList()
            }).ToList()
        });
    }
}
