/**
 * Sinh FE/src/mock/seed/demo-data.json cho demo Quản lý Spa Salon (docs/06-THIET-KE-CSDL.md §5).
 *
 *   pnpm seed:generate
 *
 * Danh mục viết tay ở đầu file; lịch hẹn, gói của khách mô phỏng 16 tuần (tuần −13 tới tuần +2 so với tuần hiện tại)
 * bằng bộ sinh số giả ngẫu nhiên có hạt giống cố định: chạy lại ra đúng file cũ.
 * Ngày của lịch sinh ngẫu nhiên ghi dạng tuần `w: [k, thứ]` để rơi đúng thứ trong tuần dù nạp vào ngày nào;
 * lịch của kịch bản kiểm thử ghi dạng lệch ngày `d` và có `fx: true` (06 §5.3, §5.6).
 */
import { writeFileSync } from 'node:fs'

const OUT = new URL('../src/mock/seed/demo-data.json', import.meta.url)

// ───────────────────────────── Bộ sinh ngẫu nhiên (mulberry32)
let seed = 20261020
function rnd() {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1))
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const chance = (p) => rnd() < p
function weighted(entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let r = rnd() * total
  for (const [v, w] of entries) {
    r -= w
    if (r < 0) return v
  }
  return entries[entries.length - 1][0]
}
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ───────────────────────────── Danh mục (06 §5.1, 05 §1)
const OPEN = 540
const CLOSE = 1260
const NOON = 900

const serviceGroups = [
  { code: 'DA', name: 'Chăm sóc da' },
  { code: 'BODY', name: 'Massage – body' },
  { code: 'GOI', name: 'Gội đầu dưỡng sinh' },
  { code: 'NAIL', name: 'Nail' },
  { code: 'TOC', name: 'Tóc' },
  { code: 'TRIET', name: 'Triệt lông' },
]

// [code, name, group, dur, clean, price, ct, cv, online, desc, visible?]
const S = [
  ['DV001', 'Chăm sóc da cơ bản', 'DA', 60, 10, 350000, 'PhanTram', 12, true, 'Làm sạch sâu, tẩy tế bào chết, đắp mặt nạ dưỡng ẩm, massage mặt thư giãn.'],
  ['DV002', 'Chăm sóc da chuyên sâu', 'DA', 90, 10, 550000, 'PhanTram', 12, true, 'Soi da, lấy nhân mụn, điện di tinh chất, mặt nạ collagen theo tình trạng da.'],
  ['DV003', 'Trị mụn chuẩn y khoa', 'DA', 75, 15, 450000, 'PhanTram', 12, true, 'Lấy nhân mụn vô khuẩn, chiếu ánh sáng xanh, đắp mặt nạ làm dịu.'],
  ['DV004', 'Cấy tinh chất trắng da', 'DA', 60, 10, 650000, 'PhanTram', 10, false, 'Cấy tinh chất vitamin C và niacinamide bằng máy, cần tư vấn trước khi làm.'],
  ['DV005', 'Massage body đá nóng', 'BODY', 90, 15, 550000, 'PhanTram', 10, true, 'Massage toàn thân với đá bazan làm ấm, giảm đau mỏi vai gáy, lưng.'],
  ['DV006', 'Massage body tinh dầu', 'BODY', 60, 10, 380000, 'PhanTram', 10, true, 'Massage toàn thân thư giãn với tinh dầu thiên nhiên.'],
  ['DV007', 'Massage chân thảo dược', 'BODY', 45, 10, 220000, 'CoDinh', 30000, true, 'Ngâm chân thảo dược, bấm huyệt bàn chân, bắp chân.'],
  ['DV008', 'Gội đầu dưỡng sinh', 'GOI', 45, 10, 150000, 'CoDinh', 30000, true, 'Gội thảo mộc, massage đầu, cổ, vai, gáy theo liệu pháp dưỡng sinh.'],
  ['DV009', 'Gội thảo dược massage cổ vai gáy', 'GOI', 60, 10, 220000, 'CoDinh', 40000, true, 'Gội bồ kết, hương nhu kết hợp massage cổ vai gáy chuyên sâu.'],
  ['DV010', 'Gội dưỡng sinh cao cấp đá muối', 'GOI', 75, 10, 320000, 'PhanTram', 12, true, 'Gội dưỡng sinh, chườm đá muối Himalaya, xông hơi mặt.'],
  ['DV011', 'Cắt da, sơn thường tay', 'NAIL', 30, 5, 80000, 'CoDinh', 15000, true, 'Cắt da, dũa form móng, sơn thường một màu.'],
  ['DV012', 'Sơn gel tay', 'NAIL', 45, 5, 150000, 'CoDinh', 25000, true, 'Sơn gel bền màu 3–4 tuần, có sẵn hơn 200 màu.'],
  ['DV013', 'Sơn gel chân', 'NAIL', 45, 5, 150000, 'CoDinh', 25000, true, 'Sơn gel móng chân, tặng ngâm chân muối khoáng.'],
  ['DV014', 'Đắp bột, nối móng', 'NAIL', 90, 10, 450000, 'PhanTram', 15, true, 'Nối móng bột hoặc gel theo form khách chọn.'],
  ['DV015', 'Vẽ móng nghệ thuật', 'NAIL', 60, 5, 250000, 'PhanTram', 15, true, 'Vẽ tay, đính đá theo mẫu, giá cho 10 ngón.'],
  ['DV016', 'Chăm sóc móng chân spa', 'NAIL', 45, 10, 180000, 'CoDinh', 30000, true, 'Ngâm chân, chà gót, cắt da, dưỡng ẩm móng chân.'],
  ['DV017', 'Cắt tóc nữ', 'TOC', 45, 5, 150000, 'CoDinh', 30000, true, 'Tư vấn kiểu, cắt, gội sấy tạo kiểu.'],
  ['DV018', 'Cắt tóc nam', 'TOC', 30, 5, 100000, 'CoDinh', 20000, true, 'Cắt, cạo viền, gội sấy.'],
  ['DV019', 'Uốn tóc', 'TOC', 150, 10, 850000, 'PhanTram', 10, false, 'Uốn lạnh hoặc uốn nóng, cần tư vấn tình trạng tóc trước.'],
  ['DV020', 'Nhuộm tóc', 'TOC', 120, 10, 750000, 'PhanTram', 10, false, 'Nhuộm thời trang hoặc phủ bạc, thuốc nhuộm hữu cơ.'],
  ['DV021', 'Duỗi phục hồi keratin', 'TOC', 150, 10, 1200000, 'PhanTram', 10, false, 'Duỗi thẳng mềm kết hợp phục hồi keratin.'],
  ['DV022', 'Hấp dầu phục hồi', 'TOC', 45, 5, 200000, 'CoDinh', 30000, true, 'Hấp dầu collagen phục hồi tóc khô xơ.'],
  ['DV023', 'Gội sấy tạo kiểu', 'TOC', 30, 5, 100000, 'CoDinh', 15000, true, 'Gội, sấy phồng hoặc uốn cụp nhẹ.'],
  ['DV024', 'Triệt lông nách', 'TRIET', 30, 10, 300000, 'PhanTram', 10, true, 'Triệt lông công nghệ Diode Laser, không đau rát.'],
  ['DV025', 'Triệt lông chân', 'TRIET', 60, 10, 700000, 'PhanTram', 10, true, 'Triệt lông toàn chân bằng Diode Laser.'],
  ['DV026', 'Triệt lông tay', 'TRIET', 45, 10, 500000, 'PhanTram', 10, true, 'Triệt lông toàn tay bằng Diode Laser.'],
  ['DV027', 'Triệt lông mép', 'TRIET', 15, 10, 200000, 'PhanTram', 10, true, 'Triệt ria mép, vùng nhỏ.'],
  ['DV028', 'Massage mặt nâng cơ', 'DA', 45, 10, 280000, 'PhanTram', 12, true, 'Massage nâng cơ mặt bằng tay và đá gua sha.'],
  ['DV029', 'Tẩy tế bào chết toàn thân', 'BODY', 45, 10, 300000, 'PhanTram', 10, true, 'Tẩy da chết bằng muối khoáng, dưỡng ẩm toàn thân.'],
  ['DV030', 'Ủ trắng body', 'BODY', 60, 10, 450000, 'PhanTram', 10, true, 'Ủ trắng toàn thân bằng sữa non (đang tạm ngừng).', false],
]
const services = S.map(([code, name, group, dur, clean, price, ct, cv, online, desc, visible]) => ({
  code,
  name,
  group,
  dur,
  clean,
  price,
  ct,
  cv,
  online,
  ...(visible === false ? { visible: false } : {}),
  desc,
}))
const svc = Object.fromEntries(services.map((s) => [s.code, s]))

const packageTemplates = [
  { code: 'GOI01', name: 'Chăm sóc da cơ bản 10 buổi', service: 'DV001', sessions: 10, price: 2800000, months: 6, gap: 7, rate: 5 },
  { code: 'GOI02', name: 'Trị mụn chuẩn y khoa 10 buổi', service: 'DV003', sessions: 10, price: 3800000, months: 6, gap: 7, rate: 5 },
  { code: 'GOI03', name: 'Massage đá nóng 5 buổi', service: 'DV005', sessions: 5, price: 2300000, months: 4, gap: 0, rate: 5 },
  { code: 'GOI04', name: 'Gội thảo dược 10 buổi', service: 'DV009', sessions: 10, price: 1800000, months: 6, gap: 0, rate: 5 },
  { code: 'GOI05', name: 'Massage body tinh dầu 10 buổi', service: 'DV006', sessions: 10, price: 3200000, months: 6, gap: 0, rate: 5 },
  { code: 'GOI06', name: 'Triệt lông chân 8 buổi', service: 'DV025', sessions: 8, price: 4200000, months: 12, gap: 28, rate: 5 },
  { code: 'GOI07', name: 'Chăm sóc móng chân 6 buổi', service: 'DV016', sessions: 6, price: 900000, months: 4, gap: 0, rate: 5 },
  { code: 'GOI08', name: 'Triệt lông nách 12 buổi', service: 'DV024', sessions: 12, price: 2400000, months: 12, gap: 28, rate: 5, active: false },
]
const tpl = Object.fromEntries(packageTemplates.map((t) => [t.code, t]))

// week: Thứ Hai → Chủ nhật; S sáng, C chiều, F cả ngày, - nghỉ
const staff = [
  { code: 'NV01', name: 'Nguyễn Thị Mai', phone: '0905112201', kind: 'KyThuatVien', color: '#E11D48', specialty: 'Chăm sóc da, massage body', services: ['DV001', 'DV002', 'DV003', 'DV004', 'DV005', 'DV006', 'DV028', 'DV029'], week: 'FFFFFFF' },
  { code: 'NV02', name: 'Trần Thu Hà', phone: '0905112202', kind: 'KyThuatVien', color: '#7C3AED', specialty: 'Chăm sóc da, triệt lông', services: ['DV001', 'DV002', 'DV003', 'DV024', 'DV025', 'DV026', 'DV027', 'DV028'], week: 'SSSSSSS' },
  { code: 'NV03', name: 'Lê Hoàng Yến', phone: '0905112203', kind: 'KyThuatVien', color: '#0891B2', specialty: 'Massage, gội đầu dưỡng sinh', user: 'kythuatvien', services: ['DV005', 'DV006', 'DV007', 'DV008', 'DV009', 'DV010', 'DV029'], week: 'CC-CCCC' },
  { code: 'NV04', name: 'Phạm Minh Thư', phone: '0905112204', kind: 'KyThuatVien', color: '#DB2777', specialty: 'Nail', services: ['DV011', 'DV012', 'DV013', 'DV014', 'DV015', 'DV016'], week: '-FFFFFF' },
  { code: 'NV05', name: 'Võ Ngọc Lan', phone: '0905112205', kind: 'KyThuatVien', color: '#059669', specialty: 'Chăm sóc da, gội đầu, nail', services: ['DV001', 'DV007', 'DV008', 'DV009', 'DV011', 'DV012', 'DV013', 'DV028'], week: 'FFFFFFF' },
  { code: 'NV06', name: 'Đặng Quốc Bảo', phone: '0905112206', kind: 'KyThuatVien', color: '#2563EB', specialty: 'Cắt, uốn, nhuộm tóc', services: ['DV017', 'DV018', 'DV019', 'DV020', 'DV021', 'DV022', 'DV023'], week: 'F-FFFFF' },
  { code: 'NV07', name: 'Phạm Ngọc Quỳnh', phone: '0905112207', kind: 'LeTan', color: '#64748B', specialty: 'Lễ tân', user: 'nhanvien', services: [], week: '-------' },
  { code: 'NV08', name: 'Hồ Thị Kiều', phone: '0905112208', kind: 'KyThuatVien', color: '#D97706', specialty: 'Nail, chăm sóc móng', services: ['DV011', 'DV012', 'DV013', 'DV014', 'DV015', 'DV016'], week: 'SSSSSFF' },
]
const st = Object.fromEntries(staff.map((s) => [s.code, s]))
const technicians = staff.filter((s) => s.kind === 'KyThuatVien')

const daysOff = [
  { staff: 'NV06', w: [-3, 5], reason: 'Nghỉ ốm' },
  { staff: 'NV04', w: [-7, 3], reason: 'Đi học lớp nail nâng cao' },
  { staff: 'NV02', w: [1, 4], reason: 'Việc gia đình' },
  { w: [3, 1], reason: 'Tiệm nghỉ bảo trì, sửa chữa' },
]
const offKey = (code, w, wd) => `${code}|${w * 7 + wd - 1}`
const staffOff = new Set(daysOff.filter((d) => d.staff).map((d) => offKey(d.staff, d.w[0], d.w[1])))

// ───────────────────────────── Khách hàng
const FAMILY = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Trương', 'Đinh', 'Mai', 'Lâm', 'Tô', 'Châu', 'Cao', 'Lương', 'Tạ', 'Hà']
const MID_F = ['Thị', 'Ngọc', 'Thu', 'Thanh', 'Minh', 'Bảo', 'Kim', 'Mỹ', 'Khánh', 'Phương', 'Diệu', 'Gia', 'Hoài', 'Quỳnh', 'Tuyết', 'Như']
const GIVEN_F = ['Anh', 'Trang', 'Linh', 'Hương', 'Lan', 'Hà', 'Thảo', 'Vy', 'Nhi', 'Ngân', 'Hằng', 'Huyền', 'Quyên', 'Trâm', 'Uyên', 'Yến', 'Châu', 'My', 'Thư', 'Tâm', 'Hạnh', 'Phương', 'Giang', 'Hoa', 'Nga', 'Oanh', 'Thủy', 'Vân', 'Loan', 'Nhung', 'Diễm', 'Xuân', 'Trinh', 'Mơ']
const MID_M = ['Văn', 'Minh', 'Quốc', 'Hoàng', 'Đức', 'Gia', 'Thành', 'Anh']
const GIVEN_M = ['Huy', 'Nam', 'Khoa', 'Long', 'Tuấn', 'Phúc', 'Hải', 'Sơn', 'Duy', 'Khang', 'Bình']
const NOTES = [
  'Da dầu, hay nổi mụn vùng chữ T',
  'Da khô, cần dưỡng ẩm kỹ',
  'Dị ứng tinh dầu sả',
  'Da nhạy cảm, không dùng sản phẩm có cồn',
  'Thích massage lực mạnh',
  'Đau vai gáy, massage nhẹ vùng cổ',
  'Đang mang thai, tránh đá nóng',
  'Thích màu nail tông nude',
  'Dị ứng latex, dùng găng nitrile',
  'Tóc đã tẩy, hạn chế hóa chất mạnh',
]
// Số và tên dùng trong kịch bản kiểm thử: không được trùng với khách sinh ngẫu nhiên (05 §2)
const RESERVED_PHONES = new Set(['0976543210', '0987654321', '0977111222', '0911000001', '0911000002'])
const RESERVED_NAMES = new Set(['Trương Mỹ Linh', 'Đỗ Thu Trang', 'Lý Mỹ Duyên', 'Huỳnh Kim Ngân'])

const fixtureCustomers = [
  { code: 'KH00001', name: 'Nguyễn Thị Lan Anh', phone: '0903123456', g: 'Nu', birth: '1990-05-12', note: 'Da nhạy cảm, dị ứng AHA', cr: -200 },
  { code: 'KH00002', name: 'Hoàng Minh Châu', phone: '0912555888', g: 'Nu', cr: -150 },
  { code: 'KH00003', name: 'Trần Bảo Ngọc', phone: '0938777222', g: 'Nu', birth: '1995-11-03', cr: -120 },
  { code: 'KH00004', name: 'Mai Phương Thảo', phone: '0909246810', g: 'Nu', cr: -250 },
  { code: 'KH00005', name: 'Võ Thanh Tâm', phone: '0916888999', g: 'Nu', cr: -60 },
  { code: 'KH00006', name: 'Đinh Gia Hân', phone: '0935135790', g: 'Nu', cr: -45 },
  { code: 'KH00007', name: 'Phan Thị Hạnh', phone: '0907112233', g: 'Nu', cr: -90 },
]
const usedPhones = new Set([...fixtureCustomers.map((c) => c.phone), ...RESERVED_PHONES, ...staff.map((s) => s.phone)])
const usedNames = new Set([...fixtureCustomers.map((c) => c.name), ...RESERVED_NAMES])
const PREFIX = ['090', '091', '093', '094', '097', '098', '077', '070', '079', '081', '083', '084', '085', '086', '088', '096', '032', '033', '034', '035', '036', '037', '038', '039']

const customers = [...fixtureCustomers]
for (let i = 8; i <= 200; i++) {
  const male = chance(0.12)
  let name
  do {
    name = male
      ? `${pick(FAMILY)} ${pick(MID_M)} ${pick(GIVEN_M)}`
      : `${pick(FAMILY)} ${pick(MID_F)} ${pick(GIVEN_F)}`
  } while (usedNames.has(name))
  usedNames.add(name)
  let phone
  do {
    phone = pick(PREFIX) + String(int(0, 9999999)).padStart(7, '0')
  } while (usedPhones.has(phone))
  usedPhones.add(phone)
  const c = { code: `KH${String(i).padStart(5, '0')}`, name, phone, g: male ? 'Nam' : 'Nu' }
  if (chance(0.3)) c.birth = `${int(1975, 2004)}-${String(int(1, 12)).padStart(2, '0')}-${String(int(1, 28)).padStart(2, '0')}`
  if (chance(0.22)) c.note = pick(NOTES)
  customers.push(c)
}
const custByCode = Object.fromEntries(customers.map((c) => [c.code, c]))
const NEW_TODAY = ['KH00198', 'KH00199', 'KH00200'] // tạo hôm nay, chỉ có lịch từ tuần sau (FR-01)
const bulkCustomers = customers.filter((c) => Number(c.code.slice(2)) >= 10 && !NEW_TODAY.includes(c.code))
// Khách quen: hay quay lại hơn
const regular = new Set(shuffle(bulkCustomers).slice(0, 60).map((c) => c.code))
const custWeights = bulkCustomers.map((c) => [c.code, regular.has(c.code) ? 5 : 1])

// ───────────────────────────── Lịch: mô phỏng theo ngày dạng tuần
const W_MIN = -13
const W_MAX = 2
const dayIndex = (w, wd) => w * 7 + wd - 1
const shiftOf = (code, wd) => {
  const ch = st[code].week[wd - 1]
  return ch === 'S' ? [OPEN, NOON] : ch === 'C' ? [NOON, CLOSE] : ch === 'F' ? [OPEN, CLOSE] : null
}
const occ = new Map() // `${day}|${staff}` → [[start, blockEnd]]
const cbusy = new Map() // `${day}|${customer}` → [[start, end]]
const occList = (k, m) => (m.has(k) ? m.get(k) : (m.set(k, []), m.get(k)))
const overlap = (a1, b1, a2, b2) => a1 < b2 && a2 < b1
const ceil15 = (m) => Math.ceil(m / 15) * 15
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

function canDo(staffCode, serviceCode, w, wd, start) {
  const s = svc[serviceCode]
  const shift = shiftOf(staffCode, wd)
  if (!shift || !st[staffCode].services.includes(serviceCode)) return false
  if (staffOff.has(offKey(staffCode, w, wd))) return false
  const end = start + s.dur
  if (start < shift[0] || end > shift[1] || end > CLOSE || start < OPEN) return false
  const day = dayIndex(w, wd)
  return !occList(`${day}|${staffCode}`, occ).some(([a, b]) => overlap(start, end + s.clean, a, b))
}

/** Xếp các dịch vụ nối tiếp từ `start`; chọn KTV (ưu tiên người đã chọn ở dòng trước). Trả dòng hoặc null. */
function planLines(codes, w, wd, start, prefer) {
  const lines = []
  let t = start
  let prev = null
  for (const code of codes) {
    const candidates = shuffle(technicians.map((x) => x.code)).filter((k) => {
      const at = prev && prev.staff === k ? ceil15(t + svc[prev.service].clean) : t
      return canDo(k, code, w, wd, at)
    })
    if (candidates.length === 0) return null
    const k = prefer && candidates.includes(prefer) ? prefer : prev && candidates.includes(prev.staff) && chance(0.6) ? prev.staff : candidates[0]
    const at = prev && prev.staff === k ? ceil15(t + svc[prev.service].clean) : t
    const line = { service: code, staff: k, start: at }
    // giữ chỗ tạm để dòng sau thấy
    occList(`${dayIndex(w, wd)}|${k}`, occ).push([at, at + svc[code].dur + svc[code].clean])
    lines.push(line)
    t = at + svc[code].dur
    prev = line
  }
  return lines
}
function releaseLines(lines, w, wd) {
  for (const l of lines) {
    const list = occ.get(`${dayIndex(w, wd)}|${l.staff}`)
    const i = list.findIndex(([a]) => a === l.start)
    if (i >= 0) list.splice(i, 1)
  }
}
const spanOf = (lines) => [Math.min(...lines.map((l) => l.start)), Math.max(...lines.map((l) => l.start + svc[l.service].dur))]
function customerFree(c, w, wd, lines) {
  const [a, b] = spanOf(lines)
  return !occList(`${dayIndex(w, wd)}|${c}`, cbusy).some(([x, y]) => overlap(a, b, x, y))
}
function startCandidates(wd) {
  const weekend = wd >= 6
  const r = rnd()
  let m
  if (weekend) m = int(0, 42) * 15 + OPEN // 09:00–19:30
  else if (r < 0.42) m = 17 * 60 + int(0, 10) * 15 // 17:00–19:30
  else m = 9 * 60 + 30 + int(0, 30) * 15 // 09:30–17:00
  return chance(0.75) ? Math.floor(m / 30) * 30 : m
}

const SERVICE_WEIGHTS = [
  ['DV001', 8], ['DV002', 4], ['DV003', 4], ['DV004', 1], ['DV005', 5], ['DV006', 5], ['DV007', 3], ['DV008', 9], ['DV009', 5], ['DV010', 2],
  ['DV011', 4], ['DV012', 9], ['DV013', 5], ['DV014', 3], ['DV015', 2], ['DV016', 3], ['DV017', 4], ['DV018', 3], ['DV019', 1], ['DV020', 1],
  ['DV021', 1], ['DV022', 2], ['DV023', 2], ['DV024', 3], ['DV025', 2], ['DV026', 1], ['DV027', 1], ['DV028', 3], ['DV029', 2],
]
const COMBOS = [
  ['DV001', 'DV008'], ['DV012', 'DV013'], ['DV005', 'DV008'], ['DV002', 'DV028'], ['DV017', 'DV022'], ['DV006', 'DV007'],
  ['DV012', 'DV016'], ['DV001', 'DV012'], ['DV029', 'DV006'], ['DV008', 'DV012'], ['DV003', 'DV008', 'DV012'],
]

const appointments = [] // bulk
const packageSales = []
const custPackages = new Map() // customer → Set(service) có gói (không chọn ngẫu nhiên dịch vụ này nữa)

function sourceFor() {
  return weighted([['DienThoai', 35], ['Online', 30], ['VangLai', 15], ['ZaloFacebook', 20]])
}
function leadFor(src) {
  if (src === 'VangLai') return 0.05
  if (src === 'Online') return weighted([[int(2, 12), 4], [int(13, 48), 4], [int(49, 120), 2]])
  return weighted([[int(3, 24), 5], [int(25, 96), 4], [int(97, 240), 1]])
}
function payFor() {
  const m = weighted([['TienMat', 45], ['ChuyenKhoan', 40], ['The', 15]])
  const pay = { m }
  const r = rnd()
  if (r < 0.06) pay.disc = ['PhanTram', pick([5, 10]), pick(['Khách quen', 'Sinh nhật khách', 'Khuyến mãi trong tháng'])]
  else if (r < 0.08) pay.disc = ['SoTien', pick([20000, 30000, 50000]), 'Khách quen']
  else if (r < 0.095) {
    pay.disc = ['PhanTram', pick([15, 20]), 'Bù lỗi dịch vụ lần trước']
    pay.by = 'quanly'
  }
  return pay
}
function outcomeFor(w, src) {
  if (w >= 0 && src === 'Online' && chance(w >= 1 ? 0.35 : 0.1)) return 'pending'
  const r = rnd()
  return r < 0.05 ? 'noshow' : r < 0.13 ? 'cancel' : 'done'
}
function cancelFor(src) {
  const reason = weighted([['KhachBaoHuy', 60], ['TiemDoiLich', 15], [src === 'Online' ? 'KhachTuHuy' : 'KhachBaoHuy', 15], ['Khac', 10]])
  return reason === 'Khac' ? ['Khac', pick(['Khách đổi sang chi nhánh khác', 'Trời mưa lớn, khách xin dời', 'Khách bị ốm'])] : [reason]
}

function place(customer, codes, w, wd, opts = {}) {
  for (let attempt = 0; attempt < 14; attempt++) {
    const start = opts.start ?? startCandidates(wd)
    const lines = planLines(codes, w, wd, start, opts.prefer)
    if (!lines) {
      if (opts.start !== undefined) return null
      continue
    }
    if (!customerFree(customer, w, wd, lines)) {
      releaseLines(lines, w, wd)
      if (opts.start !== undefined) return null
      continue
    }
    const [a, b] = spanOf(lines)
    occList(`${dayIndex(w, wd)}|${customer}`, cbusy).push([a, b])
    const src = opts.src ?? sourceFor()
    const o = opts.o ?? outcomeFor(w, src)
    const appt = {
      c: customer,
      w: [w, wd],
      src,
      o,
      ln: lines.map((l) => [l.service, l.staff, hhmm(l.start)]),
      ld: leadFor(src),
    }
    if (o === 'cancel') appt.cx = cancelFor(src)
    if (o === 'done' || o === 'pending') appt.pay = opts.pay ?? payFor()
    if (opts.sell) appt.pay.sell = opts.sell
    appointments.push(appt)
    return appt
  }
  return null
}

// 1) Khách mua gói (sinh trước để lịch dùng gói có chỗ)
const buyers = shuffle(bulkCustomers.filter((c) => !NEW_TODAY.includes(c.code))).slice(0, 40)
for (const buyer of buyers) {
  const tcode = weighted([['GOI01', 6], ['GOI02', 4], ['GOI03', 5], ['GOI04', 4], ['GOI05', 4], ['GOI06', 3], ['GOI07', 4], ['GOI08', 2]])
  const t = tpl[tcode]
  const w0 = tcode === 'GOI08' ? int(-12, -10) : int(-12, -1)
  const wd0 = int(1, 7)
  const svcCode = t.service
  const capable = technicians.filter((x) => x.services.includes(svcCode)).map((x) => x.code)
  if (!custPackages.has(buyer.code)) custPackages.set(buyer.code, new Set())
  custPackages.get(buyer.code).add(svcCode)
  let day0 = dayIndex(w0, wd0)
  let used = 0
  if (chance(0.6)) {
    // bán kèm lúc thanh toán một lịch cùng dịch vụ (BR-21)
    const appt = place(buyer.code, [svcCode], w0, wd0, { o: 'done', pay: { m: pick(['TienMat', 'ChuyenKhoan', 'The', 'ChuyenKhoan']) } })
    if (!appt) continue
    appt.pay.sell = [[tcode, appt.ln[0][1]]]
    used = 1
  } else {
    packageSales.push({
      id: '',
      c: buyer.code,
      tpl: tcode,
      w: [w0, wd0],
      t: hhmm(int(20, 39) * 30),
      by: pick([...capable, 'NV07']),
      m: pick(['TienMat', 'ChuyenKhoan', 'ChuyenKhoan', 'The']),
    })
  }
  const lastDay = Math.min(dayIndex(W_MAX, 7), day0 + t.months * 30 - 6)
  let day = day0
  while (used < t.sessions) {
    day += t.gap > 0 ? t.gap + int(0, 7) : int(6, 14)
    if (day > lastDay) break
    const w = Math.floor(day / 7)
    const wd = (day % 7 + 7) % 7 + 1
    if (w < W_MIN || w > W_MAX) break
    const prefer = chance(0.7) ? capable[0] : undefined
    const appt = place(buyer.code, [svcCode], w, wd, { prefer, o: chance(0.94) ? 'done' : 'noshow' })
    if (!appt) continue
    used += 1
  }
}

// 2) Lịch ngẫu nhiên lấp đầy từng ngày
for (let w = W_MIN; w <= W_MAX; w++) {
  for (let wd = 1; wd <= 7; wd++) {
    const weekend = wd >= 6
    const base = weekend ? int(15, 19) : int(9, 12)
    const factor = w <= 0 ? 1 : w === 1 ? 0.45 : 0.2
    const target = Math.round(base * factor)
    let have = appointments.filter((a) => a.w[0] === w && a.w[1] === wd).length
    let guard = 0
    while (have < target && guard++ < 80) {
      const c = w >= 1 && chance(0.06) ? pick(NEW_TODAY) : weighted(custWeights)
      const banned = custPackages.get(c) ?? new Set()
      let codes = chance(0.27) ? pick(COMBOS) : [weighted(SERVICE_WEIGHTS)]
      if (codes.some((x) => banned.has(x))) continue
      if (place(c, codes, w, wd)) have += 1
    }
  }
}

// Mỗi khách mới hôm nay có ít nhất một lịch tuần sau
for (const c of NEW_TODAY) {
  if (!appointments.some((a) => a.c === c)) place(c, [weighted(SERVICE_WEIGHTS)], 1, int(1, 7), { o: 'done' })
}

// ───────────────────────────── Lịch, gói của kịch bản kiểm thử (06 §5.6)
const fixtures = []
const fx = (o) => fixtures.push({ ...o, fx: true })
packageSales.push({ id: '', c: 'KH00001', tpl: 'GOI01', d: -70, t: '17:20', by: 'NV05', m: 'ChuyenKhoan', fx: true })
packageSales.push({ id: '', c: 'KH00003', tpl: 'GOI01', d: -70, t: '11:40', by: 'NV01', m: 'TienMat', fx: true })
packageSales.push({ id: '', c: 'KH00004', tpl: 'GOI01', d: -183, t: '15:10', by: 'NV02', m: 'The', exp: -1, fx: true })
for (const [d, k, t] of [[-66, 'NV01', '10:00'], [-45, 'NV02', '10:30'], [-24, 'NV05', '14:00'], [-10, 'NV01', '15:00']]) {
  fx({ c: 'KH00001', d, src: 'DienThoai', o: 'done', ln: [['DV001', k, t]], ld: 30, pay: { m: 'TienMat' } })
}
fx({ c: 'KH00001', d: -38, src: 'Online', o: 'done', ln: [['DV008', 'NV05', '18:00']], ld: 20, pay: { m: 'ChuyenKhoan' } })
for (const d of [-70, -35, -10]) {
  fx({ c: 'KH00002', d, src: 'Online', o: 'noshow', ln: [['DV001', 'NV02', '10:00']], ld: 26 })
}
fx({ c: 'KH00002', d: -52, src: 'DienThoai', o: 'done', ln: [['DV028', 'NV05', '16:30']], ld: 48, pay: { m: 'TienMat' } })
fx({ c: 'KH00002', d: 0, src: 'DienThoai', st: 'DaXacNhan', ln: [['DV001', 'NV02', '~-30']], ld: 20, nt: 'Khách hẹn qua điện thoại' })
for (const [d, k, t] of [[-65, 'NV05', '11:00'], [-50, 'NV01', '16:00'], [-35, 'NV02', '09:30'], [-20, 'NV05', '17:00'], [-12, 'NV01', '10:00'], [-3, 'NV05', '15:30']]) {
  fx({ c: 'KH00003', d, src: 'ZaloFacebook', o: 'done', ln: [['DV001', k, t]], ld: 40, pay: { m: 'TienMat' } })
}
for (let i = 0; i < 8; i++) {
  fx({ c: 'KH00004', d: -175 + i * 10, src: 'DienThoai', o: 'done', ln: [['DV001', 'NV02', '10:00']], ld: 30, pay: { m: 'TienMat' } })
}
fx({ c: 'KH00005', d: -30, src: 'VangLai', o: 'done', ln: [['DV008', 'NV05', '11:00']], ld: 0.05, pay: { m: 'TienMat' } })
fx({ c: 'KH00006', d: -20, src: 'Online', o: 'done', ln: [['DV012', 'NV05', '16:00']], ld: 30, pay: { m: 'ChuyenKhoan' } })
fx({ c: 'KH00007', d: -40, src: 'DienThoai', o: 'done', ln: [['DV006', 'NV01', '19:00']], ld: 24, pay: { m: 'The' } })
fx({ c: 'KH00007', d: 1, src: 'Online', st: 'ChoXacNhan', ln: [['DV005', 'NV01', '10:00']], cr: -45, nt: 'Em muốn làm với chị Mai' })
fx({ c: 'KH00008', d: 1, src: 'DienThoai', st: 'DaXacNhan', ln: [['DV001', 'NV01', '14:00']], ld: 30 })
fx({ c: 'KH00009', d: 1, src: 'ZaloFacebook', st: 'DaXacNhan', ln: [['DV005', 'NV01', '16:00']], ld: 52 })

const reserve = [
  { staff: ['NV01', 'NV05'], d: 0, from: 'now' },
  { staff: ['NV01', 'NV03', 'NV05'], day: 'T' },
]

// ───────────────────────────── Kiểm tra nhanh lịch sinh ngẫu nhiên
const errors = []
{
  const seen = new Map()
  for (const a of appointments) {
    if (a.o === 'cancel' || a.o === 'noshow') continue
    for (const [code, k, t] of a.ln) {
      const s0 = Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
      const key = `${dayIndex(a.w[0], a.w[1])}|${k}`
      const shift = shiftOf(k, a.w[1])
      if (!shift || s0 < shift[0] || s0 + svc[code].dur > shift[1]) errors.push(`Ngoài ca: ${a.c} ${k} ${a.w} ${t}`)
      if (!st[k].services.includes(code)) errors.push(`Không làm được: ${k} ${code}`)
      const list = seen.get(key) ?? []
      for (const [x, y] of list) if (overlap(s0, s0 + svc[code].dur + svc[code].clean, x, y)) errors.push(`Trùng KTV ${k} ${a.w} ${t}`)
      list.push([s0, s0 + svc[code].dur + svc[code].clean])
      seen.set(key, list)
    }
  }
}
// Hủy, không đến vẫn chiếm chỗ trong mô phỏng nên lịch khác không chen vào: chấp nhận được (chỗ trống thật).
if (errors.length) {
  console.error(errors.slice(0, 20).join('\n'))
  process.exit(1)
}

// ───────────────────────────── Ngày tạo khách (trước lịch đầu tiên dù nạp vào thứ mấy, 06 §5.2)
const firstDay = new Map()
for (const a of appointments) firstDay.set(a.c, Math.min(firstDay.get(a.c) ?? 1e9, dayIndex(a.w[0], a.w[1])))
for (const p of packageSales) if (p.w) firstDay.set(p.c, Math.min(firstDay.get(p.c) ?? 1e9, dayIndex(p.w[0], p.w[1])))
for (const c of customers) {
  if (c.cr !== undefined) continue
  if (NEW_TODAY.includes(c.code)) c.cr = 0
  else if (firstDay.has(c.code)) c.cr = firstDay.get(c.code) - 7 - int(0, 40)
  else c.cr = -int(5, 300)
}

// ───────────────────────────── Ghi file
appointments.sort((a, b) => dayIndex(...a.w) - dayIndex(...b.w) || a.ln[0][2].localeCompare(b.ln[0][2]))
const allAppointments = [...appointments, ...fixtures].map((a, i) => ({ id: `A${String(i + 1).padStart(4, '0')}`, ...a }))
packageSales.sort((a, b) => (a.d ?? dayIndex(...a.w)) - (b.d ?? dayIndex(...b.w)))
packageSales.forEach((p, i) => (p.id = `P${String(i + 1).padStart(3, '0')}`))

const out = {
  $comment:
    'Sinh bằng FE/scripts/generate-demo-data.mjs (pnpm seed:generate), không sửa tay. Cấu trúc, cách suy ra trường: docs/06-THIET-KE-CSDL.md §5.',
  serviceGroups,
  services,
  packageTemplates,
  staff,
  daysOff,
  customers,
  packageSales,
  appointments: allAppointments,
  reserve,
}
const lines = ['{']
const keys = Object.keys(out)
keys.forEach((k, ki) => {
  const v = out[k]
  const comma = ki < keys.length - 1 ? ',' : ''
  if (Array.isArray(v)) {
    lines.push(`  ${JSON.stringify(k)}: [`)
    v.forEach((item, i) => lines.push(`    ${JSON.stringify(item)}${i < v.length - 1 ? ',' : ''}`))
    lines.push(`  ]${comma}`)
  } else lines.push(`  ${JSON.stringify(k)}: ${JSON.stringify(v)}${comma}`)
})
lines.push('}')
writeFileSync(OUT, lines.join('\n') + '\n', 'utf8')

const count = (pred) => allAppointments.filter(pred).length
console.log(
  [
    `Dịch vụ ${services.length}, gói mẫu ${packageTemplates.length}, nhân viên ${staff.length}, khách ${customers.length}`,
    `Lịch hẹn ${allAppointments.length} (sinh ${appointments.length}, kịch bản ${fixtures.length}); dòng ${allAppointments.reduce((s, a) => s + a.ln.length, 0)}`,
    `Kết cục: done ${count((a) => a.o === 'done')}, noshow ${count((a) => a.o === 'noshow')}, cancel ${count((a) => a.o === 'cancel')}, pending ${count((a) => a.o === 'pending')}`,
    `Bán gói riêng ${packageSales.length}, bán kèm ${count((a) => a.pay?.sell)}`,
    `Ghi ${OUT.pathname}`,
  ].join('\n')
)
