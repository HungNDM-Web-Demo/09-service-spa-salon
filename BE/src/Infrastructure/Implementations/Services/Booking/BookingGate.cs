namespace Infrastructure.Implementations.Services.Booking;

/// <summary>
/// Một cổng ghi cho lịch hẹn, hóa đơn, gói (06 §3, NFR-04): các thao tác kiểm tra chỗ trống rồi lưu chạy tuần tự trong
/// tiến trình, nên hai người đặt cùng một mốc chỉ một người lưu được. Demo chạy một tiến trình BE.
/// </summary>
internal static class BookingGate
{
    private static readonly SemaphoreSlim Gate = new(1, 1);

    public static async Task<T> RunAsync<T>(Func<Task<T>> action, CancellationToken ct)
    {
        await Gate.WaitAsync(ct);
        try
        {
            return await action();
        }
        finally
        {
            Gate.Release();
        }
    }
}
