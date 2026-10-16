using Application.Interfaces.Services.Booking;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.BackgroundJobs;

/// <summary>
/// Chạy <see cref="IBookingMaintenanceService"/> lúc khởi động rồi mỗi 5 phút (06 §3): "Không đến" cho lịch ngày đã qua (BR-12,
/// tương đương mốc 23:59 kể cả khi máy chủ tắt lúc đó), gói hết hạn (BR-20), tin nhắc trước 2 giờ (FR-17).
/// </summary>
public sealed class BookingMaintenanceJob(
    IServiceScopeFactory scopeFactory,
    TimeProvider timeProvider,
    ILogger<BookingMaintenanceJob> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(5);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            // Đợi DB khởi tạo xong (Program gọi InitializeDatabaseAsync trước khi chạy host, chờ thêm cho chắc).
            await Task.Delay(TimeSpan.FromSeconds(5), timeProvider, stoppingToken);
            while (!stoppingToken.IsCancellationRequested)
            {
                await RunOnceAsync(stoppingToken);
                await Task.Delay(Interval, timeProvider, stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Ứng dụng đang dừng.
        }
    }

    private async Task RunOnceAsync(CancellationToken ct)
    {
        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var changes = await scope.ServiceProvider.GetRequiredService<IBookingMaintenanceService>().RunAsync(ct);
            if (changes > 0)
                logger.LogInformation("Việc nền lịch hẹn: cập nhật {Count} bản ghi.", changes);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Việc nền lịch hẹn thất bại, thử lại sau.");
        }
    }
}
