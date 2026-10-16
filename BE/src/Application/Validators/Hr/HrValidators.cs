using System.Text.RegularExpressions;
using Application.DTOs.Crm;
using Application.DTOs.Hr;
using Application.Validators.Booking;
using Application.Validators.Common;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Hr.DaysOff;
using Domain.Entities.Hr.StaffMembers;
using FluentValidation;

namespace Application.Validators.Hr;

/// <summary>FR-05.</summary>
public sealed partial class SaveStaffMemberRequestValidator : AppValidator<SaveStaffMemberRequest>
{
    public SaveStaffMemberRequestValidator()
    {
        RuleFor(x => x.Code).CatalogCode("mã nhân viên");
        RuleFor(x => x.FullName).NotEmpty().WithMessage("Nhập họ tên")
            .MaximumLength(StaffMember.NameMaxLength).WithMessage("Họ tên tối đa 100 ký tự");
        RuleFor(x => x.Phone).VnPhone();
        RuleFor(x => x.Kind).IsInEnum();
        RuleFor(x => x.Color).Must(v => v is not null && ColorRegex().IsMatch(v)).WithMessage("Chọn màu hiển thị");
        RuleFor(x => x.Specialty).MaximumLength(StaffMember.SpecialtyMaxLength).WithMessage("Mô tả tối đa 150 ký tự");
        RuleFor(x => x.Shifts).Must(s => s is null || s.Count == 7).WithMessage("Lịch tuần gồm 7 ngày");
    }

    [GeneratedRegex("^#[0-9A-Fa-f]{6}$")]
    private static partial Regex ColorRegex();
}

public sealed class UpdateShiftsRequestValidator : AppValidator<UpdateShiftsRequest>
{
    public UpdateShiftsRequestValidator()
    {
        RuleFor(x => x.Shifts).Must(s => s.Count == 7).WithMessage("Lịch tuần gồm 7 ngày");
        RuleForEach(x => x.Shifts).IsInEnum();
    }
}

public sealed class CreateDayOffRequestValidator : AppValidator<CreateDayOffRequest>
{
    public CreateDayOffRequestValidator()
    {
        RuleFor(x => x.Date).NotNull().WithMessage("Chọn ngày nghỉ");
        RuleFor(x => x.Reason).NotEmpty().WithMessage("Nhập lý do")
            .MaximumLength(DayOff.ReasonMaxLength).WithMessage("Lý do tối đa 200 ký tự");
    }
}

/// <summary>FR-34, BR-28.</summary>
public sealed class SaveCustomerRequestValidator : AppValidator<SaveCustomerRequest>
{
    public SaveCustomerRequestValidator()
    {
        RuleFor(x => x.Phone).VnPhone();
        RuleFor(x => x.FullName).NotEmpty().WithMessage("Nhập họ tên")
            .MaximumLength(Customer.NameMaxLength).WithMessage("Họ tên tối đa 100 ký tự");
        RuleFor(x => x.Gender).IsInEnum().When(x => x.Gender is not null);
        RuleFor(x => x.Note).MaximumLength(Customer.NoteMaxLength).WithMessage("Ghi chú tối đa 500 ký tự");
    }
}
