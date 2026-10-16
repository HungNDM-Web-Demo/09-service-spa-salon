using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Booking;
using Domain.Entities.Booking;
using Domain.Entities.Booking.Appointments;
using Domain.Entities.Booking.CustomerPackages;
using Domain.Entities.Crm.Customers;
using Domain.Enums.Booking;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Booking;

/// <summary>
/// Việc nền (06 §3): lịch chưa check-in của ngày đã qua chuyển "Không đến" (BR-12), gói quá hạn còn buổi chuyển "Hết hạn"
/// (BR-20), tin nhắc trước 2 giờ (FR-17). Chạy lúc khởi động rồi định kỳ; thao tác lặp lại nhiều lần vẫn đúng.
/// </summary>
public sealed class BookingMaintenanceService(
    IGenericRepository<Appointment> appointments,
    IGenericRepository<CustomerPackage> packages,
    IGenericRepository<Customer> customers,
    IBookingContext context,
    IUnitOfWork unitOfWork) : IBookingMaintenanceService
{
    public async Task<int> RunAsync(CancellationToken ct = default)
    {
        var today = context.Today;
        var now = context.UtcNow;
        var changes = 0;

        var stale = await appointments.Query()
            .Where(a => a.Date < today && (a.Status == AppointmentStatus.ChoXacNhan || a.Status == AppointmentStatus.DaXacNhan))
            .ToListAsync(ct);
        foreach (var a in stale)
        {
            a.Status = AppointmentStatus.KhongDen;
            a.NoShowAt = context.ToUtc(a.Date, 23 * 60 + 59);
            a.NoShowByName = BookingRules.SystemActorName;
            changes++;
        }

        var expired = await packages.Query()
            .Where(p => p.Status == CustomerPackageStatus.DangDung && p.ExpiryDate < today && p.TotalSessions > p.UsedSessions)
            .ToListAsync(ct);
        foreach (var p in expired)
        {
            p.Status = CustomerPackageStatus.HetHan;
            changes++;
        }

        var soon = now.AddMinutes(BookingRules.ReminderLeadMinutes);
        var remind = await appointments.Query().Include(a => a.Lines).Include(a => a.Messages)
            .Where(a => a.Status == AppointmentStatus.DaXacNhan && a.ReminderSentAt == null && a.StartAt > now && a.StartAt <= soon)
            .ToListAsync(ct);
        if (remind.Count > 0)
        {
            var store = await context.GetStoreAsync(ct);
            var ids = remind.Select(a => a.CustomerId).ToList();
            var people = await customers.QueryNoTracking().Where(c => ids.Contains(c.Id)).ToDictionaryAsync(c => c.Id, ct);
            foreach (var a in remind)
            {
                var customer = people[a.CustomerId];
                var (date, minute) = context.ToLocal(a.StartAt);
                a.Messages.Add(new AppointmentMessage
                {
                    AppointmentId = a.Id,
                    Kind = MessageKind.Nhac,
                    Content = BookingMessages.Build(MessageKind.Nhac, store.Name, a.Code, date, minute,
                        string.Join(", ", a.Lines.OrderBy(l => l.SortOrder).Select(l => l.ServiceName)), customer.FullName, customer.Gender),
                    SentAt = now
                });
                a.ReminderSentAt = now;
                changes++;
            }
        }

        if (changes > 0)
            await unitOfWork.SaveChangesAsync(ct);
        return changes;
    }
}
