# Hẹn Giờ Rảnh (`chillwithme`)

Ứng dụng web giúp bạn bè hẹn lịch đi chơi, chọn giờ rảnh, đề xuất địa điểm / lộ trình nhiều chặng và chốt kèo nhanh chóng — tối ưu cho điện thoại (Zalo/Messenger WebView), múi giờ chuẩn Việt Nam `Asia/Ho_Chi_Minh` (`UTC+7`).

## Tính năng chính

- **Tạo phòng nhanh:** Đăng ký/đăng nhập bằng Gmail + Mật khẩu + Cloudflare Turnstile (không cần xác nhận email).
- **2 chế độ ngày linh hoạt:** Chọn tối đa 14 ngày cụ thể trên lịch hoặc chọn **"Không cần chọn ngày"** (khung Thứ 2 – Chủ nhật).
- **Người tham gia không cần tài khoản:** Nhập mã `#K7M2QX` hoặc mở link, nhập tên và chọn giờ (hỗ trợ kéo vuốt trên mobile + chọn nhanh **Sáng / Chiều / Tối**). Nếu đã đăng nhập tài khoản, tiến độ được đồng bộ xuyên suốt giữa các thiết bị.
- **Kết quả & Lưới nhiệt (Heatmap):** Gợi ý Top 3 khung giờ nhiều người rảnh nhất, chạm vào từng ô để xem **Ai rảnh / Ai bận**.
- **Đề xuất & Bình chọn địa điểm / Lộ trình:**
  - Gợi ý địa chỉ tự động khi gõ (OpenStreetMap Photon API).
  - Mở Google Maps để lấy link chia sẻ, tự lấy ảnh minh họa từ link hoặc tải ảnh nén WebP.
  - Chế độ **Lộ trình kéo-thả** nhiều chặng (`📸 Check-in`, `🍜 Ăn uống`, `☕ Cà phê`, `🎤 Giải trí`) kèm nút mở toàn bộ tuyến đường trên Google Maps theo tọa độ chính xác.
- **Chốt lịch & Chia sẻ:** Hiệu ứng pháo giấy khi chốt, nút **Thêm vào Google Calendar**, chia sẻ nhanh qua **Zalo / Messenger**, và **Hồ sơ người dùng (`/profile`)**.
- **Giao diện Dark Mode mặc định** (có nút chuyển Sáng/Tối).

## Công nghệ sử dụng

- **Framework:** Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- **UI & Animation:** `motion/react`, `canvas-confetti`, `swr`, `zod`
- **Backend & Bảo mật:** Supabase (Auth + PostgreSQL RLS + Storage `place-photos`), Cloudflare Turnstile, Upstash Redis Ratelimit

## Chạy thử local (`AUTH_MODE=dev`)

1. Cài đặt dependencies:
   ```bash
   npm install
   ```
2. Tạo file `.env.local` (mặc định đã bật `AUTH_MODE=dev` dùng `data/db.json`, không cần Supabase/Turnstile):
   ```env
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   AUTH_MODE=dev
   ```
3. Khởi chạy server dev:
   ```bash
   npm run dev
   ```
4. Chạy kiểm tra chất lượng & E2E:
   ```bash
   npm run lint
   npm run build
   node scripts/verify-e2e.mjs
   ```

## Triển khai Production (Vercel + Supabase)

1. Chạy toàn bộ [supabase/schema.sql](supabase/schema.sql) trong **Supabase SQL Editor**.
2. Trong **Supabase → Authentication → Providers → Email**: bật Email và **tắt Confirm email**.
3. Trong **Supabase → Authentication → Bot and Abuse Protection**: bật **Turnstile** và dán Secret Key.
4. Trong **Supabase → Storage**: tạo bucket **`place-photos`** ở chế độ **Public**.
5. Khai báo biến môi trường trên Vercel theo [.env.example](.env.example) (không đặt `AUTH_MODE=dev`).
