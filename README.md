# Hẹn Giờ Rảnh (`chillwithme`) · `v2.3.0`

Ứng dụng web giúp bạn bè hẹn lịch đi chơi, chọn giờ rảnh, đề xuất địa điểm / lộ trình nhiều chặng, chốt kèo và ghi lại khoảnh khắc **Đang diễn ra (Live)** theo thời gian thực — tối ưu cho điện thoại (Zalo/Messenger WebView), múi giờ chuẩn Việt Nam `Asia/Ho_Chi_Minh` (`UTC+7`).

## Lịch sử phiên bản (Changelog)

- **`v2.3.0` (28/11/2026):**
  - **Bảo mật phiên đăng nhập (`AES-256-GCM` + `HttpOnly`):** chuyển đăng nhập/đăng ký/đăng xuất qua Server Route `/api/auth/session`, mã hóa token trong cookie `cwm_session` (`lib/session-crypto.ts`) thay vì lưu base64 trên trình duyệt.
  - **Tối ưu hiệu năng Auth (`lib/auth-client.tsx`):** dùng `AuthProvider` + `useAuth()` chia sẻ trạng thái đăng nhập toàn app, chỉ fetch `/api/auth/me` đúng 1 lần duy nhất.
  - **Chia sẻ link chuẩn Zalo/Messenger:** bổ sung `app/opengraph-image.tsx` (`1200×630` PNG), `app/apple-icon.tsx` (`180×180` PNG) và `metadataBase` trong `app/layout.tsx`.
- **`v2.2.0` (28/11/2026):**
  - **Hệ thống Theme đóng gói (`lib/themes.ts`):** dễ dàng mở rộng và cho phép người dùng tự đổi giao diện trên Header gồm **Tối mặc định**, **Sáng nhẹ nhàng**, và **T1 Đỏ rực** (nền blur + trang trí 2 bên tách biệt khỏi bố cục chính).
  - **Hiệu ứng Hoa Đào Rơi (`BlossomOverlay.tsx`):** canvas cánh hoa đào rơi nhẹ nhàng toàn trang, có nút **`🌸 Hoa đào / Tắt hoa`** cho từng người dùng và tự tối ưu theo `prefers-reduced-motion`.
  - **Trang chủ mới:** thêm nút **Star ủng hộ** kiểu GitHub (yêu cầu đăng nhập, 1 lượt/tài khoản) kèm **Nhật ký Star minh bạch** bên phải, và **Hướng dẫn dạng Timeline** riêng cho khách vs tài khoản đã đăng nhập.
  - **UX & Validate:** mặc định mở tab **Đăng nhập** khi vào `/login`, và chặn chọn **giờ quá khứ** khi tạo phòng cho ngày hôm nay theo `VN_TZ`.
- **`v2.1.0` (28/11/2026):**
  - **Chế độ Đang diễn ra (Live Mode):** tự bật 30 phút trước giờ hẹn, hỗ trợ **Bắt đầu sớm** và **Kết thúc sự kiện** (hoặc tự đóng sau 24 giờ).
  - **WebSocket Realtime (`WS /ws/rooms/[code]`):** chạy chung port với Next.js (`server.mjs`), tự nối lại + fallback polling khi chạy serverless.
  - **Bảng thành viên & Check-in 1 chạm:** check-in kèm lời nhắn, chụp/đăng tối đa 5 ảnh khoảnh khắc kèm caption & sticker tâm trạng (`🍻 ☕ 🎂 🎤 ✨ 🍜`), tự động xóa EXIF GPS.
  - **Dòng thời gian dọc & Album theo khung giờ:** gộp ảnh đăng liên tiếp, lọc theo thành viên, phân trang theo con trỏ (`/api/rooms/[code]/timeline`), chống giật trang với nút `↑ N mục mới`.
  - **Emoji Reactions & Ghim ảnh:** chạm đúp thả tim `❤️`, thanh 6 emoji (`❤️ 😂 🔥 😮 👏 🎉`) bay mượt bằng CSS `transform`/`opacity` đồng bộ qua WebSocket, huy hiệu `🔥 Hot`, chủ phòng ghim ảnh `📌`, và mục **🏆 Ảnh được yêu thích nhất** trong Album sau kèo.
  - **Auto-join bằng tên hiển thị:** người dùng đã đăng nhập tự động vào phòng không cần nhập lại tên.
- **`v2.0.0`:** Lộ trình nhiều chặng kéo-thả, gợi ý địa chỉ Photon OSM, Google Maps link preview, chia sẻ Zalo/Messenger, hồ sơ người dùng `/profile`, Dark Mode mặc định.
- **`v1.0.0` (MVP):** Tạo phòng, lưới chọn giờ rảnh, Heatmap gợi ý Top 3, bình chọn địa điểm, chốt lịch & Google Calendar.

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
- **Giao diện đa Theme & Hiệu ứng:** hỗ trợ đổi giữa **Tối / Sáng / T1 Đỏ** theo từng người dùng và nút bật/tắt hiệu ứng **Hoa đào rơi (`🌸`)**.

## Công nghệ sử dụng

- **Framework:** Next.js 16 (App Router) + Custom Node Server (`server.mjs` + `ws` WebSocket) + TypeScript + Tailwind CSS v4
- **UI & Animation:** `motion/react`, `canvas-confetti`, `swr`, `zod`, CSS Hardware-Accelerated Emoji Burst
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
   npm run dev:next
   ```
4. Chạy kiểm tra chất lượng & E2E:
   ```bash
   npm run lint
   npm run build
   node scripts/verify-e2e.mjs
   ```

## Triển khai Production

### 1. Chuẩn bị Supabase

1. Nếu tạo DB mới: chạy toàn bộ [supabase/schema.sql](supabase/schema.sql) trong **Supabase SQL Editor**.
   Nếu DB đã có từ trước: chỉ chạy [supabase/migrations/20261127_live_mode.sql](supabase/migrations/20261127_live_mode.sql).
2. Trong **Supabase → Authentication → Providers → Email**: bật Email và **tắt Confirm email**.
3. Trong **Supabase → Authentication → Bot and Abuse Protection**: bật **Turnstile** và dán Secret Key.
4. Trong **Supabase → Storage**: tạo bucket **`place-photos`** ở chế độ **Public**.
5. Đảm bảo **không đặt `AUTH_MODE=dev`** trên môi trường Production.

### 2. Deploy hỗ trợ đầy đủ WebSocket (Khuyên dùng: Docker / VPS / Railway / Render)

- Dùng sẵn [Dockerfile](Dockerfile) hoặc chạy:
  ```bash
  npm run build
  npm start
  ```
- `server.mjs` phục vụ cả Next.js và `WS /ws/rooms/[code]` trên cùng một port (`PORT=3000`).

### 3. Deploy Serverless (Vercel)

- Khai báo biến môi trường theo [.env.example](.env.example).
- Nếu không chạy node WebSocket riêng (`NEXT_PUBLIC_WS_URL`), ứng dụng tự động fallback sang polling `GET /api/rooms/[code]/live`.
