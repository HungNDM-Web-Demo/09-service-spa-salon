/**
 * Nhãn, gợi ý và quy tắc kiểm tra cho khóa cài đặt riêng của dự án (project.json → settings;
 * docs/06-THIET-KE-CSDL.md §3). Nhóm "Thông tin tiệm" (Store.*) in ở đầu hóa đơn 80 mm, trang đặt lịch
 * và mã QR chuyển khoản. Mock gọi `validateProjectSettings` khi lưu, BE `UpdateSettingsRequestValidator`
 * kiểm cùng quy tắc.
 */
export const settingExtraLabels: Record<string, { label: string; hint?: string }> = {
  'Store.Name': { label: 'Tên tiệm', hint: 'In đầu hóa đơn và trang đặt lịch online' },
  'Store.Address': { label: 'Địa chỉ', hint: 'In dưới tên tiệm' },
  'Store.Hotline': {
    label: 'Hotline',
    hint: 'Hiện trên trang tra cứu khi khách không tự hủy được lịch',
  },
  'Store.BankBin': {
    label: 'Mã ngân hàng (BIN)',
    hint: '6 chữ số theo VietQR, vd 970436 là Vietcombank',
  },
  'Store.BankAccount': {
    label: 'Số tài khoản nhận',
    hint: 'Dùng tạo mã QR chuyển khoản lúc thanh toán (bản demo để số giả)',
  },
  'Store.BankAccountName': { label: 'Tên chủ tài khoản', hint: 'Chữ in hoa không dấu' },
}

/** Kiểm tra giá trị cài đặt riêng của dự án; trả về { [chỉ số trong items]: thông báo lỗi }. */
export function validateProjectSettings(
  items: { key: string; value?: string | null }[],
  current: Record<string, string>
): Record<number, string> {
  void current
  const errors: Record<number, string> = {}
  items.forEach(({ key, value }, i) => {
    const v = (value ?? '').trim()
    switch (key) {
      case 'Store.Name':
        if (!v) errors[i] = 'Nhập tên tiệm'
        break
      case 'Store.BankBin':
        if (v && !/^\d{6}$/.test(v)) errors[i] = 'Mã ngân hàng gồm 6 chữ số'
        break
      case 'Store.BankAccount':
        if (v && !/^\d{6,19}$/.test(v)) errors[i] = 'Số tài khoản gồm 6 đến 19 chữ số'
        break
    }
  })
  return errors
}
