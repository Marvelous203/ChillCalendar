# Kế hoạch chức năng mở rộng (Bản 2 & Bản 3) — Hẹn Giờ Rảnh

Tài liệu này mô tả lộ trình mở rộng sau MVP dựa trên kiến trúc hiện tại (`StoreAdapter`, `lib/permissions.ts`, `lib/timezone.ts`, và API `/api/rooms/[code]/*`).

## Giai đoạn mở rộng 1 — Bản 2 (Sau khi ra mắt MVP)

1. **Sửa ngày/giờ sự kiện sau khi tạo**
   - **Điểm nối:** Mở rộng `updateRoomSchema` (`lib/validation.ts`) và `UpdateEventInput` (`lib/store/types.ts`) để cho phép chủ phòng thêm/bớt `dates` hoặc đổi `hourFrom`/`hourTo`.
   - **Lưu ý dữ liệu:** Khi bớt ngày hoặc thu hẹp khoảng giờ, giữ nguyên các `slots` cũ hoặc lọc sạch khi hiển thị để không mất dữ liệu người đã chọn nếu chủ phòng đổi ý.
2. **Xuất file lịch `.ics` (Apple Calendar / Outlook)**
   - **Điểm nối:** Tạo `lib/ics.ts` dùng chung `VN_TZ = 'Asia/Ho_Chi_Minh'` từ `lib/timezone.ts` và thêm nút **Tải file .ics** cạnh nút Google Calendar trong `components/FinalBanner.tsx`.
3. **Mã khôi phục 6 số cho người tham gia**
   - **Bài toán:** Người tham gia đổi điện thoại hoặc mở lại từ WebView khác bị mất `localStorage`.
   - **Thiết kế:** Khi `POST /api/rooms/[code]/join` thành công, sinh thêm `recovery_code` (băm `sha256` lưu DB, hiển thị 1 lần cho người dùng), kèm endpoint `POST /api/rooms/[code]/recover` (rate-limit chặt 5 lần/phút qua `lib/ratelimit.ts`) để cấp lại `participantToken`.
4. **Nhắc nhở trước giờ hẹn qua Email**
   - **Thiết kế:** Thêm bảng `reminders (event_id, email, remind_at, sent_at)` và cron job (Vercel Cron) quét trước giờ chốt 2 tiếng / 24 tiếng.

## Giai đoạn mở rộng 2 — Bản 3 (Nâng cao)

1. **Lịch rảnh cá nhân mặc định theo tuần**
   - **Thiết kế:** Bảng `weekly_templates (user_id, weekday, hours[])`. Người dùng đăng nhập bấm **Áp dụng lịch rảnh quen thuộc** trên `AvailabilityGrid` để điền nhanh 1 chạm.
2. **Trang đặt lịch cá nhân `/u/[slug]` (kiểu Calendly)**
   - **Thiết kế:** Tận dụng `timezone.ts` và `AvailabilityGrid` ở chế độ chọn 1 slot, sinh phòng 1-1 tự động kèm link Google Meet / Calendar.
3. **Nhóm bạn cố định & Lịch lặp lại hàng tuần**
   - **Thiết kế:** Bảng `groups` + `group_members`, cho phép tạo nhanh phòng mới từ nhóm có sẵn và tự động duyệt thành viên nếu phòng đặt `private`.
