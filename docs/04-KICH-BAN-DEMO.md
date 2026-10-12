# Kịch bản demo — Quản lý Spa Salon

> Dùng khi trình bày cho chủ spa, salon tóc, tiệm nail. Thời lượng 12–15 phút. Đi theo một ngày của tiệm: khách đặt lịch online, lễ tân xếp lịch, khách tới làm dịch vụ, trừ buổi gói, bán gói, kỹ thuật viên xem lịch, chủ tiệm xem hoa hồng và báo cáo.

---

## 1. Chuẩn bị trước buổi demo

- [ ] Mở sẵn link demo, thử "Đăng nhập nhanh" cả 4 vai trò
- [ ] Đặt lại dữ liệu demo (thanh công cụ demo → Đặt lại dữ liệu) để có lịch hẹn 90 ngày qua và 14 ngày tới tính theo hôm nay
- [ ] Đổi tên tiệm, logo, màu theo thương hiệu khách (Cài đặt → Thương hiệu) nếu đã biết
- [ ] Mở tablet hoặc thu trình duyệt về 1280×800 để chiếu lưới lịch hẹn như ở quầy
- [ ] Chuẩn bị một điện thoại mở sẵn trang `/dat-lich` (vai khách) và một điện thoại để đăng nhập `kythuatvien`
- [ ] Ghi nhớ khách mẫu: chị Nguyễn Thị Lan Anh (0903 123 456) có gói "Chăm sóc da cơ bản 10 buổi" còn 6 buổi; chị Hoàng Minh Châu (0912 555 888) có nhãn "Hay bỏ hẹn"
- [ ] Mở trước lưới hôm nay, tìm một khối đang có của chị Nguyễn Thị Mai để dùng ở bước 4

| Link | Ghi chú |
| :--- | :--- |
| FE | `http://localhost:3109` hoặc link online |
| Trang đặt lịch cho khách | `http://localhost:3109/dat-lich` |
| Swagger | `https://localhost:7109/swagger` (khi khách hỏi về tích hợp) |

| Tài khoản | Vai trò | Dùng để cho xem |
| :--- | :--- | :--- |
| `admin` | Quản trị viên | Phân quyền, thương hiệu |
| `quanly` | Chủ tiệm | Tổng quan, dịch vụ, gói, lịch làm việc, hoa hồng, báo cáo |
| `nhanvien` | Lễ tân | Lịch hẹn, xác nhận, kéo thả, check-in, thanh toán, bán gói |
| `kythuatvien` | Kỹ thuật viên (Lê Hoàng Yến) | Lịch và hoa hồng của tôi trên điện thoại |

Mật khẩu: giá trị `DEMO_PASSWORD` trong `.env`, hoặc bấm "Đăng nhập nhanh".

---

## 2. Câu chuyện demo

> Mở đầu: "Anh/chị hình dung hôm nay tiệm mình có 6 kỹ thuật viên, lễ tân vừa nghe điện thoại vừa trả lời tin nhắn. Em đi đúng một ngày của tiệm để anh/chị thấy phần mềm đỡ cho mình chỗ nào."

| # | Vai trò | Thao tác | Điểm cần nhấn mạnh |
| :---: | :--- | :--- | :--- |
| 1 | Chủ tiệm | Đăng nhập, mở Tổng quan: số lịch hôm nay, lịch đang phục vụ, các lịch online chờ xác nhận (lịch chờ quá 30 phút tô cam), thực thu tới giờ này | Không cần gọi lễ tân vẫn biết hôm nay tiệm đông hay vắng, tiền đã vào bao nhiêu |
| 2 | Khách | Trên điện thoại mở trang đặt lịch: chọn "Massage body đá nóng 90 phút" và "Gội đầu dưỡng sinh 45 phút", chọn "Bất kỳ ai", chọn 18:00 tối mai, nhập tên, số điện thoại | Khách tự đặt lúc nửa đêm cũng được; chỉ thấy giờ thật sự còn trống, không phải nhắn qua lại hỏi giờ |
| 3 | Lễ tân | Đổi vai trò sang Lễ tân, mở Lịch hẹn ngày mai: khối vừa đặt hiện viền vàng ở cột KTV được xếp; bấm "Xác nhận", xem tin nhắn xác nhận giả lập | Lịch online giữ chỗ ngay, không ai đặt chồng lên được; lễ tân chỉ việc bấm xác nhận |
| 4 | Lễ tân | Khách gọi điện xin chăm sóc da với chị Mai: chạm vào ô ngay sau khối đang có của chị Mai; hệ thống báo "Nguyễn Thị Mai bận tới hh:mm (gồm thời gian dọn)", bấm "Gợi ý" để thấy giờ trống gần nhất và KTV khác đang rảnh | Không còn cảnh hai khách cùng chờ một KTV; thời gian dọn giường cũng được tính |
| 5 | Lễ tân | Khách báo tới trễ 30 phút: kéo khối xuống 30 phút; thử kéo khối chăm sóc da sang cột KTV làm nail, khối tự bật về | Đổi giờ một thao tác kéo thả, hệ thống tự chặn xếp sai người, sai ca |
| 6 | Lễ tân | Chị Lan Anh tới: check-in, khách muốn làm thêm gội đầu, bấm "Thêm dịch vụ" xếp nối tiếp cho KTV khác | Dịch vụ phát sinh thêm ngay trên lịch, giờ kết thúc tự tính |
| 7 | Lễ tân | Thanh toán: dòng chăm sóc da tự "Trừ buổi" (còn 6 buổi thành 5), gội đầu 150.000 ₫; chọn chuyển khoản, hiện QR; in hóa đơn có dòng "còn 5 buổi, hạn dd/MM/yyyy" | Hết cảnh tra sổ xem khách còn mấy buổi; khách cầm hóa đơn biết ngay gói còn bao nhiêu |
| 8 | Lễ tân | Một khách lẻ vừa làm massage đá nóng muốn mua gói 5 buổi giá 2.300.000 ₫ (lẻ 2.750.000 ₫): bấm "Bán gói kèm", buổi hôm nay trừ luôn vào gói, chọn KTV tư vấn | Bán gói ngay lúc khách đang hài lòng; người tư vấn có hoa hồng nên nhân viên chủ động chào gói |
| 9 | Kỹ thuật viên | Trên điện thoại đăng nhập `kythuatvien`: xem lịch hôm nay, ghi chú "dị ứng tinh dầu sả" của khách, tab Hoa hồng tạm tính tháng này | KTV tự xem lịch, không phải hỏi lễ tân; thấy hoa hồng từng ngày nên yên tâm làm |
| 10 | Chủ tiệm | Mở Hoa hồng tháng này: bảng theo nhân viên, bấm vào một KTV xem từng khoản; mở tháng trước, bấm "Chốt bảng hoa hồng" | Cuối tháng không còn ngồi cộng tay; mỗi khoản có hóa đơn đi kèm, nhân viên hỏi là trả lời được |
| 11 | Chủ tiệm | Mở Báo cáo: thực thu tách dịch vụ lẻ và bán gói, giá trị dịch vụ đã làm, tỉ lệ lấp lịch từng KTV, tổng giá trị buổi gói khách chưa dùng | Biết KTV nào kín lịch, ai đang rảnh; biết tiệm còn "nợ" khách bao nhiêu buổi đã thu tiền trước |
| 12 | Quản trị viên | Đổi sang Quản trị viên, bỏ quyền "Giảm giá" của vai trò Lễ tân, đổi sang Lễ tân thấy nút giảm giá biến mất; đổi màu thương hiệu | Phân quyền tới từng nút; giao diện mang thương hiệu của tiệm |

> Kết: "Toàn bộ dữ liệu anh/chị vừa thấy là dữ liệu mẫu. Bản triển khai thật sẽ nhập dịch vụ, gói, kỹ thuật viên của tiệm mình, gắn link đặt lịch lên fanpage và Zalo của tiệm."

---

## 3. Câu hỏi khách hay hỏi

| Câu hỏi | Trả lời gợi ý |
| :--- | :--- |
| Có tự nhắn Zalo, SMS nhắc lịch cho khách không? | Demo đang giả lập: tin xác nhận, nhắc trước 2 giờ, hủy lịch được ghi vào nhật ký để xem nội dung. Bản triển khai nối Zalo ZNS hoặc SMS brandname, phí tính theo tin của nhà mạng. |
| Tiệm có 5 giường, có quản lý giường, phòng không? | Demo xếp theo kỹ thuật viên. Bản triển khai thêm giường, phòng như một nguồn lực nữa để không xếp quá số giường. |
| Khách hay đặt rồi bỏ, có thu cọc được không? | Demo chưa thu cọc mà gắn nhãn "Hay bỏ hẹn" khi khách vắng 3 lần trong 90 ngày. Bản triển khai có thể bắt cọc qua QR cho khách có nhãn này hoặc cho dịch vụ dài. |
| Hoa hồng tiệm em tính theo bậc doanh số, mỗi người một mức thì sao? | Demo tính theo từng dịch vụ (phần trăm hoặc số tiền cố định) và theo gói bán. Bậc doanh số, mức riêng từng người làm được khi triển khai. |
| Có bán mỹ phẩm, quản lý kho không? | Demo chưa có. Có sẵn demo POS bán lẻ và Quản lý kho; bản triển khai gộp bán sản phẩm vào cùng hóa đơn. |
| Có thẻ trả trước, nạp 5 triệu tặng 1 triệu không? | Demo chưa có. Đây là tính năng phổ biến của spa, làm được khi triển khai: ví tiền của khách, trừ dần khi thanh toán. |
| Gói hết hạn mà khách còn buổi thì sao? | Gói chuyển "Hết hạn", không trừ được nữa. Chủ tiệm gia hạn được một lần, tối đa 60 ngày, có ghi lý do. |
| Kỹ thuật viên có lấy được số điện thoại khách để làm riêng không? | Không. Màn hình KTV chỉ hiện tên, dịch vụ và ghi chú cần cho việc làm dịch vụ, không hiện số điện thoại. |
| Có nhiều chi nhánh, khách mua gói ở chi nhánh này làm ở chi nhánh kia được không? | Demo chạy một chi nhánh. Bản triển khai dùng chung hồ sơ khách và gói giữa các chi nhánh, hoa hồng tính cho KTV chi nhánh làm dịch vụ. |
| Mất mạng thì sao? | Bản demo cần mạng. Lịch hẹn nằm trên máy chủ nên xem được bằng điện thoại 4G; bản triển khai có thể lưu tạm lịch trong ngày để xem khi mất mạng. |

---

## 4. Sau buổi demo

- [ ] Ghi lại yêu cầu khách nêu thêm vào `01-TONG-QUAN-NGHIEP-VU.md`
- [ ] Ghi lại số KTV, số giường, cách tính hoa hồng hiện tại, các gói đang bán của tiệm
- [ ] Ghi lại kênh khách đặt lịch nhiều nhất (điện thoại, Zalo, Facebook) để ưu tiên tích hợp
- [ ] Gửi link demo, link `/dat-lich` và tài khoản `nhanvien`, `quanly` cho khách tự trải nghiệm (nếu đồng ý)
