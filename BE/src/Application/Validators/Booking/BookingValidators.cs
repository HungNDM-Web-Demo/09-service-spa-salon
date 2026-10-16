using System.Text.RegularExpressions;
using Application.DTOs.Booking;
using Application.Validators.Common;
using Domain.Entities.Booking;
using Domain.Entities.Booking.Appointments;
using Domain.Entities.Booking.Invoices;
using Domain.Entities.Booking.PackageTemplates;
using Domain.Entities.Booking.Services;
using Domain.Enums.Booking;
using FluentValidation;

namespace Application.Validators.Booking;

/// <summary>Quy tắc dùng chung của dự án Spa.</summary>
public static partial class BookingValidationRules
{
    /// <summary>Mã danh mục: 2–10 ký tự in hoa không dấu hoặc số, vd DV001.</summary>
    public static IRuleBuilderOptions<T, string?> CatalogCode<T>(this IRuleBuilder<T, string?> rule, string label) =>
        rule.NotEmpty().WithMessage($"Nhập {label}")
            .Must(v => v is not null && CodeRegex().IsMatch(v.Trim())).WithMessage($"{char.ToUpper(label[0])}{label[1..]} gồm 2–10 chữ in hoa không dấu hoặc số");

    /// <summary>BR-28: 10 chữ số, bắt đầu bằng 0.</summary>
    public static IRuleBuilderOptions<T, string?> VnPhone<T>(this IRuleBuilder<T, string?> rule) =>
        rule.NotEmpty().WithMessage("Nhập số điện thoại")
            .Must(v => v is not null && PhoneRegex().IsMatch(Digits(v))).WithMessage("Số điện thoại gồm 10 chữ số, bắt đầu bằng 0");

    public static IRuleBuilderOptions<T, decimal> Thousand<T>(this IRuleBuilder<T, decimal> rule, string message) =>
        rule.Must(v => v % 1000 == 0).WithMessage(message);

    /// <summary>Bỏ khoảng trắng, dấu chấm, gạch ngang của số điện thoại người dùng gõ.</summary>
    public static string Digits(string value) => NonDigitRegex().Replace(value, string.Empty);

    [GeneratedRegex("^[A-Z0-9]{2,10}$")]
    private static partial Regex CodeRegex();

    [GeneratedRegex(@"^0\d{9}$")]
    private static partial Regex PhoneRegex();

    [GeneratedRegex(@"[\s.\-]")]
    private static partial Regex NonDigitRegex();
}

public sealed class SaveServiceGroupRequestValidator : AppValidator<SaveServiceGroupRequest>
{
    public SaveServiceGroupRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Nhập tên nhóm")
            .MaximumLength(ServiceGroup.NameMaxLength).WithMessage($"Tên nhóm tối đa {ServiceGroup.NameMaxLength} ký tự");
    }
}

/// <summary>FR-03, BR-02, BR-23, UC-01 E2.</summary>
public sealed class SaveServiceRequestValidator : AppValidator<SaveServiceRequest>
{
    public SaveServiceRequestValidator()
    {
        RuleFor(x => x.Code).CatalogCode("mã dịch vụ");
        RuleFor(x => x.Name).NotEmpty().WithMessage("Nhập tên dịch vụ")
            .MaximumLength(Service.NameMaxLength).WithMessage($"Tên dịch vụ tối đa {Service.NameMaxLength} ký tự");
        RuleFor(x => x.GroupId).NotEmpty().WithMessage("Chọn nhóm dịch vụ");
        RuleFor(x => x.DurationMinutes)
            .Must(v => v % BookingRules.SlotStepMinutes == 0).WithMessage("Thời lượng là bội số 15 phút")
            .InclusiveBetween(BookingRules.DurationMin, BookingRules.DurationMax).WithMessage("Thời lượng từ 15 đến 240 phút");
        RuleFor(x => x.CleanupMinutes)
            .Must(v => v % 5 == 0).WithMessage("Thời gian dọn là bội số 5 phút")
            .InclusiveBetween(0, BookingRules.CleanupMax).WithMessage("Thời gian dọn từ 0 đến 30 phút");
        RuleFor(x => x.Price)
            .GreaterThanOrEqualTo(0).WithMessage("Giá không được âm")
            .Thousand("Giá là bội số 1.000 ₫");
        RuleFor(x => x.Description).MaximumLength(Service.DescriptionMaxLength).WithMessage("Mô tả tối đa 1.000 ký tự");
        RuleFor(x => x.ImageUrl).MaximumLength(Service.ImageUrlMaxLength);
        RuleFor(x => x.CommissionType).IsInEnum();
        RuleFor(x => x.CommissionValue)
            .InclusiveBetween(0, BookingRules.MaxCommissionPercent).WithMessage("Hoa hồng phần trăm từ 0 đến 50%")
            .When(x => x.CommissionType == CommissionType.PhanTram);
        RuleFor(x => x.CommissionValue)
            .GreaterThanOrEqualTo(0).WithMessage("Hoa hồng không được âm")
            .Thousand("Hoa hồng cố định là bội số 1.000 ₫")
            .When(x => x.CommissionType == CommissionType.CoDinh);
    }
}

/// <summary>FR-04.</summary>
public sealed class SavePackageTemplateRequestValidator : AppValidator<SavePackageTemplateRequest>
{
    public SavePackageTemplateRequestValidator()
    {
        RuleFor(x => x.Code).CatalogCode("mã gói");
        RuleFor(x => x.Name).NotEmpty().WithMessage("Nhập tên gói")
            .MaximumLength(PackageTemplate.NameMaxLength).WithMessage($"Tên gói tối đa {PackageTemplate.NameMaxLength} ký tự");
        RuleFor(x => x.ServiceId).NotEmpty().WithMessage("Chọn dịch vụ áp dụng");
        RuleFor(x => x.Sessions).InclusiveBetween(BookingRules.SessionsMin, BookingRules.SessionsMax).WithMessage("Số buổi từ 2 đến 50");
        RuleFor(x => x.Price).GreaterThan(0).WithMessage("Nhập giá gói").Thousand("Giá gói là bội số 1.000 ₫");
        RuleFor(x => x.ValidityMonths).InclusiveBetween(1, BookingRules.ValidityMonthsMax).WithMessage("Hạn dùng từ 1 đến 36 tháng");
        RuleFor(x => x.MinIntervalDays).InclusiveBetween(0, BookingRules.MinIntervalDaysMax).WithMessage("Khoảng cách tối thiểu từ 0 đến 90 ngày");
        RuleFor(x => x.CommissionRate).InclusiveBetween(0, BookingRules.MaxCommissionPercent).WithMessage("Tỉ lệ hoa hồng bán gói từ 0 đến 50%");
    }
}

public sealed class UpdateBusinessHoursRequestValidator : AppValidator<UpdateBusinessHoursRequest>
{
    public UpdateBusinessHoursRequestValidator()
    {
        RuleFor(x => x.OpenTime)
            .Must(v => BookingRules.TryParseHhmm(v, out var m) && m % BookingRules.SlotStepMinutes == 0)
            .WithMessage("Giờ mở cửa dạng HH:mm, bước 15 phút");
        RuleFor(x => x.CloseTime)
            .Must(v => BookingRules.TryParseHhmm(v, out var m) && m % BookingRules.SlotStepMinutes == 0)
            .WithMessage("Giờ đóng cửa dạng HH:mm, bước 15 phút")
            .Must(v => BookingRules.TryParseHhmm(v, out var m) && m <= BookingRules.LatestCloseMinute)
            .WithMessage("Giờ đóng cửa muộn nhất 23:00")
            .Must((x, v) => BookingRules.TryParseHhmm(x.OpenTime, out var open) && BookingRules.TryParseHhmm(v, out var close)
                            && close - open >= BookingRules.MinOpenHours * 60)
            .WithMessage("Tiệm mở cửa tối thiểu 4 giờ mỗi ngày");
    }
}

public sealed class DraftLineRequestValidator : AppValidator<DraftLineRequest>
{
    public DraftLineRequestValidator()
    {
        RuleFor(x => x.ServiceId).NotEmpty().WithMessage("Chọn dịch vụ");
        RuleFor(x => x.StaffMemberId).NotEmpty().WithMessage("Chọn kỹ thuật viên");
        RuleFor(x => x.StartAt).NotEmpty().WithMessage("Chọn giờ bắt đầu");
    }
}

public sealed class CreateAppointmentRequestValidator : AppValidator<CreateAppointmentRequest>
{
    public CreateAppointmentRequestValidator()
    {
        RuleFor(x => x.Lines).NotEmpty().WithMessage("Thêm ít nhất một dịch vụ")
            .Must(l => l.Count <= BookingRules.MaxLines).WithMessage("Lịch hẹn tối đa 5 dịch vụ");
        RuleForEach(x => x.Lines).SetValidator(new DraftLineRequestValidator());
        RuleFor(x => x.Source).IsInEnum();
        RuleFor(x => x.Note).MaximumLength(Appointment.NoteMaxLength).WithMessage("Ghi chú tối đa 500 ký tự");
        RuleFor(x => x.NewCustomer).NotNull().WithMessage("Nhập số điện thoại khách").When(x => x.CustomerId is null);
        When(x => x.CustomerId is null && x.NewCustomer is not null, () =>
        {
            RuleFor(x => x.NewCustomer!.Phone).VnPhone().OverridePropertyName("newCustomer.phone");
            RuleFor(x => x.NewCustomer!.FullName).NotEmpty().WithMessage("Nhập tên khách").OverridePropertyName("newCustomer.fullName")
                .MaximumLength(100).WithMessage("Tên khách tối đa 100 ký tự");
        });
    }
}

public sealed class UpdateAppointmentRequestValidator : AppValidator<UpdateAppointmentRequest>
{
    public UpdateAppointmentRequestValidator()
    {
        RuleFor(x => x.Lines).NotEmpty().WithMessage("Lịch hẹn còn ít nhất một dịch vụ")
            .Must(l => l.Count <= BookingRules.MaxLines).WithMessage("Lịch hẹn tối đa 5 dịch vụ");
        RuleForEach(x => x.Lines).SetValidator(new DraftLineRequestValidator());
        RuleFor(x => x.Note).MaximumLength(Appointment.NoteMaxLength).WithMessage("Ghi chú tối đa 500 ký tự");
    }
}

public sealed class CancelAppointmentRequestValidator : AppValidator<CancelAppointmentRequest>
{
    public CancelAppointmentRequestValidator()
    {
        RuleFor(x => x.Reason).IsInEnum().WithMessage("Chọn lý do");
        RuleFor(x => x.Note).NotEmpty().WithMessage("Ghi rõ lý do").When(x => x.Reason == CancelReason.Khac);
        RuleFor(x => x.Note).MaximumLength(Appointment.CancelNoteMaxLength).WithMessage("Ghi chú tối đa 200 ký tự");
    }
}

/// <summary>FR-18, BR-06, BR-28.</summary>
public sealed class PublicBookingRequestValidator : AppValidator<PublicBookingRequest>
{
    public PublicBookingRequestValidator()
    {
        RuleFor(x => x.ServiceIds).NotEmpty().WithMessage("Chọn ít nhất một dịch vụ")
            .Must(s => s.Count <= BookingRules.OnlineMaxServices).WithMessage("Chọn tối đa 3 dịch vụ")
            .Must(s => s.Distinct().Count() == s.Count).WithMessage("Mỗi dịch vụ chọn một lần");
        RuleFor(x => x.StartAt).NotEmpty().WithMessage("Chọn giờ");
        RuleFor(x => x.FullName).NotEmpty().WithMessage("Nhập họ tên").MaximumLength(100).WithMessage("Họ tên tối đa 100 ký tự");
        RuleFor(x => x.Phone).VnPhone();
        RuleFor(x => x.Note).MaximumLength(Appointment.NoteMaxLength).WithMessage("Ghi chú tối đa 500 ký tự");
    }
}

public sealed class PublicLookupRequestValidator : AppValidator<PublicLookupRequest>
{
    public PublicLookupRequestValidator()
    {
        RuleFor(x => x.Code).NotEmpty().WithMessage("Nhập mã lịch hẹn");
        RuleFor(x => x.Phone).VnPhone();
    }
}

public sealed class PublicCancelRequestValidator : AppValidator<PublicCancelRequest>
{
    public PublicCancelRequestValidator()
    {
        RuleFor(x => x.Code).NotEmpty().WithMessage("Nhập mã lịch hẹn");
        RuleFor(x => x.Phone).VnPhone();
        RuleFor(x => x.Reason).MaximumLength(Appointment.CancelNoteMaxLength).WithMessage("Lý do tối đa 200 ký tự");
    }
}

public sealed class CheckoutRequestValidator : AppValidator<CheckoutRequest>
{
    public CheckoutRequestValidator()
    {
        RuleFor(x => x.AppointmentId).NotEmpty();
        RuleFor(x => x.ClientRequestId).MaximumLength(Invoice.ClientRequestIdMaxLength);
        RuleFor(x => x.Method).IsInEnum();
        RuleFor(x => x.IntervalOverrideReason).MaximumLength(Invoice.ReasonMaxLength).WithMessage("Lý do tối đa 200 ký tự");
        RuleForEach(x => x.SellPackages).ChildRules(s =>
        {
            s.RuleFor(x => x.PackageTemplateId).NotEmpty().WithMessage("Chọn gói");
            s.RuleFor(x => x.ConsultantStaffId).NotEmpty().WithMessage("Chọn người tư vấn");
        });
        RuleFor(x => x.Discount!.Reason).MaximumLength(Invoice.DiscountReasonMaxLength).OverridePropertyName("discount.reason")
            .When(x => x.Discount is not null);
    }
}

/// <summary>UC-09 E1.</summary>
public sealed class PackageSaleRequestValidator : AppValidator<PackageSaleRequest>
{
    public PackageSaleRequestValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty().WithMessage("Chọn khách");
        RuleFor(x => x.PackageTemplateId).NotEmpty().WithMessage("Chọn gói");
        RuleFor(x => x.ConsultantStaffId).NotEmpty().WithMessage("Chọn người tư vấn");
        RuleFor(x => x.Method).IsInEnum();
        RuleFor(x => x.ClientRequestId).MaximumLength(Invoice.ClientRequestIdMaxLength);
    }
}

public sealed class CancelInvoiceRequestValidator : AppValidator<CancelInvoiceRequest>
{
    public CancelInvoiceRequestValidator()
    {
        RuleFor(x => x.Reason).NotEmpty().WithMessage("Nhập lý do hủy hóa đơn")
            .MaximumLength(Invoice.ReasonMaxLength).WithMessage("Lý do tối đa 200 ký tự");
    }
}

/// <summary>FR-29, BR-20.</summary>
public sealed class ExtendPackageRequestValidator : AppValidator<ExtendPackageRequest>
{
    public ExtendPackageRequestValidator()
    {
        RuleFor(x => x.Days).InclusiveBetween(1, BookingRules.MaxExtendDays).WithMessage("Gia hạn từ 1 đến 60 ngày");
        RuleFor(x => x.Reason).NotEmpty().WithMessage("Nhập lý do gia hạn").MaximumLength(200).WithMessage("Lý do tối đa 200 ký tự");
    }
}
