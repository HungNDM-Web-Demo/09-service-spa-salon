using Domain.Entities.Booking.Services;
using Domain.Entities.Hr.Commissions;
using Domain.Entities.Hr.DaysOff;
using Domain.Entities.Hr.StaffMembers;
using Domain.Entities.System.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations.Hr;

public sealed class StaffMemberConfiguration : IEntityTypeConfiguration<StaffMember>
{
    public void Configure(EntityTypeBuilder<StaffMember> builder)
    {
        builder.ToTable("Hr_StaffMembers");
        builder.Property(x => x.Code).HasMaxLength(StaffMember.CodeMaxLength).IsRequired();
        builder.Property(x => x.FullName).HasMaxLength(StaffMember.NameMaxLength).IsRequired();
        builder.Property(x => x.Phone).HasMaxLength(StaffMember.PhoneMaxLength).IsRequired();
        builder.Property(x => x.Color).HasMaxLength(StaffMember.ColorMaxLength).IsRequired();
        builder.Property(x => x.Specialty).HasMaxLength(StaffMember.SpecialtyMaxLength);
        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasIndex(x => x.UserId).IsUnique();
        builder.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.SetNull);
        builder.HasMany(x => x.Services).WithOne().HasForeignKey(x => x.StaffMemberId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(x => x.Shifts).WithOne().HasForeignKey(x => x.StaffMemberId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class StaffServiceConfiguration : IEntityTypeConfiguration<StaffService>
{
    public void Configure(EntityTypeBuilder<StaffService> builder)
    {
        builder.ToTable("Hr_StaffServices");
        builder.HasKey(x => new { x.StaffMemberId, x.ServiceId });
        builder.HasIndex(x => x.ServiceId);
        builder.HasOne<Service>().WithMany().HasForeignKey(x => x.ServiceId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class WeeklyShiftConfiguration : IEntityTypeConfiguration<WeeklyShift>
{
    public void Configure(EntityTypeBuilder<WeeklyShift> builder)
    {
        builder.ToTable("Hr_WeeklyShifts");
        builder.HasKey(x => new { x.StaffMemberId, x.DayOfWeek });
    }
}

public sealed class DayOffConfiguration : IEntityTypeConfiguration<DayOff>
{
    public void Configure(EntityTypeBuilder<DayOff> builder)
    {
        builder.ToTable("Hr_DaysOff");
        builder.Property(x => x.Reason).HasMaxLength(DayOff.ReasonMaxLength).IsRequired();
        builder.HasIndex(x => new { x.StaffMemberId, x.Date }).IsUnique();
        builder.HasIndex(x => x.Date);
        builder.HasOne<StaffMember>().WithMany().HasForeignKey(x => x.StaffMemberId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class CommissionConfiguration : IEntityTypeConfiguration<Commission>
{
    public void Configure(EntityTypeBuilder<Commission> builder)
    {
        builder.ToTable("Hr_Commissions");
        builder.Property(x => x.InvoiceCode).HasMaxLength(Commission.CodeMaxLength).IsRequired();
        builder.Property(x => x.CustomerName).HasMaxLength(Commission.NameMaxLength).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(Commission.DescriptionMaxLength).IsRequired();
        builder.Property(x => x.BaseAmount).HasPrecision(18, 2);
        builder.Property(x => x.RateValue).HasPrecision(18, 2);
        builder.Property(x => x.Amount).HasPrecision(18, 2);
        builder.HasIndex(x => new { x.Month, x.StaffMemberId });
        builder.HasIndex(x => x.InvoiceId);
        builder.HasOne<StaffMember>().WithMany().HasForeignKey(x => x.StaffMemberId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class CommissionPeriodConfiguration : IEntityTypeConfiguration<CommissionPeriod>
{
    public void Configure(EntityTypeBuilder<CommissionPeriod> builder)
    {
        builder.ToTable("Hr_CommissionPeriods");
        builder.Property(x => x.Code).HasMaxLength(CommissionPeriod.CodeMaxLength).IsRequired();
        builder.Property(x => x.ClosedByName).HasMaxLength(CommissionPeriod.NameMaxLength);
        builder.Property(x => x.PaidByName).HasMaxLength(CommissionPeriod.NameMaxLength);
        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasIndex(x => x.Month).IsUnique();
    }
}
