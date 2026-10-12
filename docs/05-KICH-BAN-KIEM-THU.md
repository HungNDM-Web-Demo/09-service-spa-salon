# Kịch bản kiểm thử nghiệm thu — Quản lý Spa Salon

> Test case theo use case trong `03-USE-CASE.md`. Phần nền (đăng nhập, phân quyền, đặt lại dữ liệu) dùng TC-SYS-01 đến TC-SYS-10 trong `ZDOCS/03-KIEN-TRUC/USE-CASE-NEN.md` §8.

---

## 1. Cách chạy

| Mục | Nội dung |
| :--- | :--- |
| Môi trường | Chạy cả hai chế độ: dữ liệu mẫu (`mock`) và BE thật (`api`) |
| Dữ liệu | Đặt lại dữ liệu demo trước mỗi lượt test, trong khoảng 09:30–12:00 |
| Thứ tự | Chạy theo thứ tự số TC; nhiều TC dùng kết quả của TC trước |
| Thời điểm | Chạy TC-23 đến TC-33 trước 14:00 để còn đủ chỗ trong ca của NV01, NV05 |
| Tài khoản | Theo cột "Vai trò", dùng "Đăng nhập nhanh"; vai trò Khách dùng cửa sổ ẩn danh |
| Thiết bị | TC vai trò Lễ tân chạy ở cửa sổ 1280×800; TC vai trò Khách, Kỹ thuật viên chạy ở 375×812 |
| Ghi số liệu gốc | Trước TC-23, chủ tiệm ghi lại: thực thu hôm nay, số lịch Hoàn thành, Không đến ở Tổng quan; tổng hoa hồng tháng này của NV01, NV05; ở Báo cáo hôm nay: thực thu dịch vụ lẻ, thực thu bán gói, giá trị dịch vụ đã làm |
| Đạt | Kết quả thực tế khớp toàn bộ cột "Kết quả mong đợi" |

**Ngày T** là Thứ Ba gần nhất cách hôm nay từ 2 ngày trở lên.

**Dịch vụ:**

- `DV001` "Chăm sóc da cơ bản": 60 phút, dọn 10 phút, 350.000 ₫, hoa hồng 12%.
- `DV005` "Massage body đá nóng": 90 phút, dọn 15 phút, 550.000 ₫, hoa hồng 10%.
- `DV008` "Gội đầu dưỡng sinh": 45 phút, dọn 10 phút, 150.000 ₫, hoa hồng cố định 30.000 ₫.
- `DV012` "Sơn gel tay": 45 phút, dọn 5 phút, 150.000 ₫, hoa hồng cố định 25.000 ₫.

**Gói mẫu:** `GOI01` "Chăm sóc da cơ bản 10 buổi" (DV001, 2.800.000 ₫, hạn 6 tháng, cách tối thiểu 7 ngày, hoa hồng bán gói 5%); `GOI03` "Massage đá nóng 5 buổi" (DV005, 2.300.000 ₫, hạn 4 tháng, không giới hạn khoảng cách, 5%); `GOI08` "Triệt lông nách 12 buổi" đang ngừng bán.

**Nhân viên:**

| Mã | Họ tên | Loại | Dịch vụ làm được | Lịch tuần |
| :--- | :--- | :--- | :--- | :--- |
| NV01 | Nguyễn Thị Mai | KTV | DV001, DV005 | Cả ngày, mọi ngày |
| NV02 | Trần Thu Hà | KTV | DV001, triệt lông | Ca sáng, mọi ngày |
| NV03 | Lê Hoàng Yến (tài khoản `kythuatvien`) | KTV | DV005, DV008 | Ca chiều, nghỉ Thứ Tư |
| NV04 | Phạm Minh Thư | KTV | DV012 | Cả ngày, nghỉ Thứ Hai |
| NV05 | Võ Ngọc Lan | KTV | DV001, DV008, DV012 | Cả ngày, mọi ngày |
| NV06 | Đặng Quốc Bảo | KTV | Dịch vụ tóc | Cả ngày, nghỉ Thứ Ba |
| NV07 | Phạm Ngọc Quỳnh | Lễ tân | — | — |

Chỉ NV01 và NV03 làm được DV005.

**Khách:**

| Mã | Họ tên | Số điện thoại | Ghi chú cho test |
| :--- | :--- | :--- | :--- |
| KH00001 | Nguyễn Thị Lan Anh | 0903 123 456 | Gói GOI01 mua giá 2.800.000 ₫, còn 6/10 buổi, hạn còn trên 60 ngày, buổi gần nhất 10 ngày trước; ghi chú "Da nhạy cảm, dị ứng AHA" |
| KH00002 | Hoàng Minh Châu | 0912 555 888 | 3 lần không đến trong 90 ngày, nhãn "Hay bỏ hẹn" |
| KH00003 | Trần Bảo Ngọc | 0938 777 222 | Gói GOI01 mua giá 2.800.000 ₫, còn 4/10 buổi, buổi gần nhất 3 ngày trước |
| KH00004 | Mai Phương Thảo | 0909 246 810 | Gói GOI01 hết hạn hôm qua, còn 2 buổi, trạng thái "Hết hạn" |
| KH00005 | Võ Thanh Tâm | 0916 888 999 | Chưa có gói |
| KH00006 | Đinh Gia Hân | 0935 135 790 | Chưa có gói |

**Lịch cố định cho test (dữ liệu mẫu phải bảo đảm):**

- Ngày T: NV01, NV03, NV05 không có lịch nào.
- Hôm nay: NV01, NV05 không có lịch từ giờ đặt lại dữ liệu tới giờ đóng cửa.
- Hôm nay: lịch của Hoàng Minh Châu, DV001 với NV02, bắt đầu trước giờ đặt lại 30 phút (làm tròn xuống mốc 15 phút), "Đã xác nhận", chưa check-in.
- Ngày mai: NV01 có ít nhất 2 lịch "Đã xác nhận"; có lịch online của Phan Thị Hạnh (0907 112 233), DV005 với NV01 lúc 10:00, "Chờ xác nhận", tạo trước giờ đặt lại 45 phút.
- Bảng hoa hồng tháng trước "Tạm tính", tháng trước nữa "Đã chốt"; cả hai tháng đều có hóa đơn.

---

## 2. Test case

### 2.1. Dịch vụ, gói mẫu, nhân viên

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-01 | UC-01 | Thêm dịch vụ và cho đặt online | Chủ tiệm | 1. Dịch vụ → Thêm dịch vụ 2. Nhập mã `DV099`, tên "Ủ tóc phục hồi collagen", nhóm Tóc, 45 phút, dọn 10 phút, 250.000 ₫, hoa hồng 10%, bật "Cho đặt online" 3. Lưu 4. Nhân viên → NV06, tick DV099, lưu 5. Mở `/dat-lich` | Bước 3 lưu được, có nhắc "chưa hiện trên trang đặt lịch vì chưa có kỹ thuật viên"; sau bước 4, trang đặt lịch có "Ủ tóc phục hồi collagen · 45 phút · 250.000 ₫" trong nhóm Tóc |
| TC-02 | UC-01 | Dữ liệu dịch vụ không hợp lệ | Chủ tiệm | 1. Thêm dịch vụ mã `DV001` 2. Đổi mã `DV100`, thời lượng 50 phút 3. Đổi thời lượng 60 phút, giá 255.500 ₫ 4. Lưu ở từng bước | Bước 1 báo trùng mã; bước 2 báo "Thời lượng là bội số 15 phút"; bước 3 báo "Giá là bội số 1.000 ₫"; không lưu |
| TC-03 | UC-01 | Thêm gói mẫu | Chủ tiệm | 1. Gói liệu trình → Gói mẫu → Thêm gói 2. Mã `GOI09`, tên "Gội đầu dưỡng sinh 10 buổi", dịch vụ DV008, 10 buổi, giá 1.200.000 ₫, hạn 6 tháng 3. Lưu | Hiện giá lẻ tương đương 1.500.000 ₫, tiết kiệm 300.000 ₫ (20%), giá trị một buổi 120.000 ₫; gói có trong danh sách chọn khi bán gói |
| TC-04 | UC-02 | Ngày nghỉ đột xuất trùng lịch đã có | Chủ tiệm | 1. Nhân viên → Ngày nghỉ 2. Thêm ngày nghỉ cho NV01 vào ngày mai, lý do "Việc gia đình" 3. Lưu | Hệ thống liệt kê các lịch ngày mai của NV01 (giờ, khách, dịch vụ), trong đó có lịch của Phan Thị Hạnh; không lưu ngày nghỉ |
| TC-05 | UC-02 | Thêm KTV mới | Chủ tiệm | 1. Thêm nhân viên `NV09` "Huỳnh Kim Ngân", loại KTV, dịch vụ DV012, lịch tuần cả ngày mọi thứ 2. Lưu 3. Đổi sang Lễ tân, mở Lịch hẹn ngày mai | Lưới ngày mai có cột "Huỳnh Kim Ngân" trống, 09:00–21:00 không tô xám |

### 2.2. Lịch hẹn tại quầy

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-06 | UC-03 | Tạo lịch hẹn | Lễ tân | 1. Lịch hẹn, chọn ngày T 2. Chạm ô NV01 lúc 14:00 3. Nhập 0903 123 456, chọn DV001 4. Lưu | Hộp tạo lịch hiện tên Nguyễn Thị Lan Anh, nhãn "Dùng gói, còn 6 buổi"; giờ kết thúc 15:00; lịch mã `LH{yyMMdd}{nnn}`, trạng thái "Đã xác nhận"; khối 14:00–15:00 ở cột NV01 |
| TC-07 | UC-03 | Trùng KTV do thời gian dọn | Lễ tân | 1. Ngày T, tạo lịch cho khách mới "Trương Mỹ Linh" 0976 543 210, DV005 với NV01 lúc 15:00 2. Đổi giờ thành 15:15 3. Lưu | Bước 1 báo "Nguyễn Thị Mai bận tới 15:10 (gồm thời gian dọn)", nút Lưu khóa; bước 2 hợp lệ, giờ kết thúc 16:45; bước 3 lưu được, hồ sơ khách mới được tạo |
| TC-08 | UC-03 | KTV không làm được dịch vụ | Lễ tân | 1. Ngày T, tạo lịch, chọn DV001 2. Mở danh sách KTV 3. Đóng hộp, chạm ô của NV03 lúc 16:00, chọn DV001 | Bước 2 không có NV03; bước 3 báo "Lê Hoàng Yến không làm được Chăm sóc da cơ bản" |
| TC-09 | UC-03 | Ngoài ca, quá giờ đóng cửa | Lễ tân | 1. Ngày T, tạo lịch DV008 với NV03 lúc 14:30 2. Đổi giờ 20:30 3. Đổi giờ 20:15 4. Đóng hộp, không lưu | Bước 1 báo "Ngoài ca làm (ca chiều 15:00–21:00)"; bước 2 báo kết thúc 21:15 quá giờ đóng cửa; bước 3 hợp lệ, kết thúc 21:00 |
| TC-10 | UC-03 | Trùng lịch của khách, dịch vụ song song | Lễ tân | 1. Ngày T, tạo lịch mới cho 0903 123 456: DV008 với NV05 lúc 14:30 2. Mở lịch của TC-06, thêm dòng DV008 với NV05 lúc 14:00, lưu | Bước 1 báo "Khách đã có lịch LH… 14:00–15:00", không lưu; bước 2 lưu được, lịch có 2 dòng song song 14:00–15:00 (NV01) và 14:00–14:45 (NV05) |
| TC-11 | UC-03 | Cảnh báo khách hay bỏ hẹn | Lễ tân | 1. Tạo lịch, nhập 0912 555 888 2. Đóng hộp, không lưu | Hiện tên Hoàng Minh Châu, cảnh báo vàng "Hay bỏ hẹn: 3 lần không đến trong 90 ngày"; nút Lưu vẫn dùng được khi chọn dịch vụ hợp lệ |

### 2.3. Đặt lịch online

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-12 | UC-04 | Đặt lịch online | Khách | 1. Mở `/dat-lich`, chọn DV005 2. Chọn NV03 3. Chọn ngày T, 17:00 4. Nhập "Đỗ Thu Trang", 0987 654 321, bấm Đặt lịch | Màn thành công hiện mã `LH…`, "Chờ xác nhận", 17:00–18:30, tổng dự kiến 550.000 ₫; lễ tân thấy khối viền vàng ở cột NV03 ngày T; hồ sơ khách mới được tạo |
| TC-13 | UC-04 | Mốc trống tính cả thời gian dọn | Khách | 1. Chọn DV001, NV01, ngày T 2. Xem các mốc giờ | Hiện 09:00 đến 12:30 và 17:00 đến 20:00; không hiện 13:00 đến 16:30 (NV01 bận 14:00–15:10 và 15:15–17:00) và không hiện 20:30 |
| TC-14 | UC-04 | Giới hạn lịch online theo số điện thoại | Khách | 1. Đặt thêm DV008 với NV05, ngày T 10:00, bằng 0987 654 321 2. Đặt tiếp một lịch bất kỳ bằng số này | Bước 1 thành công; bước 2 báo "Số điện thoại này đã có 2 lịch đang chờ, vui lòng gọi tiệm" |
| TC-15 | UC-04 | "Bất kỳ ai" chia đều lịch | Khách | 1. Chọn DV005, "Bất kỳ ai", ngày T, 19:00 2. Nhập "Lý Mỹ Duyên", 0977 111 222, Đặt lịch | Hệ thống xếp NV03 Lê Hoàng Yến (đã xếp 90 phút, ít hơn NV01 150 phút); lịch 19:00–20:30 |
| TC-16 | UC-04 | Hai người cùng đặt một mốc (chế độ `api`) | Khách | 1. Mở hai cửa sổ, cùng chọn DV001, NV01, ngày T, 09:00 2. Nhập hai số 0911 000 001, 0911 000 002 3. Bấm Đặt lịch ở hai cửa sổ gần như cùng lúc | Chỉ một lịch được tạo; cửa sổ còn lại báo "Giờ này vừa có người đặt, vui lòng chọn giờ khác" và quay về bước chọn giờ |

### 2.4. Xác nhận, đổi giờ, hủy lịch

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-17 | UC-05 | Xác nhận lịch online | Lễ tân | 1. Mở lịch của TC-12 2. Bấm "Xác nhận" | Lịch "Đã xác nhận", khối hết viền vàng; nhật ký tin nhắn có "Tin xác nhận" (khi đã làm FR-17) |
| TC-18 | UC-05 | Kéo thả đổi giờ hợp lệ | Lễ tân | 1. Ngày T, kéo khối DV005 của Trương Mỹ Linh (NV01 15:15) thả vào 18:00 cùng cột | Khối nằm ở 18:00–19:30, lưu ngay; chi tiết lịch ghi giờ kết thúc 19:30 |
| TC-19 | UC-05 | Kéo thả sang KTV không làm được | Lễ tân | 1. Ngày T, kéo khối DV001 của Lan Anh (NV01 14:00) sang cột NV03 | Khối trở về NV01 14:00, báo "Lê Hoàng Yến không làm được Chăm sóc da cơ bản" |
| TC-20 | UC-05 | Hủy lịch, chỗ trống trở lại | Lễ tân, Khách | 1. Hủy lịch của TC-12, lý do "Khách báo hủy" 2. Khách mở `/dat-lich`, chọn DV005, NV03, ngày T | Bước 1: lịch "Đã hủy", khối rời khỏi lưới; bước 2: mốc 17:00 hiện lại |
| TC-21 | UC-05 | Lịch online chờ quá 30 phút | Lễ tân | 1. Mở Lịch hẹn ngày mai 2. Mở Tổng quan | Khối của Phan Thị Hạnh nền cam; dòng của lịch này trong danh sách chờ xác nhận ở Tổng quan cũng tô cam |
| TC-22 | UC-06 | Khách tự hủy; dưới 2 giờ không hủy được | Khách | 1. Mở `/dat-lich/tra-cuu`, nhập mã lịch thứ hai của Đỗ Thu Trang (TC-14) và 0987 654 321 2. Bấm Hủy lịch, chọn lý do, xác nhận 3. Tra cứu lịch hôm nay của Hoàng Minh Châu bằng mã và 0912 555 888 | Bước 1 hiện số điện thoại "0987 *** 321"; bước 2 lịch "Đã hủy"; bước 3 không có nút Hủy, hiện "Vui lòng gọi tiệm" kèm hotline |

### 2.5. Check-in, thanh toán, gói liệu trình

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-23 | UC-07 | Check-in, thêm dịch vụ phát sinh | Lễ tân | 1. Tạo lịch hôm nay cho 0903 123 456: DV001 với NV01 ở mốc trống gần nhất 2. Bấm "Check-in" 3. Bấm "Thêm dịch vụ", chọn DV008 với NV05 | Lịch "Đang phục vụ", có giờ check-in; dòng DV008 bắt đầu đúng giờ kết thúc của DV001, dài 45 phút |
| TC-24 | UC-07 | Check-in lịch không phải hôm nay | Lễ tân | 1. Mở lịch ngày T của Lan Anh (TC-06) | Không có nút "Check-in", không có nút "Không đến" |
| TC-25 | UC-07 | Ghi nhận không đến | Lễ tân | 1. Mở lịch hôm nay của Hoàng Minh Châu (đã quá giờ bắt đầu) 2. Bấm "Không đến" 3. Mở lịch ngày mai của Phan Thị Hạnh | Bước 2: lịch "Không đến", khối rời khỏi lưới, hồ sơ Châu ghi 4 lần không đến trong 90 ngày; bước 3: không có nút "Không đến" |
| TC-26 | UC-08 | Thanh toán có trừ buổi | Lễ tân | 1. Mở lịch của TC-23, bấm "Thanh toán" 2. Giữ nguyên "Trừ buổi" ở dòng DV001 3. Chọn Chuyển khoản, bấm "Đã nhận tiền", "Hoàn tất" | Dòng DV001 tự bật "Trừ buổi, còn 5 buổi", ghi 0 ₫; DV008 150.000 ₫; tổng 150.000 ₫; QR 150.000 ₫, nội dung là mã hóa đơn; hóa đơn `HD{yyMMdd}{nnn}`; gói của Lan Anh còn 5/10; lịch "Hoàn thành"; bản in có dòng "Trừ gói GL…, còn 5 buổi" |
| TC-27 | UC-08 | Giảm vượt hạn mức, tiền không đủ | Lễ tân | 1. Tạo lịch hôm nay cho 0935 135 790: DV005 với NV01, DV008 với NV05 nối tiếp; check-in 2. Thanh toán, giảm 15% 3. Đổi thành giảm 10% 4. Chọn Tiền mặt, nhập 500.000 ₫ | Tổng trước giảm 700.000 ₫; bước 2 báo "Lễ tân giảm tối đa 10% (70.000 ₫)"; bước 3 giảm 70.000 ₫, tổng 630.000 ₫; bước 4 nút "Hoàn tất" khóa, hiện "Còn thiếu 130.000 ₫" |
| TC-28 | UC-08 | Thanh toán tiền mặt có giảm giá | Lễ tân | 1. Tiếp TC-27, nhập tiền khách đưa 700.000 ₫ 2. Hoàn tất | Tiền thối 70.000 ₫; hóa đơn tổng 630.000 ₫; hoa hồng NV01 55.000 ₫ (10% × 550.000 ₫, không trừ giảm giá), NV05 30.000 ₫ |
| TC-29 | UC-08 | Trừ buổi chưa đủ khoảng cách, hóa đơn 0 ₫ | Lễ tân | 1. Tạo lịch hôm nay cho 0938 777 222: DV001 với NV01; check-in; Thanh toán 2. Bấm Hoàn tất khi chưa nhập lý do 3. Nhập lý do "Khách đi công tác, xin làm sớm", Hoàn tất | Bước 1 cảnh báo "Buổi gần nhất cách 3 ngày, gói yêu cầu 7 ngày", tổng 0 ₫, không có phần chọn phương thức; bước 2 bị chặn; bước 3 tạo hóa đơn 0 ₫, gói còn 3/10, hoa hồng NV01 33.000 ₫ (12% × 280.000 ₫ = 33.600 ₫, làm tròn xuống) |
| TC-30 | UC-09 | Bán gói kèm, trừ buổi đầu ngay | Lễ tân | 1. Tạo lịch hôm nay cho 0916 888 999: DV005 với NV01, DV008 với NV05 nối tiếp; check-in; Thanh toán 2. "Bán gói kèm" GOI03, người tư vấn NV01 3. Giảm 10% 4. Chuyển khoản, Hoàn tất | Dòng DV005 tự bật "Trừ buổi" bằng gói vừa bán; giảm 15.000 ₫ (10% × 150.000 ₫, chỉ tính trên dịch vụ lẻ); tổng 2.435.000 ₫ (2.300.000 + 150.000 − 15.000); gói mới còn 4/5 buổi, hạn = hôm nay + 4 tháng; hoa hồng NV01 46.000 ₫ (10% × 460.000 ₫) và 115.000 ₫ bán gói, NV05 30.000 ₫ |
| TC-31 | UC-09 | Bán gói riêng | Lễ tân | 1. Gói liệu trình → Bán gói 2. Khách 0935 135 790, gói GOI01, người tư vấn NV05 3. Tiền mặt 3.000.000 ₫, Hoàn tất | Tiền thối 200.000 ₫; gói `GL{yyMMdd}{nnn}` "Đang dùng", 10/10 buổi, hạn = hôm nay + 6 tháng; hoa hồng bán gói NV05 140.000 ₫ |
| TC-32 | UC-09 | Bán gói thiếu thông tin, gói ngừng bán | Lễ tân | 1. Bán gói, chọn GOI01, để trống khách và người tư vấn, Hoàn tất 2. Mở danh sách chọn gói mẫu | Bước 1 báo lỗi tại ô Khách và ô Người tư vấn, không tạo gói; bước 2 không có GOI08 |
| TC-33 | UC-08 | Gói hết hạn không trừ được | Lễ tân | 1. Tạo lịch hôm nay cho 0909 246 810: DV001 với NV05; check-in; Thanh toán 2. Tiền mặt 350.000 ₫, Hoàn tất | Dòng DV001 không bật "Trừ buổi", ghi chú "Gói GL… hết hạn ngày {hôm qua}"; tổng 350.000 ₫, thối 0 ₫; hoa hồng NV05 42.000 ₫ |

### 2.6. Hủy hóa đơn, hoa hồng

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-34 | UC-10 | Hủy hóa đơn trả buổi và hoa hồng | Chủ tiệm | 1. Mở lịch của TC-23 (đã Hoàn thành) 2. Bấm "Hủy hóa đơn", lý do "Thu nhầm phương thức", xác nhận | Hóa đơn "Đã hủy"; gói của Lan Anh về 6/10; hoa hồng 33.000 ₫ của NV01 và 30.000 ₫ của NV05 từ hóa đơn này rời khỏi bảng tháng; lịch về "Đang phục vụ" |
| TC-35 | UC-10 | Hủy hóa đơn tháng đã chốt | Chủ tiệm | 1. Mở một lịch hẹn đã thanh toán trong tháng trước nữa | Nút "Hủy hóa đơn" vô hiệu, chú thích "Tháng MM/yyyy đã chốt hoa hồng" |
| TC-36 | UC-11 | Bảng hoa hồng tháng này | Chủ tiệm | 1. Mở Hoa hồng, tháng hiện tại 2. So với số đã ghi trước TC-23 3. Bấm dòng NV01 | NV01 tăng 249.000 ₫, NV05 tăng 242.000 ₫; chi tiết NV01 có thêm 4 khoản: 55.000 ₫, 33.000 ₫, 46.000 ₫, 115.000 ₫ (bán gói) |
| TC-37 | UC-11 | Chốt bảng hoa hồng | Chủ tiệm | 1. Ở tháng hiện tại bấm "Chốt bảng hoa hồng" 2. Chọn tháng trước, bấm Chốt, xác nhận 3. Mở một lịch hẹn đã thanh toán của tháng trước | Bước 1 nút khóa, chú thích "Chỉ chốt từ 01/{tháng sau}"; bước 2 bảng "Đã chốt", ghi người và ngày chốt; bước 3 nút "Hủy hóa đơn" vô hiệu |
| TC-38 | UC-12 | KTV xem lịch và hoa hồng của mình | Kỹ thuật viên | 1. Đăng nhập nhanh vai trò Kỹ thuật viên 2. Chuyển sang ngày T 3. Mở tab Hoa hồng 4. Gõ URL `/commissions` | Vào thẳng Lịch của tôi; ngày T có lịch Lý Mỹ Duyên 19:00–20:30, không hiện số điện thoại; tab Hoa hồng chỉ có khoản của NV03; bước 4 chuyển tới `/forbidden` |

### 2.7. Khách hàng, tổng quan, báo cáo

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-39 | UC-13 | Xem hồ sơ khách | Lễ tân | 1. Khách hàng, tìm 0903 123 456 2. Mở tab Gói, Lịch hẹn | Ghi chú "Da nhạy cảm, dị ứng AHA"; tab Gói: GOI01 còn 6/10; tab Lịch hẹn có lịch hôm nay "Đang phục vụ" và lịch ngày T "Đã xác nhận" |
| TC-40 | UC-14 | Tổng quan cập nhật theo hóa đơn | Chủ tiệm | 1. Mở Tổng quan 2. So với số đã ghi trước TC-23 | Thực thu hôm nay tăng 6.215.000 ₫ (630.000 + 0 + 2.435.000 + 2.800.000 + 350.000); số lịch Hoàn thành tăng 4; số lịch Không đến tăng 1 |
| TC-41 | UC-14 | KTV không vào được Tổng quan | Kỹ thuật viên | 1. Gõ URL `/dashboard` | Chuyển tới `/forbidden` |
| TC-42 | UC-15 | Báo cáo thực thu và giá trị dịch vụ | Chủ tiệm | 1. Báo cáo → Doanh thu → Hôm nay 2. So với số đã ghi trước TC-23 | Thực thu bán gói tăng 5.100.000 ₫ (2.300.000 + 2.800.000); thực thu dịch vụ lẻ tăng 1.115.000 ₫; giá trị dịch vụ đã làm tăng 1.940.000 ₫ (700.000 + 280.000 + 610.000 + 350.000) |

---

## 3. Biên bản chạy thử

| Ngày | Người test | Chế độ | Số TC đạt / tổng | Lỗi ghi nhận |
| :--- | :--- | :--- | :---: | :--- |
| | | | | |
