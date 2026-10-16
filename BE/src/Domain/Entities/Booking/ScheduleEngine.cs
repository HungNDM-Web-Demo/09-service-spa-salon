using Domain.Enums.Hr;

namespace Domain.Entities.Booking;

/// <summary>KTV trong một ngày: ca, ngày nghỉ, dịch vụ làm được.</summary>
public sealed record ScheduleStaff(
    Guid Id,
    string Code,
    string FullName,
    bool IsActive,
    bool IsTechnician,
    ShiftType Shift,
    string? DayOffReason,
    IReadOnlySet<Guid> ServiceIds,
    int SortOrder);

public sealed record ScheduleService(Guid Id, string Name, int Duration, int Cleanup, decimal Price);

/// <summary>Dòng chiếm chỗ của KTV, giờ tính bằng phút trong ngày.</summary>
public sealed record BusyLine(Guid LineId, Guid AppointmentId, Guid StaffId, int Start, int End, int Cleanup)
{
    public int BlockEnd => End + Cleanup;
}

/// <summary>Khoảng [giờ bắt đầu sớm nhất, kết thúc muộn nhất) của một lịch chiếm chỗ (BR-05).</summary>
public sealed record CustomerSpan(Guid AppointmentId, Guid CustomerId, string Code, int Start, int End);

public sealed record ScheduleIssue(string Code, string Message);

/// <summary>Dữ liệu lịch của một ngày để kiểm tra, tính mốc trống. Dựng từ DB (BE) hoặc mock-db (FE) rồi chạy thuần.</summary>
public sealed class DaySchedule
{
    public required DateOnly Date { get; init; }
    public required DateOnly Today { get; init; }

    /// <summary>Phút hiện tại trong ngày <see cref="Today"/> (giờ Việt Nam).</summary>
    public required int NowMinute { get; init; }

    public required int Open { get; init; }
    public required int Close { get; init; }
    public string? ClosedReason { get; init; }
    public required IReadOnlyList<ScheduleStaff> Staff { get; init; }
    public required IReadOnlyList<BusyLine> Busy { get; init; }
    public required IReadOnlyList<CustomerSpan> CustomerSpans { get; init; }

    public ScheduleStaff? FindStaff(Guid id) => Staff.FirstOrDefault(s => s.Id == id);
}

/// <summary>Một dòng của bản nháp. <see cref="Unchanged"/>: dòng đang có, không đổi KTV, giờ, dịch vụ (bỏ kiểm tra giờ đã qua).</summary>
public sealed record DraftLine(Guid? LineId, ScheduleService Service, Guid StaffId, int Start, bool Unchanged = false);

public sealed record LineCheck(int Index, int Start, int End, int BlockEnd, IReadOnlyList<ScheduleIssue> Issues);

public sealed record DraftCheck(IReadOnlyList<LineCheck> Lines, IReadOnlyList<ScheduleIssue> Issues)
{
    public bool Ok => Issues.Count == 0 && Lines.All(l => l.Issues.Count == 0);

    /// <summary>Lỗi đầu tiên (câu báo khi kéo thả, <c>detail</c> của 400 <c>LichKhongHopLe</c>).</summary>
    public ScheduleIssue? First => Lines.SelectMany(l => l.Issues).Concat(Issues).FirstOrDefault();
}

public sealed record Assignment(Guid StaffId, ScheduleService Service, int Start);

/// <summary>
/// Kiểm tra trùng lịch, ca, giờ mở cửa (07 §3.2), mốc trống đặt online và chọn KTV "Bất kỳ ai" (07 §3.3), gợi ý (07 §3.4).
/// Thuần, không đọc DB; FE <c>features/booking/lib/schedule.ts</c> làm giống hệt.
/// </summary>
public static class ScheduleEngine
{
    public static class Codes
    {
        public const string GioQuaKhu = "GioQuaKhu";
        public const string BuocGio = "BuocGio";
        public const string TiemNghi = "TiemNghi";
        public const string NgoaiGioMoCua = "NgoaiGioMoCua";
        public const string ChuaChonKtv = "ChuaChonKtv";
        public const string NghiViec = "NghiViec";
        public const string KhongLamDuoc = "KhongLamDuoc";
        public const string KtvNghi = "KtvNghi";
        public const string NgoaiCa = "NgoaiCa";
        public const string TrungLichKtv = "TrungLichKtv";
        public const string TrungLichKhach = "TrungLichKhach";
        public const string SoDong = "SoDong";
    }

    /// <summary>Kiểm tra một dòng với các dòng chiếm chỗ <paramref name="busy"/> (07 §3.2, trả mọi lỗi theo thứ tự).</summary>
    public static LineCheck CheckLine(DaySchedule day, DraftLine line, int index, IEnumerable<BusyLine> busy)
    {
        var issues = new List<ScheduleIssue>();
        var service = line.Service;
        var start = line.Start;
        var end = start + service.Duration;
        var blockEnd = end + service.Cleanup;

        if (!line.Unchanged)
        {
            if (day.Date < day.Today || (day.Date == day.Today && start < BookingRules.Floor15(day.NowMinute)))
                issues.Add(new(Codes.GioQuaKhu, "Giờ bắt đầu đã qua"));
            if (start % BookingRules.SlotStepMinutes != 0)
                issues.Add(new(Codes.BuocGio, "Giờ bắt đầu theo bước 15 phút"));
        }

        if (day.ClosedReason is not null)
            issues.Add(new(Codes.TiemNghi, $"Tiệm nghỉ ngày {BookingRules.FormatDate(day.Date)} ({day.ClosedReason})"));
        if (start < day.Open)
            issues.Add(new(Codes.NgoaiGioMoCua, $"Trước giờ mở cửa ({BookingRules.Hhmm(day.Open)})"));
        var endPastClose = end > day.Close;
        if (endPastClose)
            issues.Add(new(Codes.NgoaiGioMoCua, $"Kết thúc {BookingRules.Hhmm(end)}, quá giờ đóng cửa ({BookingRules.Hhmm(day.Close)})"));

        var staff = day.FindStaff(line.StaffId);
        if (staff is null)
        {
            issues.Add(new(Codes.ChuaChonKtv, "Chọn kỹ thuật viên"));
            return new LineCheck(index, start, end, blockEnd, issues);
        }

        if (!staff.IsActive)
            issues.Add(new(Codes.NghiViec, $"{staff.FullName} đã nghỉ việc"));
        if (!staff.ServiceIds.Contains(service.Id))
            issues.Add(new(Codes.KhongLamDuoc, $"{staff.FullName} không làm được {service.Name}"));

        if (staff.DayOffReason is not null)
        {
            issues.Add(new(Codes.KtvNghi, $"{staff.FullName} nghỉ ngày {BookingRules.FormatDate(day.Date)} ({staff.DayOffReason})"));
        }
        else if (BookingRules.ShiftWindow(staff.Shift, day.Open, day.Close) is not { } window)
        {
            issues.Add(new(Codes.KtvNghi, $"{staff.FullName} nghỉ {BookingRules.DayOfWeekLabel(BookingRules.IsoDayOfWeek(day.Date))}"));
        }
        else if ((start < window.Start && start >= day.Open) || (end > window.End && !endPastClose))
        {
            issues.Add(new(Codes.NgoaiCa, $"Ngoài ca làm ({BookingRules.ShiftLabel(staff.Shift, day.Open, day.Close)})"));
        }

        var conflict = busy
            .Where(b => b.StaffId == staff.Id && BookingRules.Overlaps(start, blockEnd, b.Start, b.BlockEnd))
            .OrderBy(b => b.Start)
            .FirstOrDefault();
        if (conflict is not null)
        {
            var message = start >= conflict.Start
                ? $"{staff.FullName} bận tới {BookingRules.Hhmm(conflict.BlockEnd)}{(conflict.Cleanup > 0 ? " (gồm thời gian dọn)" : "")}"
                : $"{staff.FullName} có lịch lúc {BookingRules.Hhmm(conflict.Start)}{(service.Cleanup > 0 && end <= conflict.Start ? $", cần thêm {service.Cleanup} phút dọn sau dịch vụ" : "")}";
            issues.Add(new(Codes.TrungLichKtv, message));
        }

        return new LineCheck(index, start, end, blockEnd, issues);
    }

    /// <summary>
    /// Kiểm tra cả bản nháp (07 §3.2): từng dòng với lịch đã lưu (trừ chính lịch đang sửa) và các dòng khác của bản nháp;
    /// số dòng; trùng lịch của khách (BR-05).
    /// </summary>
    public static DraftCheck CheckDraft(DaySchedule day, IReadOnlyList<DraftLine> lines, Guid? appointmentId, Guid? customerId)
    {
        var saved = day.Busy.Where(b => appointmentId is null || b.AppointmentId != appointmentId.Value).ToList();
        var self = appointmentId ?? Guid.Empty;
        var checks = new List<LineCheck>();
        for (var i = 0; i < lines.Count; i++)
        {
            var others = lines
                .Select((l, j) => (l, j))
                .Where(x => x.j != i)
                .Select(x => new BusyLine(x.l.LineId ?? Guid.Empty, self, x.l.StaffId, x.l.Start, x.l.Start + x.l.Service.Duration, x.l.Service.Cleanup));
            checks.Add(CheckLine(day, lines[i], i, saved.Concat(others)));
        }

        var issues = new List<ScheduleIssue>();
        if (lines.Count == 0)
            issues.Add(new(Codes.SoDong, "Thêm ít nhất một dịch vụ"));
        else if (lines.Count > BookingRules.MaxLines)
            issues.Add(new(Codes.SoDong, $"Lịch hẹn tối đa {BookingRules.MaxLines} dịch vụ"));

        if (customerId is { } cid && lines.Count > 0)
        {
            var spanStart = lines.Min(l => l.Start);
            var spanEnd = lines.Max(l => l.Start + l.Service.Duration);
            var other = day.CustomerSpans
                .Where(c => c.CustomerId == cid && c.AppointmentId != self && BookingRules.Overlaps(spanStart, spanEnd, c.Start, c.End))
                .OrderBy(c => c.Start)
                .FirstOrDefault();
            if (other is not null)
                issues.Add(new(Codes.TrungLichKhach, $"Khách đã có lịch {other.Code} {BookingRules.Hhmm(other.Start)}–{BookingRules.Hhmm(other.End)}"));
        }

        return new DraftCheck(checks, issues);
    }

    /// <summary>Tổng phút dịch vụ đã xếp cho KTV trong ngày (không tính thời gian dọn, BR-07).</summary>
    public static int BookedMinutes(DaySchedule day, Guid staffId) =>
        day.Busy.Where(b => b.StaffId == staffId).Sum(b => b.End - b.Start);

    /// <summary>
    /// Giao các dịch vụ nối tiếp bắt đầu lúc <paramref name="start"/> (07 §3.3 bước 3–5). <paramref name="staffId"/> null là "Bất kỳ ai".
    /// Trả null khi mốc không hợp lệ.
    /// </summary>
    public static IReadOnlyList<Assignment>? AssignOnline(DaySchedule day, IReadOnlyList<ScheduleService> services, Guid? staffId, int start)
    {
        if (services.Count == 0 || day.ClosedReason is not null)
            return null;

        if (staffId is { } chosen)
        {
            var staff = day.FindStaff(chosen);
            return staff is null || !staff.IsTechnician ? null : TryWholeStaff(day, services, staff, start);
        }

        var candidates = day.Staff
            .Where(s => s.IsActive && s.IsTechnician && services.All(x => s.ServiceIds.Contains(x.Id)))
            .OrderBy(s => BookedMinutes(day, s.Id))
            .ThenBy(s => s.Code, StringComparer.Ordinal);
        foreach (var candidate in candidates)
        {
            var whole = TryWholeStaff(day, services, candidate, start);
            if (whole is not null)
                return whole;
        }

        // Không ai giao trọn được: gán từng dòng theo cùng quy tắc.
        var assigned = new List<Assignment>();
        var extra = new Dictionary<Guid, int>();
        Assignment? previous = null;
        foreach (var service in services)
        {
            Assignment? best = null;
            var bestMinutes = int.MaxValue;
            string? bestCode = null;
            foreach (var staff in day.Staff.Where(s => s.IsActive && s.IsTechnician && s.ServiceIds.Contains(service.Id)))
            {
                var at = previous is null
                    ? start
                    : previous.StaffId == staff.Id
                        ? BookingRules.Ceil15(previous.Start + previous.Service.Duration + previous.Service.Cleanup)
                        : previous.Start + previous.Service.Duration;
                if (!IsFree(day, new DraftLine(null, service, staff.Id, at), assigned))
                    continue;
                var minutes = BookedMinutes(day, staff.Id) + extra.GetValueOrDefault(staff.Id);
                if (minutes < bestMinutes || (minutes == bestMinutes && string.CompareOrdinal(staff.Code, bestCode) < 0))
                {
                    best = new Assignment(staff.Id, service, at);
                    bestMinutes = minutes;
                    bestCode = staff.Code;
                }
            }

            if (best is null)
                return null;
            assigned.Add(best);
            extra[best.StaffId] = extra.GetValueOrDefault(best.StaffId) + service.Duration;
            previous = best;
        }

        return assigned;
    }

    /// <summary>Mốc giờ trống đặt online (FR-19), bước 30 phút, không sớm hơn <paramref name="minStart"/>.</summary>
    public static IReadOnlyList<int> OnlineSlots(DaySchedule day, IReadOnlyList<ScheduleService> services, Guid? staffId, int minStart)
    {
        var slots = new List<int>();
        if (day.ClosedReason is not null || services.Count == 0)
            return slots;
        var total = services.Sum(s => s.Duration);
        for (var t = day.Open; t + total <= day.Close; t += BookingRules.OnlineStepMinutes)
        {
            if (t >= minStart && AssignOnline(day, services, staffId, t) is not null)
                slots.Add(t);
        }

        return slots;
    }

    /// <summary>KTV khác rảnh và 3 giờ trống gần nhất của KTV đang chọn (FR-11, 07 §3.4).</summary>
    public static (IReadOnlyList<ScheduleStaff> FreeStaff, IReadOnlyList<int> NextSlots) Suggest(
        DaySchedule day,
        ScheduleService service,
        Guid currentStaffId,
        int start,
        IReadOnlyList<DraftLine> otherDraftLines,
        Guid? appointmentId)
    {
        var self = appointmentId ?? Guid.Empty;
        var busy = day.Busy.Where(b => appointmentId is null || b.AppointmentId != self)
            .Concat(otherDraftLines.Select(l => new BusyLine(l.LineId ?? Guid.Empty, self, l.StaffId, l.Start, l.Start + l.Service.Duration, l.Service.Cleanup)))
            .ToList();
        bool Ok(Guid staffId, int at) => CheckLine(day, new DraftLine(null, service, staffId, at), 0, busy).Issues.Count == 0;

        var free = day.Staff
            .Where(s => s.Id != currentStaffId && s.IsActive && s.IsTechnician && s.ServiceIds.Contains(service.Id))
            .Where(s => Ok(s.Id, start))
            .OrderBy(s => s.Code, StringComparer.Ordinal)
            .ToList();

        var slots = new List<int>();
        if (day.Date >= day.Today)
        {
            var from = day.Date == day.Today ? Math.Max(day.Open, BookingRules.Floor15(day.NowMinute)) : day.Open;
            from = BookingRules.Ceil15(from);
            for (var t = from; t + service.Duration <= day.Close; t += BookingRules.SlotStepMinutes)
            {
                if (Ok(currentStaffId, t))
                    slots.Add(t);
            }
        }

        var nearest = slots.OrderBy(t => Math.Abs(t - start)).ThenBy(t => t).Take(3).OrderBy(t => t).ToList();
        return (free, nearest);
    }

    private static List<Assignment>? TryWholeStaff(DaySchedule day, IReadOnlyList<ScheduleService> services, ScheduleStaff staff, int start)
    {
        if (!services.All(s => staff.ServiceIds.Contains(s.Id)))
            return null;
        var assigned = new List<Assignment>();
        var at = start;
        foreach (var service in services)
        {
            if (!IsFree(day, new DraftLine(null, service, staff.Id, at), assigned))
                return null;
            assigned.Add(new Assignment(staff.Id, service, at));
            at = BookingRules.Ceil15(at + service.Duration + service.Cleanup);
        }

        return assigned;
    }

    private static bool IsFree(DaySchedule day, DraftLine line, IEnumerable<Assignment> assigned)
    {
        var busy = day.Busy.Concat(assigned.Select(a => new BusyLine(Guid.Empty, Guid.Empty, a.StaffId, a.Start, a.Start + a.Service.Duration, a.Service.Cleanup)));
        return CheckLine(day, line, 0, busy).Issues.Count == 0;
    }
}
