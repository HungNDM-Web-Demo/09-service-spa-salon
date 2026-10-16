using Domain.Entities.Booking.Appointments;
using Domain.Entities.Booking.BusinessHours;
using Domain.Entities.Booking.CustomerPackages;
using Domain.Entities.Booking.Invoices;
using Domain.Entities.Booking.PackageTemplates;
using Domain.Entities.Booking.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations.Booking;

public sealed class ServiceGroupConfiguration : IEntityTypeConfiguration<ServiceGroup>
{
    public void Configure(EntityTypeBuilder<ServiceGroup> builder)
    {
        builder.ToTable("Booking_ServiceGroups");
        builder.Property(x => x.Name).HasMaxLength(ServiceGroup.NameMaxLength).IsRequired();
        builder.HasIndex(x => x.Name).IsUnique();
    }
}

public sealed class ServiceConfiguration : IEntityTypeConfiguration<Service>
{
    public void Configure(EntityTypeBuilder<Service> builder)
    {
        builder.ToTable("Booking_Services");
        builder.Property(x => x.Code).HasMaxLength(Service.CodeMaxLength).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(Service.NameMaxLength).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(Service.DescriptionMaxLength);
        builder.Property(x => x.ImageUrl).HasMaxLength(Service.ImageUrlMaxLength);
        builder.Property(x => x.Price).HasPrecision(18, 2);
        builder.Property(x => x.CommissionValue).HasPrecision(18, 2);
        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasOne(x => x.Group).WithMany().HasForeignKey(x => x.GroupId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class PackageTemplateConfiguration : IEntityTypeConfiguration<PackageTemplate>
{
    public void Configure(EntityTypeBuilder<PackageTemplate> builder)
    {
        builder.ToTable("Booking_PackageTemplates");
        builder.Property(x => x.Code).HasMaxLength(PackageTemplate.CodeMaxLength).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(PackageTemplate.NameMaxLength).IsRequired();
        builder.Property(x => x.Price).HasPrecision(18, 2);
        builder.Property(x => x.CommissionRate).HasPrecision(5, 2);
        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasOne(x => x.Service).WithMany().HasForeignKey(x => x.ServiceId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class BusinessHoursConfiguration : IEntityTypeConfiguration<BusinessHours>
{
    public void Configure(EntityTypeBuilder<BusinessHours> builder) => builder.ToTable("Booking_BusinessHours");
}

public sealed class AppointmentConfiguration : IEntityTypeConfiguration<Appointment>
{
    public void Configure(EntityTypeBuilder<Appointment> builder)
    {
        builder.ToTable("Booking_Appointments");
        builder.Property(x => x.Code).HasMaxLength(Appointment.CodeMaxLength).IsRequired();
        builder.Property(x => x.Note).HasMaxLength(Appointment.NoteMaxLength);
        builder.Property(x => x.CreatedByName).HasMaxLength(Appointment.NameMaxLength);
        builder.Property(x => x.ConfirmedByName).HasMaxLength(Appointment.NameMaxLength);
        builder.Property(x => x.CheckedInByName).HasMaxLength(Appointment.NameMaxLength);
        builder.Property(x => x.CancelledByName).HasMaxLength(Appointment.NameMaxLength);
        builder.Property(x => x.NoShowByName).HasMaxLength(Appointment.NameMaxLength);
        builder.Property(x => x.CancelNote).HasMaxLength(Appointment.CancelNoteMaxLength);
        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasIndex(x => x.Date);
        builder.HasIndex(x => new { x.CustomerId, x.StartAt });
        builder.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(x => x.Lines).WithOne(x => x.Appointment).HasForeignKey(x => x.AppointmentId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(x => x.Messages).WithOne().HasForeignKey(x => x.AppointmentId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class AppointmentLineConfiguration : IEntityTypeConfiguration<AppointmentLine>
{
    public void Configure(EntityTypeBuilder<AppointmentLine> builder)
    {
        builder.ToTable("Booking_AppointmentLines");
        // Dòng thêm vào lịch đang theo dõi (dịch vụ phát sinh, sửa lịch) mang sẵn Id: khai báo không sinh khóa để EF coi là thêm mới.
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.ServiceName).HasMaxLength(AppointmentLine.ServiceNameMaxLength).IsRequired();
        builder.Property(x => x.Price).HasPrecision(18, 2);
        builder.HasIndex(x => new { x.StaffMemberId, x.StartAt });
        builder.HasOne<Service>().WithMany().HasForeignKey(x => x.ServiceId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.StaffMember).WithMany().HasForeignKey(x => x.StaffMemberId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class AppointmentMessageConfiguration : IEntityTypeConfiguration<AppointmentMessage>
{
    public void Configure(EntityTypeBuilder<AppointmentMessage> builder)
    {
        builder.ToTable("Booking_AppointmentMessages");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Content).HasMaxLength(AppointmentMessage.ContentMaxLength).IsRequired();
    }
}

public sealed class InvoiceConfiguration : IEntityTypeConfiguration<Invoice>
{
    public void Configure(EntityTypeBuilder<Invoice> builder)
    {
        builder.ToTable("Booking_Invoices");
        builder.Property(x => x.Code).HasMaxLength(Invoice.CodeMaxLength).IsRequired();
        builder.Property(x => x.CashierName).HasMaxLength(Invoice.NameMaxLength).IsRequired();
        builder.Property(x => x.ServiceTotal).HasPrecision(18, 2);
        builder.Property(x => x.PackageTotal).HasPrecision(18, 2);
        builder.Property(x => x.DiscountValue).HasPrecision(18, 2);
        builder.Property(x => x.DiscountAmount).HasPrecision(18, 2);
        builder.Property(x => x.DiscountReason).HasMaxLength(Invoice.DiscountReasonMaxLength);
        builder.Property(x => x.Total).HasPrecision(18, 2);
        builder.Property(x => x.CashReceived).HasPrecision(18, 2);
        builder.Property(x => x.ChangeAmount).HasPrecision(18, 2);
        builder.Property(x => x.CardAuthCode).HasMaxLength(6);
        builder.Property(x => x.IntervalOverrideReason).HasMaxLength(Invoice.ReasonMaxLength);
        builder.Property(x => x.CancelReason).HasMaxLength(Invoice.ReasonMaxLength);
        builder.Property(x => x.CancelledByName).HasMaxLength(Invoice.NameMaxLength);
        builder.Property(x => x.ClientRequestId).HasMaxLength(Invoice.ClientRequestIdMaxLength);
        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasIndex(x => x.ClientRequestId).IsUnique();
        builder.HasIndex(x => x.PaidAt);
        builder.HasIndex(x => x.AppointmentId);
        builder.HasOne<Appointment>().WithMany().HasForeignKey(x => x.AppointmentId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(x => x.Lines).WithOne(x => x.Invoice).HasForeignKey(x => x.InvoiceId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class InvoiceLineConfiguration : IEntityTypeConfiguration<InvoiceLine>
{
    public void Configure(EntityTypeBuilder<InvoiceLine> builder)
    {
        builder.ToTable("Booking_InvoiceLines");
        builder.Property(x => x.Description).HasMaxLength(InvoiceLine.DescriptionMaxLength).IsRequired();
        builder.Property(x => x.StaffName).HasMaxLength(InvoiceLine.NameMaxLength).IsRequired();
        builder.Property(x => x.ListPrice).HasPrecision(18, 2);
        builder.Property(x => x.Amount).HasPrecision(18, 2);
        builder.Property(x => x.BasePrice).HasPrecision(18, 2);
        builder.Property(x => x.PackageCode).HasMaxLength(InvoiceLine.PackageCodeMaxLength);
        builder.HasIndex(x => x.AppointmentLineId);
        builder.HasIndex(x => x.CustomerPackageId);
    }
}

public sealed class CustomerPackageConfiguration : IEntityTypeConfiguration<CustomerPackage>
{
    public void Configure(EntityTypeBuilder<CustomerPackage> builder)
    {
        builder.ToTable("Booking_CustomerPackages");
        builder.Property(x => x.Code).HasMaxLength(CustomerPackage.CodeMaxLength).IsRequired();
        builder.Property(x => x.PackageName).HasMaxLength(CustomerPackage.NameMaxLength).IsRequired();
        builder.Property(x => x.ServiceName).HasMaxLength(CustomerPackage.NameMaxLength).IsRequired();
        builder.Property(x => x.Price).HasPrecision(18, 2);
        builder.Property(x => x.SessionValue).HasPrecision(18, 2);
        builder.Property(x => x.CommissionRate).HasPrecision(5, 2);
        builder.Property(x => x.ExtendReason).HasMaxLength(CustomerPackage.ReasonMaxLength);
        builder.Property(x => x.ExtendedByName).HasMaxLength(CustomerPackage.PersonMaxLength);
        builder.Property(x => x.ConsultantName).HasMaxLength(CustomerPackage.PersonMaxLength).IsRequired();
        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasIndex(x => new { x.CustomerId, x.ServiceId });
        builder.HasIndex(x => x.InvoiceId);
        builder.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<PackageTemplate>().WithMany().HasForeignKey(x => x.PackageTemplateId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(x => x.Usages).WithOne(x => x.CustomerPackage).HasForeignKey(x => x.CustomerPackageId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class PackageUsageConfiguration : IEntityTypeConfiguration<PackageUsage>
{
    public void Configure(EntityTypeBuilder<PackageUsage> builder)
    {
        builder.ToTable("Booking_PackageUsages");
        builder.Property(x => x.AppointmentCode).HasMaxLength(PackageUsage.CodeMaxLength);
        builder.Property(x => x.StaffName).HasMaxLength(PackageUsage.NameMaxLength).IsRequired();
        builder.Property(x => x.OverrideReason).HasMaxLength(PackageUsage.ReasonMaxLength);
        builder.HasIndex(x => x.InvoiceId);
    }
}
