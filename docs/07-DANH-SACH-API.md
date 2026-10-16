# Danh sách API — Quản lý Spa Salon

> Base URL dev: `https://localhost:7109` · Swagger: `https://localhost:7109/swagger`
> Quy ước chung (đường dẫn, phân trang, lỗi) và API nền (auth, users, roles, settings, audit-logs, demo): xem `ZDOCS/03-KIEN-TRUC/QUY-UOC-API.md`.
> File này chỉ liệt kê **API nghiệp vụ riêng của dự án**. Bảng, cột: `06-THIET-KE-CSDL.md`. Mã FR, BR: `02-SRS.md`.

---

## 1. Mã quyền nghiệp vụ

Khai báo ở BE `Application/Constants/ProjectPermissions.cs`, `FE/src/mock/seed/project.json` (`permissions`, `roleGrants`) và FE `src/config/permissions.ts`. Vai trò `TECHNICIAN` (Kỹ thuật viên) là vai trò riêng của dự án; `MANAGER` hiển thị "Chủ tiệm", `STAFF` hiển thị "Lễ tân". Quản trị viên có mọi quyền.

| Nhóm | Mã quyền | MANAGER | STAFF | TECHNICIAN |
| :--- | :--- | :---: | :---: | :---: |
| Dịch vụ | `services.view` | ✓ | ✓ | ✓ |
| | `services.create`, `services.update`, `services.delete` | ✓ | | |
| Nhân viên | `staff-members.view` | ✓ | ✓ | |
| | `staff-members.create`, `staff-members.update`, `staff-members.delete` | ✓ | | |
| Lịch hẹn | `appointments.view` | ✓ | ✓ | |
| | `appointments.view-own` | | | ✓ |
| | `appointments.create`, `appointments.update`, `appointments.cancel` | ✓ | ✓ | |
| Hóa đơn | `invoices.create`, `invoices.discount` | ✓ | ✓ | |
| | `invoices.discount-high`, `invoices.cancel` | ✓ | | |
| Gói mẫu | `packages.view` | ✓ | ✓ | |
| | `packages.create`, `packages.update`, `packages.delete` | ✓ | | |
| Gói của khách | `customer-packages.view`, `customer-packages.sell` | ✓ | ✓ | |
| | `customer-packages.extend` | ✓ | | |
| Hoa hồng | `commissions.view`, `commissions.close` | ✓ | | |
| | `commissions.view-own` | | | ✓ |
| Khách hàng | `customers.view`, `customers.create`, `customers.update` | ✓ | ✓ | |
| Báo cáo | `reports.view` | ✓ | | |

`dashboard.view` (nền) có ở `MANAGER`, `STAFF`, không có ở `TECHNICIAN`: đăng nhập xong KTV vào thẳng `/my-schedule` (trang chủ theo quyền của nền).

---

## 2. Enum và mã lỗi

### 2.1. Enum (API trả chuỗi)

| Enum | Giá trị (thứ tự lưu 0, 1, 2…) | Nhãn FE |
| :--- | :--- | :--- |
| `CommissionType` | `PhanTram`, `CoDinh` | Phần trăm giá, Số tiền mỗi lượt |
| `StaffKind` | `KyThuatVien`, `LeTan` | Kỹ thuật viên, Lễ tân |
| `ShiftType` | `Sang`, `Chieu`, `CaNgay`, `Nghi` | Ca sáng, Ca chiều, Cả ngày, Nghỉ |
| `AppointmentStatus` | `ChoXacNhan`, `DaXacNhan`, `DangPhucVu`, `HoanThanh`, `DaHuy`, `KhongDen` | Chờ xác nhận, Đã xác nhận, Đang phục vụ, Hoàn thành, Đã hủy, Không đến |
| `AppointmentSource` | `Online`, `DienThoai`, `VangLai`, `ZaloFacebook` | Online, Điện thoại, Vãng lai, Zalo/Facebook |
| `CancelReason` | `KhachBaoHuy`, `TiemDoiLich`, `HetCho`, `KhongLienLacDuoc`, `KhachTuHuy`, `Khac` | Khách báo hủy, Tiệm đổi lịch, Hết chỗ, Không liên lạc được, Khách tự hủy online, Khác |
| `Gender` | `Nu`, `Nam`, `Khac` | Nữ, Nam, Khác |
| `InvoiceStatus` | `DaThanhToan`, `DaHuy` | Đã thanh toán, Đã hủy |
| `PaymentMethod` | `TienMat`, `ChuyenKhoan`, `The`, `KhongThu` | Tiền mặt, Chuyển khoản, Thẻ, Không thu tiền |
| `DiscountType` | `PhanTram`, `SoTien` | %, ₫ |
| `InvoiceLineKind` | `DichVu`, `BanGoi` | Dịch vụ, Bán gói |
| `CustomerPackageStatus` | `DangDung`, `DaDungHet`, `HetHan`, `DaHuy` | Đang dùng, Đã dùng hết, Hết hạn, Đã hủy |
| `CommissionKind` | `DichVu`, `BanGoi` | Dịch vụ, Bán gói |
| `CommissionPeriodStatus` | `TamTinh`, `DaChot`, `DaChiTra` | Tạm tính, Đã chốt, Đã chi trả |
| `MessageKind` | `XacNhan`, `DoiLich`, `Huy`, `Nhac` | Tin xác nhận, Tin đổi lịch, Tin hủy, Tin nhắc |
| `MessageChannel` | `Zalo`, `Sms` | Zalo, SMS |

Hủy tại quầy chọn `KhachBaoHuy`, `TiemDoiLich`, `Khac`; từ chối lịch online chọn `HetCho`, `KhongLienLacDuoc`, `Khac`; `Khac` bắt buộc ghi chú.

### 2.2. Mã lỗi nghiệp vụ

Lỗi theo ProblemDetails của nền; lỗi nghiệp vụ có thêm trường `code` (FE dựa vào `code`, không dựa vào câu chữ).

| HTTP | `code` | Khi nào | Trường thêm |
| :---: | :--- | :--- | :--- |
| 400 | `LichKhongHopLe` | Tạo, sửa, kéo thả lịch hẹn vi phạm BR-01 đến BR-05, BR-09; `detail` là lỗi đầu tiên | `lines: LineCheck[]`, `issues: Issue[]` |
| 409 | `GioDaCoNguoiDat` | Đặt online: mốc vừa có người giữ (NFR-04) | |
| 409 | `TrungLichKhach` | Đặt online: khách đã có lịch chồng giờ | |
| 400 | `QuaSoLichCho` | Số điện thoại đã có 2 lịch online chưa diễn ra (BR-06) | |
| 429 | `TamKhoaTraCuu` | Tra cứu sai 5 lần trong 15 phút (NFR-05) | `retryAfterSeconds` |
| 409 | `LichBiAnhHuong` | Đổi ca, thêm ngày nghỉ, bỏ dịch vụ làm được, chuyển nghỉ việc, đổi giờ mở cửa mà còn lịch chiếm chỗ (BR-27) | `affected: AffectedAppointment[]` |
| 409 | `DaPhatSinh` | Xóa dịch vụ, gói mẫu, nhân viên, nhóm đã có dữ liệu (BR-27) | |
| 409 | `TrangThaiKhongHopLe` | Thao tác không đúng trạng thái (check-in lịch không phải hôm nay, thanh toán lịch chưa check-in…) | |
| 409 | `TongTienDaDoi` | `expectedTotal` khác tổng máy chủ tính | `serverTotal` |
| 409 | `ThangDaChot` | Hủy hóa đơn của tháng đã chốt hoa hồng (BR-25) | |
| 409 | `GoiDaDung` | Hủy hóa đơn bán gói khi gói đã trừ buổi ở hóa đơn khác (BR-26) | |
| 409 | `ChuaHetThang` | Chốt bảng hoa hồng khi tháng chưa kết thúc | |

Lỗi gắn ô nhập trả 400 có `errors` (tên trường camelCase) như nền: giảm giá vượt hạn mức (`discount.value`), thiếu lý do trừ buổi sớm (`intervalOverrideReason`), tiền khách đưa thiếu (`cashReceived`), mã chuẩn chi (`cardAuthCode`), chưa chọn khách (`customerId`), người tư vấn (`consultantStaffId`), trùng mã (409 kèm `errors` của nền).

---

## 3. Quy tắc tính

BE: `Domain/Entities/Booking/BookingRules.cs`, `SlotRules.cs`, `CheckoutMath.cs`; FE: `features/booking/lib/`. Hai bên cùng thuật toán, cùng câu báo. Giờ trong ngày tính bằng phút từ 00:00 giờ Việt Nam.

### 3.1. Khung giờ

- `floor15(x)`: làm tròn xuống mốc 15 phút. "Mốc hiện tại" = `floor15(now)`.
- Ca (BR-04): `Sang` = [mở cửa, 900), `Chieu` = [900, đóng cửa), `CaNgay` = [mở cửa, đóng cửa); `Nghi` = không có ca. Nhãn: "ca sáng 09:00–15:00", "ca chiều 15:00–21:00", "cả ngày 09:00–21:00".
- Dòng `L` (dịch vụ `S`, KTV `K`, bắt đầu `t` ngày `D`): `end = t + S.Duration`, khoảng chiếm chỗ `[t, end + S.Cleanup)`. Hai khoảng `[a1, b1)`, `[a2, b2)` giao khi `a1 < b2 && a2 < b1`.
- Dòng chiếm chỗ: dòng của lịch `ChoXacNhan`, `DaXacNhan`, `DangPhucVu`, `HoanThanh`.

### 3.2. Kiểm tra một dòng (FR-10)

Trả **mọi** lỗi theo thứ tự dưới (`Issue { code, message }`). Dòng đang có, không đổi KTV, giờ, dịch vụ thì bỏ qua bước 1–2 (lịch đang phục vụ có dòng đã qua giờ).

| # | `code` | Điều kiện | Câu báo |
| :-: | :--- | :--- | :--- |
| 1 | `GioQuaKhu` | `D < today`, hoặc `D = today` và `t < floor15(now)` | "Giờ bắt đầu đã qua" |
| 2 | `BuocGio` | `t` không chia hết cho 15 | "Giờ bắt đầu theo bước 15 phút" |
| 3 | `TiemNghi` | `D` là ngày tiệm nghỉ | "Tiệm nghỉ ngày 01/01/2027 (Tết Dương lịch)" |
| 4 | `NgoaiGioMoCua` | `t < mở cửa` | "Trước giờ mở cửa (09:00)" |
| | | `end > đóng cửa` | "Kết thúc 21:15, quá giờ đóng cửa (21:00)" |
| 5 | `NghiViec` | KTV nghỉ việc | "Nguyễn Thị Mai đã nghỉ việc" |
| 6 | `KhongLamDuoc` | Dịch vụ không có trong danh sách làm được | "Lê Hoàng Yến không làm được Chăm sóc da cơ bản" |
| 7 | `KtvNghi` | Ngày nghỉ đột xuất | "Nguyễn Thị Mai nghỉ ngày 20/10/2026 (Việc gia đình)" |
| | | Ca tuần ngày đó là `Nghi` | "Lê Hoàng Yến nghỉ Thứ Tư" |
| 8 | `NgoaiCa` | `t < đầu ca`, hoặc `end > cuối ca` mà chưa báo ở bước 4 | "Ngoài ca làm (ca chiều 15:00–21:00)" |
| 9 | `TrungLichKtv` | Giao khoảng chiếm chỗ với dòng chiếm chỗ khác của `K` (kể cả dòng khác trong bản nháp), lấy dòng xung đột bắt đầu sớm nhất `X` | `t ≥ X.start`: "Nguyễn Thị Mai bận tới 15:10 (gồm thời gian dọn)" (bỏ phần trong ngoặc khi `X.Cleanup = 0`); `t < X.start`: "Nguyễn Thị Mai có lịch lúc 14:00" + (", cần thêm 10 phút dọn sau dịch vụ" khi `end ≤ X.start`) |

Cả lịch hẹn: 1–5 dòng; mọi dòng cùng ngày ("Các dòng dịch vụ phải cùng một ngày"); BR-05: khoảng `[start sớm nhất, end muộn nhất)` của lịch giao với lịch chiếm chỗ khác của cùng khách → `TrungLichKhach` "Khách đã có lịch LH261020003 14:00–15:00". Trong một lịch, hai dòng của hai KTV khác nhau được chạy song song.

**Giờ mặc định của dòng kế tiếp** (UC-03 bước 5, UC-07 bước 4): giờ kết thúc của dòng trước; cùng KTV với dòng trước thì `ceil15(giờ kết thúc + thời gian dọn của dòng trước)` (làm tròn lên mốc 15 phút).

**Sửa lịch** (BR-09): `ChoXacNhan`, `DaXacNhan` sửa mọi dòng; `DangPhucVu` chỉ đổi KTV, giờ, xóa dòng có `StartAt > now`, được thêm dòng mới (giá hiện hành, BR-14); lịch còn ít nhất 1 dòng. `HoanThanh`, `DaHuy`, `KhongDen` không sửa được.

### 3.3. Mốc trống đặt online (FR-19, BR-06, BR-07)

Đầu vào: dịch vụ `S1..Sn` (1–3, theo thứ tự khách chọn), KTV `K` hoặc "Bất kỳ ai", ngày `D`.

1. `D` trong `[today, today + 30]`, không phải ngày tiệm nghỉ; dịch vụ đều đang hiện trên trang online.
2. Mốc `t` từ giờ mở cửa, bước 30 phút, `t + ΣDuration ≤ đóng cửa`, `t ≥ now + 120` phút.
3. Dòng nối tiếp: `start₁ = t`; `startᵢ₊₁ = endᵢ`, hoặc `ceil15(endᵢ + Cleanupᵢ)` khi cùng KTV với dòng trước.
4. Chọn `K`: mọi dòng giao cho `K` (K phải làm được tất cả); mốc hợp lệ khi mọi dòng qua §3.2 bước 3–9.
5. "Bất kỳ ai" (BR-07): ứng viên = KTV đang làm, làm được **tất cả** dịch vụ; trong các ứng viên giao trọn được mọi dòng mà hợp lệ, chọn người có **tổng thời lượng đã xếp trong ngày `D` ít nhất** (Σ `DurationMinutes` các dòng chiếm chỗ, không tính thời gian dọn), bằng nhau theo mã nhân viên tăng dần. Không ai giao trọn được thì gán từng dòng theo thứ tự: ứng viên làm được dịch vụ đó, hợp lệ tại `startᵢ` của chính họ, ít phút đã xếp nhất (cộng phút đã giao ở các dòng trước của lượt đặt), bằng nhau theo mã.
6. Danh sách trống: trả `nextAvailableDate` = ngày gần nhất sau `D` (tới `today + 30`) còn ít nhất một mốc; ngày tiệm nghỉ trả thêm `closedReason`.

Đặt lịch (POST): trong `BookingGate` tính lại đúng mốc `t` (cùng thuật toán, cùng cách chọn KTV); không còn hợp lệ → 409 `GioDaCoNguoiDat`. Kiểm số lịch chờ theo số điện thoại (BR-06), ghép khách (BR-28: số đã có thì giữ tên trong hồ sơ, tên khác ghi thêm "Tên khách nhập: …" vào ghi chú lịch), kiểm BR-05 (409 `TrungLichKhach`), lưu lịch `ChoXacNhan`, `Source = Online`, `CreatedByName = "Khách đặt online"`.

### 3.4. Gợi ý (FR-11)

Cho một dòng (dịch vụ, KTV đang chọn, giờ, ngày, các dòng khác của bản nháp): `freeTechnicians` = KTV khác làm được dịch vụ, dòng qua §3.2 tại đúng giờ đó, xếp theo mã; `nextSlots` = 3 giờ bắt đầu hợp lệ của KTV đang chọn trong ngày, bước 15 phút, từ `max(mở cửa, floor15(now))`, gần giờ đã chọn nhất (bằng nhau lấy giờ sớm hơn), trả theo thứ tự giờ.

### 3.5. Gói hợp lệ, khoảng cách (BR-18, BR-19, BR-20, BR-21, BR-22)

- `SessionValue = floor1000(Price / Sessions)`.
- `ExpiryDate = PurchaseDate + ValidityMonths tháng`; tháng đích không có ngày đó thì lấy ngày cuối tháng (31/08/2026 + 6 tháng = 28/02/2027). Gia hạn: `ExpiryDate += ExtendedDays`.
- Gói hợp lệ cho dòng dịch vụ `S` ngày thanh toán `P`: cùng `ServiceId`, `DangDung`, còn ≥ 1 buổi (sau khi trừ các dòng trước trong cùng hóa đơn), `P ≤ ExpiryDate`. Gói bán kèm trong cùng hóa đơn là ứng viên (hạn `P + ValidityMonths`). Nhiều gói: hạn sớm nhất, rồi gói cũ trước gói bán kèm, rồi mã tăng dần. Duyệt dòng theo thứ tự.
- Khoảng cách: gói có `MinIntervalDays > 0` và có lần trừ chưa hoàn trả gần nhất ngày `U` (kể cả dòng trước trong cùng hóa đơn, khi đó `U = P`): `P − U < MinIntervalDays` → cảnh báo "Buổi gần nhất cách 3 ngày, gói yêu cầu 7 ngày". Có cảnh báo ở dòng đang trừ buổi thì bắt buộc `intervalOverrideReason`.
- Gói không dùng được nhưng khách có gói cùng dịch vụ: ghi chú "Gói GL260712001 hết hạn ngày 15/10/2026" (`HetHan` hoặc quá hạn), "Gói GL… đã dùng hết" (`DaDungHet`).

### 3.6. Hóa đơn (BR-15, BR-16, BR-17, BR-23, BR-24)

1. Mỗi dòng dịch vụ: mặc định trừ buổi khi có gói hợp lệ (§3.5); lễ tân tắt được (`usePackage: false`). Gửi `usePackage: true` mà không có gói hợp lệ → 400.
2. Dòng trừ buổi: `Amount = 0`, `BasePrice = SessionValue` của gói bị trừ. Dòng lẻ: `Amount = BasePrice = ListPrice`.
3. `ServiceTotal = Σ Amount` dòng dịch vụ; `PackageTotal = Σ giá gói bán`.
4. Hạn mức giảm: có `invoices.discount-high` → 50%, có `invoices.discount` → 10%, không có → 0. `maxDiscount = floor1000(ServiceTotal × hạn mức / 100)`. Giảm phần trăm `v` (số nguyên 1–100): `v >` hạn mức → lỗi; tiền giảm `floor1000(ServiceTotal × v / 100)`. Giảm tiền `v` (bội số 1.000): `v > maxDiscount` → lỗi. Câu lỗi: "Lễ tân giảm tối đa 10% (70.000 ₫)" (hạn mức 10%) hoặc "Chủ tiệm giảm tối đa 50% (350.000 ₫)"; không có quyền giảm: "Bạn không có quyền giảm giá". Có giảm thì bắt buộc lý do.
5. `Total = ServiceTotal + PackageTotal − DiscountAmount`.
6. `Total = 0` → `Method = KhongThu`, bỏ qua phương thức gửi lên. Tiền mặt: `CashReceived ≥ Total` (không đủ: "Tiền khách đưa chưa đủ, còn thiếu 130.000 ₫"), `ChangeAmount = CashReceived − Total`. Chuyển khoản: QR có số tiền `Total`, nội dung = mã hóa đơn (mã được giữ trước khi mở QR bằng cách hiện "mã sẽ cấp khi hoàn tất"; QR dùng nội dung = mã lịch hẹn). Thẻ: `CardAuthCode` 6 chữ số.
7. Hoa hồng dịch vụ (mỗi dòng, cho KTV làm dòng): theo **mức hiện hành của dịch vụ** lúc thanh toán; `PhanTram`: `floor1000(BasePrice × CommissionValue / 100)`; `CoDinh`: `CommissionValue`. Hoa hồng bán gói (cho người tư vấn): `floor1000(Price × CommissionRate / 100)` theo gói mẫu.
8. Lưu (trong `BookingGate`, một transaction): hóa đơn `DaThanhToan`, dòng; gói bán kèm (`DangDung`, `UsedSessions = 0`); mỗi dòng trừ buổi một `PackageUsage`, `UsedSessions + 1` (hết buổi → `DaDungHet`); hoa hồng (tháng = `PaidAt`); tạo bảng tháng `TamTinh` nếu chưa có; lịch → `HoanThanh`, `CompletedAt`.

Ví dụ kịch bản kiểm thử: TC-28 tổng 630.000 ₫, hoa hồng NV01 55.000 ₫; TC-29 hóa đơn 0 ₫, NV01 33.000 ₫ (12% × 280.000 = 33.600); TC-30 tổng 2.435.000 ₫, NV01 46.000 ₫ + 115.000 ₫, NV05 30.000 ₫.

### 3.7. Hủy hóa đơn (BR-25, BR-26)

Điều kiện: `DaThanhToan`; bảng hoa hồng tháng của `PaidAt` đang `TamTinh` (không thì 409 `ThangDaChot` "Tháng 08/2026 đã chốt hoa hồng"); gói bán trong hóa đơn chưa có lần trừ chưa hoàn trả ở hóa đơn khác (409 `GoiDaDung` "Gói GL… đã được trừ buổi ở hóa đơn khác"). Lý do bắt buộc. Kết quả: hóa đơn `DaHuy`; lần trừ của hóa đơn `Refunded = true`, `UsedSessions − 1`, gói `DaDungHet` về `DangDung` (hoặc `HetHan` nếu đã quá hạn); gói bán trong hóa đơn → `DaHuy`; xóa hoa hồng của hóa đơn; lịch → `DangPhucVu`, `CompletedAt = null`.

### 3.8. Hoa hồng tháng (BR-25)

Bảng tháng `M`: mỗi nhân viên có khoản trong tháng một dòng: số lượt dịch vụ, doanh số tính hoa hồng (Σ `BaseAmount` khoản dịch vụ), hoa hồng dịch vụ, số gói bán, hoa hồng bán gói, tổng; dòng tổng cộng. Chốt khi `today ≥ ngày 01 tháng M + 1` và đang `TamTinh` (không thì 409 `ChuaHetThang` "Chỉ chốt từ 01/11/2026"); chi trả khi `DaChot`.

### 3.9. Trạng thái và nút (FR-15, FR-16)

- `isLate` = lịch hôm nay, `ChoXacNhan`/`DaXacNhan`, `now ≥ start + 15` phút (khối hiện "Trễ"; có nút "Không đến").
- `pendingOverdue` = `ChoXacNhan` và `now − CreatedAt > 30` phút (tô cam, BR-08).
- Check-in: lịch của hôm nay, `ChoXacNhan`/`DaXacNhan` (check-in lịch chờ thì xác nhận luôn, BR-11). Thanh toán: `DangPhucVu`. Xác nhận, từ chối: `ChoXacNhan`. Hủy: `ChoXacNhan`/`DaXacNhan`.

### 3.10. Tin nhắn giả lập (FR-17)

| Loại | Khi | Nội dung |
| :--- | :--- | :--- |
| `XacNhan` | Lễ tân tạo lịch, xác nhận, check-in lịch chờ | "Lam Ngọc Spa xác nhận lịch LH261020003 lúc 14:00 ngày 20/10/2026: Chăm sóc da cơ bản. Hẹn gặp chị Lan Anh!" |
| `DoiLich` | Đổi giờ, đổi KTV, kéo thả lịch chưa diễn ra | "Lịch LH261020003 đã đổi sang 15:00 ngày 20/10/2026: Chăm sóc da cơ bản." |
| `Huy` | Hủy, từ chối, khách tự hủy | "Lịch LH261020003 lúc 14:00 ngày 20/10/2026 đã hủy. Lý do: Khách báo hủy." |
| `Nhac` | Việc nền, trước giờ hẹn 2 giờ | "Nhắc lịch: chị Lan Anh có hẹn lúc 14:00 hôm nay tại Lam Ngọc Spa: Chăm sóc da cơ bản." |

Tên tiệm lấy `Store.Name`; gọi khách bằng "anh"/"chị" theo giới tính (không rõ thì "quý khách") + tên (hai chữ cuối của họ tên).

### 3.11. Báo cáo (BR-29)

- Thực thu theo ngày của `PaidAt`, chỉ hóa đơn `DaThanhToan`: dịch vụ lẻ = `ServiceTotal − DiscountAmount`, bán gói = `PackageTotal`. Giá trị dịch vụ đã làm = Σ `BasePrice` dòng `DichVu`. So kỳ trước: khoảng liền trước cùng số ngày.
- Theo dịch vụ: số lượt (dòng `DichVu`), giá trị (Σ `BasePrice`), tỉ trọng giá trị, số lượt trừ buổi.
- Theo KTV: số lượt, giá trị, hoa hồng (Σ khoản mọi loại của KTV trong khoảng), tỉ lệ lấp lịch = Σ `DurationMinutes` dòng đã thanh toán ÷ Σ phút ca làm từng ngày trong khoảng (tới hôm nay, theo ca tuần hiện tại, trừ ngày nghỉ, ngày tiệm nghỉ) × 100, làm tròn 1 chữ số.
- Gói: số gói bán, tiền bán gói trong khoảng; giá trị buổi chưa dùng = Σ (còn lại × `SessionValue`) của gói `DangDung` (tại thời điểm xem); gói sắp hết hạn (30 ngày).
- Hủy và không đến: lịch có `Date` trong khoảng; tỉ lệ trên tổng lịch; theo nguồn.
- Khoảng ngày tối đa 366 ngày. Xuất Excel làm ở FE (`write-excel-file`).

---

## 4. API nghiệp vụ

Danh mục nhỏ (nhóm, dịch vụ, gói mẫu, nhân viên, ngày nghỉ) trả mảng; khách, lịch hẹn, hóa đơn, gói của khách trả `PaginatedResult`. Ngày `yyyy-MM-dd` theo giờ Việt Nam; thời điểm ISO 8601 UTC.

### 4.1. Nhóm dịch vụ, dịch vụ — `/api/service-groups`, `/api/services`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/service-groups` | `services.view` | `ServiceGroupDto[]` theo `SortOrder` |
| POST | `/api/service-groups` | `services.create` | `SaveServiceGroupRequest` |
| PUT | `/api/service-groups/{id}` | `services.update` | Đổi tên, ẩn/hiện |
| PUT | `/api/service-groups/order` | `services.update` | `{ ids: string[] }` theo thứ tự mới |
| DELETE | `/api/service-groups/{id}` | `services.delete` | Nhóm còn dịch vụ → 409 `DaPhatSinh` |
| GET | `/api/services` | `services.view` | `ServiceDto[]`; lọc `groupId`, `visible` |
| GET | `/api/services/options` | `appointments.view`, `appointments.create`, `customer-packages.sell`, `packages.view` | `ServiceOption[]` dịch vụ đang hiện, kèm KTV làm được |
| GET | `/api/services/next-code` | `services.create` | `{ code: "DV031" }` |
| GET | `/api/services/{id}` | `services.view` | |
| POST | `/api/services` | `services.create` | `SaveServiceRequest` → `ServiceDto` (có `onlineWarning`, UC-01 E4) |
| PUT | `/api/services/{id}` | `services.update` | |
| PATCH | `/api/services/{id}/visibility` | `services.update` | `{ isVisible }` |
| DELETE | `/api/services/{id}` | `services.delete` | Đã phát sinh → 409 `DaPhatSinh` "Dịch vụ đã có lịch hẹn, hãy dùng Ẩn" |

### 4.2. Gói mẫu — `/api/package-templates`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/package-templates` | `packages.view` | `PackageTemplateDto[]` |
| GET | `/api/package-templates/options` | `customer-packages.sell` | Gói đang bán |
| GET | `/api/package-templates/next-code` | `packages.create` | |
| POST, PUT | `/api/package-templates`, `/{id}` | `packages.create` / `packages.update` | `SavePackageTemplateRequest` |
| PATCH | `/api/package-templates/{id}/status` | `packages.update` | `{ isActive }` |
| DELETE | `/api/package-templates/{id}` | `packages.delete` | Đã bán → 409 `DaPhatSinh` |

### 4.3. Nhân viên, lịch làm việc — `/api/staff-members`, `/api/days-off`, `/api/business-hours`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/staff-members` | `staff-members.view` | `StaffMemberDto[]` (kèm ca tuần, dịch vụ làm được) |
| GET | `/api/staff-members/options` | đăng nhập | `StaffOption[]` nhân viên đang làm (chọn người tư vấn, lọc báo cáo) |
| GET | `/api/staff-members/account-candidates` | `staff-members.update` | Tài khoản để liên kết, kèm nhân viên đã liên kết |
| GET | `/api/staff-members/next-code` | `staff-members.create` | |
| POST | `/api/staff-members` | `staff-members.create` | `SaveStaffMemberRequest` |
| PUT | `/api/staff-members/{id}` | `staff-members.update` | Bỏ dịch vụ làm được mà còn lịch → 409 `LichBiAnhHuong` |
| PUT | `/api/staff-members/{id}/shifts` | `staff-members.update` | `{ shifts: ShiftType[7] }` Thứ Hai → Chủ nhật; trùng lịch → 409 `LichBiAnhHuong` |
| PATCH | `/api/staff-members/{id}/status` | `staff-members.update` | `{ isActive }`; nghỉ việc khi còn lịch tương lai → 409 `LichBiAnhHuong` |
| DELETE | `/api/staff-members/{id}` | `staff-members.delete` | Đã phát sinh → 409 `DaPhatSinh` |
| GET | `/api/days-off?from&to` | `staff-members.view` | `DayOffDto[]`, mặc định từ hôm nay − 30 tới hôm nay + 90 |
| POST | `/api/days-off` | `staff-members.update` | `{ staffMemberId?, date, reason }`; trùng lịch → 409 `LichBiAnhHuong` (TC-04) |
| DELETE | `/api/days-off/{id}` | `staff-members.update` | |
| GET | `/api/business-hours` | đăng nhập | `{ openTime: "09:00", closeTime: "21:00" }` |
| PUT | `/api/business-hours` | `staff-members.update` | Lịch tương lai rơi ra ngoài giờ mới → 409 `LichBiAnhHuong` |
| GET | `/api/store-profile` | đăng nhập | `StoreProfileDto { name, address, hotline, logoUrl, bankBin, bankAccount, bankAccountName }` từ `Store.*`: đầu bản in hóa đơn, QR chuyển khoản |

### 4.4. Lịch hẹn — `/api/appointments`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/appointments/board?date=` | `appointments.view` | `BoardDto`: cột KTV có ca, khối lịch chiếm chỗ (không gồm `DaHuy`, `KhongDen`) |
| GET | `/api/appointments` | `appointments.view` | Phân trang `AppointmentListItem`; lọc `customerId`, `from`, `to`, `status`, `search` (mã, tên, số điện thoại) |
| GET | `/api/appointments/{id}` | `appointments.view` | `AppointmentDetailDto` |
| POST | `/api/appointments/check` | `appointments.create`, `appointments.update` | Kiểm tra bản nháp (§3.2) → `CheckResult`, không lưu |
| GET | `/api/appointments/suggestions` | `appointments.create`, `appointments.update` | `serviceId`, `staffMemberId`, `startAt`, `appointmentId?`; body thay bằng query `lines` không dùng: gợi ý tính trên lịch đã lưu (§3.4) |
| POST | `/api/appointments` | `appointments.create` | `CreateAppointmentRequest` → `AppointmentDetailDto` (201); trạng thái `DaXacNhan`, tin xác nhận |
| PUT | `/api/appointments/{id}` | `appointments.update` | `UpdateAppointmentRequest`: sửa ghi chú, nguồn, dòng (BR-09, thêm dịch vụ phát sinh) |
| PATCH | `/api/appointments/{id}/lines/{lineId}` | `appointments.update` | `{ staffMemberId, startAt }`: kéo thả |
| POST | `/api/appointments/{id}/confirm` | `appointments.update` | |
| POST | `/api/appointments/{id}/reject` | `appointments.update` | `{ reason, note? }` |
| POST | `/api/appointments/{id}/cancel` | `appointments.cancel` | `{ reason, note? }` |
| POST | `/api/appointments/{id}/check-in` | `appointments.update` | |
| POST | `/api/appointments/{id}/no-show` | `appointments.update` | Chỉ khi `isLate` |
| GET | `/api/appointments/{id}/checkout` | `invoices.create` | `CheckoutPreviewDto` |

### 4.5. Đặt lịch online (công khai) — `/api/public/booking`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/public/booking/catalog` | công khai | `PublicCatalogDto`: thông tin tiệm, dịch vụ cho đặt online theo nhóm, KTV |
| GET | `/api/public/booking/slots` | công khai | `serviceIds` (phẩy), `staffMemberId?` (trống = bất kỳ), `date` → `{ date, slots: ["09:00"], nextAvailableDate?, closedReason? }` |
| POST | `/api/public/booking` | công khai | `PublicBookingRequest` → `PublicAppointmentDto` (201) |
| POST | `/api/public/booking/lookup` | công khai | `{ code, phone }` → `PublicAppointmentDto`; sai → 404; sai 5 lần trong 15 phút theo IP → 429 `TamKhoaTraCuu` |
| POST | `/api/public/booking/cancel` | công khai | `{ code, phone, reason? }`; dưới 2 giờ → 409 `TrangThaiKhongHopLe` |

### 4.6. Hóa đơn — `/api/invoices`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| POST | `/api/invoices/checkout` | `invoices.create` | `CheckoutRequest` → `InvoiceDto` (201; gửi lại cùng `clientRequestId` → 200) |
| POST | `/api/invoices/package-sale` | `customer-packages.sell` | `PackageSaleRequest` → `InvoiceDto` |
| GET | `/api/invoices` | `invoices.create`, `customers.view` | Phân trang, lọc `customerId`, `from`, `to` |
| GET | `/api/invoices/{id}` | `invoices.create`, `customers.view`, `customer-packages.view` | `InvoiceDto` (bản in dùng chung) |
| POST | `/api/invoices/{id}/cancel` | `invoices.cancel` | `{ reason }` (§3.7) |

### 4.7. Gói của khách — `/api/customer-packages`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/customer-packages` | `customer-packages.view` | Phân trang; lọc `status`, `filter` (`expiringSoon` hết hạn trong 30 ngày, `lastSession` còn 1 buổi), `customerId`, `search` |
| GET | `/api/customer-packages/{id}` | `customer-packages.view` | Kèm lịch sử trừ buổi |
| POST | `/api/customer-packages/{id}/extend` | `customer-packages.extend` | `{ days, reason }`, một lần, tối đa 60 ngày |

### 4.8. Hoa hồng, lịch của tôi — `/api/commissions`, `/api/my-schedule`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/commissions/sheet?month=yyyy-MM` | `commissions.view` | `CommissionSheetDto` |
| GET | `/api/commissions/items?month&staffMemberId` | `commissions.view` | `CommissionItemDto[]` |
| POST | `/api/commissions/{month}/close` | `commissions.close` | |
| POST | `/api/commissions/{month}/pay` | `commissions.close` | |
| GET | `/api/commissions/my?month=` | `commissions.view-own` | Hoa hồng của KTV liên kết với tài khoản |
| GET | `/api/my-schedule?date=` | `appointments.view-own` | Lịch của KTV liên kết, không có số điện thoại khách (NFR-06) |

### 4.9. Khách hàng — `/api/customers`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/customers` | `customers.view` | Phân trang; `search` (mã, tên, số điện thoại), `flagged`, `hasActivePackage` |
| GET | `/api/customers/lookup?phone=` | `customers.view`, `appointments.create`, `customer-packages.sell` | `{ customer, packages }`; chưa có → `customer: null` |
| GET | `/api/customers/{id}` | `customers.view` | |
| POST | `/api/customers` | `customers.create` | Trùng số → 409 kèm `errors.phone` |
| PUT | `/api/customers/{id}` | `customers.update` | |

### 4.10. Tổng quan, báo cáo — `/api/dashboard`, `/api/reports`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/dashboard/today` | `dashboard.view` | `DashboardTodayDto` (FR-01, FR-02) |
| GET | `/api/reports/revenue?from&to` | `reports.view` | Theo ngày, so kỳ trước |
| GET | `/api/reports/services?from&to&groupId` | `reports.view` | |
| GET | `/api/reports/technicians?from&to` | `reports.view` | |
| GET | `/api/reports/packages?from&to` | `reports.view` | |
| GET | `/api/reports/cancellations?from&to` | `reports.view` | |

---

## 5. DTO

Kiểu FE ở `features/*/types`, khớp từng trường (camelCase). Tiền là `number`.

```ts
type Issue = { code: string; message: string }

type ServiceGroupDto = { id; name; sortOrder; isVisible; serviceCount }
type ServiceDto = { id; code; name; groupId; groupName; durationMinutes; cleanupMinutes; price; description; imageUrl;
  allowOnline; commissionType; commissionValue; isVisible; technicianCount; onlineWarning: string | null; createdAt }
type ServiceOption = { id; code; name; groupId; groupName; durationMinutes; cleanupMinutes; price; technicianIds: string[] }
type SaveServiceRequest = { code; name; groupId; durationMinutes; cleanupMinutes; price; description?; imageUrl?;
  allowOnline; commissionType; commissionValue; isVisible }

type PackageTemplateDto = { id; code; name; serviceId; serviceCode; serviceName; servicePrice; sessions; price;
  validityMonths; minIntervalDays; commissionRate; isActive; retailEquivalent; savingAmount; savingPercent;
  sessionValue; soldCount }

type StaffMemberDto = { id; code; fullName; phone; kind; color; specialty; userId; username; isActive; sortOrder;
  serviceIds: string[]; shifts: ShiftType[] /* 7 phần tử, Thứ Hai → CN */ }
type SaveStaffMemberRequest = { code; fullName; phone; kind; color; specialty?; userId?; serviceIds: string[]; shifts?: ShiftType[] }
type StaffOption = { id; code; fullName; kind; color }
type AffectedAppointment = { appointmentId; code; date; startAt; endAt; customerName; serviceName; staffName; status }
type DayOffDto = { id; staffMemberId: string | null; staffName: string | null; date; reason }

type CustomerDto = { id; code; phone; fullName; birthDate; gender; note; createdAt; noShowCount90; isFlagged;
  totalSpent; visitCount; lastVisitAt; activePackageCount }
type CustomerPackageBrief = { id; code; packageName; serviceId; serviceName; totalSessions; remaining; expiryDate;
  status; sessionValue; minIntervalDays; lastUsedAt: string | null; purchasedAt }

type AppointmentLineDto = { id; serviceId; serviceName; staffMemberId; staffName; staffColor; startAt; endAt;
  durationMinutes; cleanupMinutes; price; sortOrder }
type AppointmentCardDto = { id; code; status; source; customerId; customerName; customerPhone; isFlagged; note;
  createdAt; checkedInAt; startAt; endAt; isLate; pendingOverdue; lines: AppointmentLineDto[] }
type BoardTechnician = { id; code; fullName; color; shift: ShiftType | null; shiftStart: number | null;
  shiftEnd: number | null; offReason: string | null; serviceIds: string[] }
type BoardDto = { date; openMinute; closeMinute; shopClosedReason: string | null; technicians: BoardTechnician[];
  appointments: AppointmentCardDto[] }
type AppointmentDetailDto = AppointmentCardDto & { date; customer: CustomerDto; packages: CustomerPackageBrief[];
  createdByName; confirmedAt; confirmedByName; checkedInByName; cancelReason; cancelNote; cancelledAt;
  cancelledByName; noShowAt; noShowByName; completedAt; messages: MessageDto[]; invoices: InvoiceBrief[];
  actions: { canEdit; canConfirm; canReject; canCancel; canCheckIn; canNoShow; canCheckout } }
type InvoiceBrief = { id; code; paidAt; total; method; status; canCancel; cancelBlockedReason: string | null }
type MessageDto = { id; kind; channel; content; sentAt }
type AppointmentListItem = { id; code; date; startAt; endAt; status; source; customerId; customerName; customerPhone;
  services: string; staffNames: string; amount; createdAt }

type DraftLine = { lineId?: string; serviceId; staffMemberId; startAt }
type CheckRequest = { appointmentId?; customerId?; lines: DraftLine[] }
type LineCheck = { index; startAt; endAt; blockEndAt; issues: Issue[] }
type CheckResult = { ok: boolean; lines: LineCheck[]; issues: Issue[] }
type CreateAppointmentRequest = { customerId?; newCustomer?: { phone; fullName }; source; note?; lines: DraftLine[] }
type UpdateAppointmentRequest = { source?; note?; lines: DraftLine[] }
type Suggestions = { freeTechnicians: StaffOption[]; nextSlots: string[] /* ISO */ }

type PublicCatalogDto = { shop: { name; address; hotline; logoUrl }; openTime; closeTime;
  groups: { id; name; services: { id; code; name; description; imageUrl; durationMinutes; price }[] }[];
  technicians: { id; fullName; specialty; color; serviceIds: string[] }[] }
type PublicBookingRequest = { serviceIds: string[]; staffMemberId?: string | null; startAt; fullName; phone; note? }
type PublicAppointmentDto = { code; status; date; startAt; endAt; total; phoneMasked; customerName; canCancel;
  hotline; lines: { serviceName; staffName; startAt; endAt; price }[] }

type CheckoutPreviewDto = { appointmentId; appointmentCode; status; customer: { id; code; fullName; phone };
  lines: { appointmentLineId; serviceId; serviceName; staffMemberId; staffName; price; durationMinutes;
    commissionType; commissionValue }[];
  packages: CustomerPackageBrief[] /* mọi gói của khách cho các dịch vụ trong lịch */;
  discountLimitPercent: 0 | 10 | 50; today }
type CheckoutRequest = { clientRequestId; appointmentId; lines: { appointmentLineId; usePackage: boolean }[];
  sellPackages: { packageTemplateId; consultantStaffId }[]; discount?: { type; value; reason };
  intervalOverrideReason?; method; cashReceived?; cardAuthCode?; expectedTotal }
type PackageSaleRequest = { clientRequestId; customerId; packageTemplateId; consultantStaffId; method;
  cashReceived?; cardAuthCode?; expectedTotal }
type InvoiceDto = { id; code; appointmentId; appointmentCode; customer: { id; code; fullName; phone }; paidAt;
  cashierName; serviceTotal; packageTotal; discountType; discountValue; discountAmount; discountReason; total; method;
  cashReceived; changeAmount; cardAuthCode; intervalOverrideReason; status; cancelReason; cancelledAt;
  cancelledByName; canCancel; cancelBlockedReason; lines: InvoiceLineDto[] }
type InvoiceLineDto = { id; kind; description; staffName; durationMinutes; listPrice; usesPackage; amount; basePrice;
  packageCode; packageRemaining; packageExpiryDate; commissionAmount }

type CustomerPackageDto = CustomerPackageBrief & { customerId; customerCode; customerName; customerPhone;
  packageTemplateId; usedSessions; price; extendedDays; extendReason; consultantName; invoiceId; invoiceCode;
  expiringSoon; canExtend }
type CustomerPackageDetailDto = CustomerPackageDto & { usages: { id; usedAt; appointmentId; appointmentCode;
  invoiceCode; staffName; overrideReason; refunded }[] }

type CommissionRow = { staffMemberId; staffCode; staffName; serviceCount; serviceBase; serviceCommission;
  packageCount; packageCommission; total }
type CommissionSheetDto = { month; code; status; closedAt; closedByName; paidAt; paidByName; canClose;
  closeBlockedReason; rows: CommissionRow[]; totals: CommissionRow }
type CommissionItemDto = { id; earnedAt; invoiceId; invoiceCode; appointmentId; customerName; kind; description;
  baseAmount; rateType; rateValue; amount }
type MyCommissionsDto = { month; status; total; serviceCommission; packageCommission; items: CommissionItemDto[] }
type MyScheduleDto = { staffMemberId; staffName; date; shift; shiftStart; shiftEnd; offReason;
  items: { appointmentId; appointmentCode; status; lineId; startAt; endAt; serviceName; customerName;
    customerNote; appointmentNote }[] }

type DashboardCard = { id; code; status; customerName; startAt; endAt; services; staffNames; createdAt;
  pendingOverdue; isLate; source }
type DashboardTodayDto = { date; shopClosedReason; counts: { total; pending; confirmed; inService; completed;
  noShow; cancelled }; revenueToday; newCustomersToday; upcoming: DashboardCard[]; pendingOnline: DashboardCard[];
  tomorrow: DashboardCard[] }
```

Báo cáo: `RevenueReportDto { from; to; days: { date; serviceRevenue; packageRevenue; revenue; serviceValue; invoiceCount; discount }[]; totals; previous: { from; to; …totals } }`; `ServiceReportDto { rows: { serviceId; code; name; groupName; count; value; share; packageCount }[]; totals }`; `TechnicianReportDto { rows: { staffMemberId; code; fullName; count; value; bookedMinutes; shiftMinutes; occupancy; commission }[] }`; `PackageReportDto { soldCount; soldAmount; activeCount; unusedSessions; unusedValue; rows: { packageTemplateId; code; name; soldCount; soldAmount; usedSessions }[]; expiringSoon: CustomerPackageDto[] }`; `CancellationReportDto { total; cancelled; noShow; cancelRate; noShowRate; bySource: { source; total; cancelled; noShow }[] }`.

---

## 6. Màn hình FE

| Route | Màn hình | Quyền vào | Ghi chú |
| :--- | :--- | :--- | :--- |
| `/dashboard` | Tổng quan (SCR-01) | `dashboard.view` | Thay trang Tổng quan nền |
| `/appointments` | Lưới lịch hẹn (SCR-02, SCR-03) | `appointments.view` | `?date=`, `?pending=1` (lọc chờ xác nhận); tự làm mới mỗi 30 giây |
| `/appointments/[id]` | Chi tiết lịch hẹn (SCR-04, SCR-05) | `appointments.view` | |
| `/print/invoices/[id]` | Bản in 80 mm (SCR-06) | `invoices.create`, `customer-packages.view` | Nhóm `(print)` |
| `/dat-lich` | Đặt lịch online (SCR-07) | công khai | Nhóm `(public)`, tối ưu 375 px |
| `/dat-lich/tra-cuu` | Tra cứu, hủy (SCR-08) | công khai | `?code=` điền sẵn |
| `/services` | Dịch vụ (SCR-09) | `services.view` | Tab Dịch vụ, Nhóm dịch vụ |
| `/packages` | Gói liệu trình (SCR-10) | `packages.view`, `customer-packages.view` | Tab Gói của khách, Gói mẫu |
| `/staff` | Nhân viên (SCR-11) | `staff-members.view` | Tab Nhân viên, Lịch tuần, Ngày nghỉ, Giờ mở cửa |
| `/commissions` | Hoa hồng (SCR-12) | `commissions.view` | |
| `/my-schedule` | Lịch và hoa hồng của tôi (SCR-13) | `appointments.view-own` | Tối ưu 375 px |
| `/customers` | Khách hàng (SCR-14) | `customers.view` | Ngăn kéo chi tiết: tab Lịch hẹn, Gói, Hóa đơn |
| `/reports` | Báo cáo (SCR-15) | `reports.view` | Tab Doanh thu, Dịch vụ, Kỹ thuật viên, Gói liệu trình, Hủy và không đến |
