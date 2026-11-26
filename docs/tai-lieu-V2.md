# Hẹn Giờ Rảnh — Tài liệu hoàn chỉnh (V2 - Next.js)

Website để hẹn bạn bè: ai cũng có thể tạo sự kiện (đăng ký nhanh bằng Gmail + mật khẩu để lưu lại), mỗi sự kiện là một "phòng" có mã dạng `#K7M2QX`. Người khác nhập mã hoặc mở link để chọn giờ rảnh trên lịch và bình chọn địa điểm bằng link Google Maps, không cần tài khoản. Giao diện tiếng Việt, hiện đại, hiệu ứng có chủ đích, tối ưu cho điện thoại (đặc biệt khi mở từ Zalo/Messenger).

---

## 1. Mục tiêu và nguyên tắc

| Nguyên tắc                             | Ý nghĩa                                                                                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Người tham gia không cần tài khoản | Bạn bè nhập mã phòng hoặc mở link, nhập tên, chọn giờ. Không đăng ký, không đăng nhập.                              |
| Đăng ký nhanh cho người tạo        | Người tạo đăng ký bằng Gmail + Mật khẩu + Nhập lại mật khẩu + Captcha (tắt xác nhận email để vào tạo phòng ngay). |
| Mỗi sự kiện là một "phòng" có mã | Mã dạng `#K7M2QX`. Người khác chỉ cần nhập đúng mã, không bắt buộc có link.                                           |
| Hai mức riêng tư thực dụng          | **Ai có mã hoặc link** (mặc định) và **Riêng tư** (cần link mời hoặc chủ duyệt).                             |
| Mobile & WebView trước                 | Phần lớn link được mở từ Zalo/Messenger trên điện thoại; có cảnh báo WebView và thao tác vuốt/chọn nhanh theo buổi. |
| Múi giờ chuẩn Việt Nam               | Toàn bộ logic ngày/giờ và Google Calendar quy ước cố định theo `Asia/Ho_Chi_Minh` (`UTC+7`).                             |
| Không phụ thuộc thư viện bản đồ  | Địa điểm chỉ là link Google Maps đã xác thực, không nhúng SDK bản đồ nặng máy.                                        |

**Vai trò:**

| Vai trò         | Là ai                                                                                                                 | Cần đăng nhập? |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Chủ sự kiện   | Người tạo sự kiện. Quản lý cài đặt, duyệt thành viên phòng riêng tư, đổi mã phòng, xóa sự kiện. | Có                |
| Người tham gia | Bất kỳ ai vào phòng: chọn giờ, đề xuất quán, bình chọn và chốt lịch (nếu phòng cho phép).            | Không             |

---

## 2. Tính năng

### Bản đầu (MVP - V2 Tinh gọn & Nổi bật)

1. **Đăng ký & Đăng nhập nhanh (`/login`):** Bằng Gmail + Mật khẩu + Nhập lại mật khẩu + Cloudflare Turnstile Captcha. Đăng ký xong vào thẳng trang tạo sự kiện. Trang chủ đồng bộ "Sự kiện của tôi".
2. **Tạo sự kiện (`/new`):** Tên, ghi chú, chọn các ngày trên lịch tháng (tối đa 14 ngày), khoảng giờ, **kiểu truy cập** (`link` hoặc `private`) và **ai được chốt** (`owner_only` hoặc `any_member`). Hệ thống sinh **mã phòng** `#XXXXXX`.
3. **Thẻ Vé Sự Kiện (Digital Ticket Card):** Sau khi tạo phòng, hiển thị thẻ vé mời có mã phòng lớn, hiệu ứng nghiêng nhẹ, nút sao chép mã/link và chia sẻ (Web Share API).
4. **Ảnh xem trước động (Open Graph Image):** Tự sinh ảnh preview đẹp mắt (Tên sự kiện + Số ngày + Mã `#XXXXXX`) khi dán link vào Zalo hoặc Messenger.
5. **Vào phòng bằng mã hoặc link:** Ô "Nhập mã phòng" nổi bật ở trang chủ hoặc mở `/e/K7M2QX`. Có banner nhắc mở bằng Safari/Chrome nếu phát hiện mở trong WebView Zalo/Messenger.
6. **Người tham gia nhập tên lần đầu:** Không cần tài khoản; tự động sinh Avatar 2 chữ cái với màu pastel cố định theo tên.
7. **Chọn giờ rảnh trên lưới ngày × giờ:** Chạm, kéo vuốt (có rung phản hồi nhẹ trên mobile) hoặc bấm nút chọn nhanh theo buổi (**Sáng / Chiều / Tối**).
8. **Kết quả & Lưới nhiệt (Heatmap):** Lưới giờ tô màu theo số người rảnh, Top 3 khung giờ tốt nhất. Chạm vào ô bất kỳ để xem ngay danh sách Avatar **ai rảnh / ai bận**.
9. **Đề xuất & Bình chọn địa điểm:** Dán link Google Maps, mọi người bình chọn (cập nhật tức thì với Optimistic UI).
10. **Chốt giờ và quán:** Theo quyền đã chọn, kèm hiệu ứng pháo giấy ăn mừng nhẹ, khung "Đã chốt" và nút **Thêm vào Google Calendar**.
11. **Phòng riêng tư:** Link mời có token `?i=...` vào thẳng, hoặc màn "Xin vào phòng" để chủ sự kiện duyệt.
12. **Giao diện tiếng Việt, Sáng & Tối (Dark Mode).**

### Bản 2 (Mở rộng sau khi ra mắt)

- Sửa sự kiện sau khi tạo (thêm/bớt ngày, đổi giờ).
- Xuất file lịch `.ics`.
- Mã khôi phục 6 số cho người tham gia khi đổi điện thoại hoặc mất `localStorage`.
- Nhắc nhở trước giờ hẹn qua email.

### Bản 3 (Nâng cao)

- Lịch rảnh cá nhân mặc định theo tuần để điền nhanh vào mọi sự kiện.
- Trang đặt lịch cá nhân `/u/ten-ban` kiểu Calendly.
- Nhóm bạn cố định, mời nhanh & lịch lặp lại hàng tuần.

---

## 3. Luồng người dùng và phân quyền

### 3.1 Luồng chính

```
Chủ sự kiện (Gmail + Mật khẩu)         Người tham gia (Không cần tài khoản)
------------------------------         ------------------------------------
Đăng ký nhanh (Gmail + Pass + Captcha)
  -> Tạo sự kiện
  -> Chọn kiểu truy cập + quyền chốt
  -> Nhận Thẻ Vé #K7M2QX
  -> Gửi link/mã qua Zalo        --->  Mở link  hoặc  Nhập mã ở trang chủ
                                        -> Nhập tên (tạo Avatar tự động)
                                        -> Chọn giờ (vuốt / chọn theo buổi) -> Lưu
                                        -> Đề xuất quán, bình chọn
Xem tab Kết quả (cập nhật tự động)
  -> Chốt giờ & quán (hoặc bất kỳ ai nếu bật any_member)
  -> Pháo giấy ăn mừng -> Thêm vào Google Calendar
```

**Cách nhận diện người tham gia không tài khoản:**

- Lần đầu nhập tên, server tạo bản ghi `participants` và trả về **token bí mật** (chuỗi ngẫu nhiên). Trình duyệt lưu trong `localStorage` theo từng mã phòng.
- Mọi request lưu giờ, thêm quán, bình chọn gửi kèm header `x-participant-token`. Server chỉ lưu bản băm `sha256` của token.
- Nhờ vậy mỗi người chỉ sửa được phần của chính mình.

### 3.2 Hai kiểu truy cập

| Kiểu                                                   | Ai xem và tham gia được                          | Cách vào                                                                                                                                                  | SEO                   |
| ------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **Ai có mã hoặc link** (`link`, mặc định) | Bất kỳ ai biết mã phòng hoặc có đường dẫn | Nhập mã `#XXXXXX` ở trang chủ hoặc mở `/e/K7M2QX`                                                                                                 | Gắn thẻ `noindex` |
| **Riêng tư** (`private`)                      | Chỉ người được chủ mời hoặc duyệt          | Link mời kèm `?i=<inviteToken>` vào thẳng. Nếu chỉ nhập mã sẽ thấy màn "Phòng riêng tư" và bấm **Xin vào phòng** chờ chủ duyệt | Gắn thẻ `noindex` |

Với phòng riêng tư, người chưa được duyệt không nhận được bất kỳ dữ liệu nào của sự kiện (kể cả tên). API chỉ trả `{ "private": true }`.

### 3.3 Phân quyền

| Hành động                                        | Chủ sự kiện | Người tham gia                               |
| --------------------------------------------------- | -------------- | ---------------------------------------------- |
| Xem sự kiện (theo kiểu truy cập)                | ✓             | ✓                                             |
| Chọn giờ, đề xuất quán, bình chọn           | ✓             | ✓                                             |
| Xóa quán do chính mình đề xuất               | ✓             | ✓                                             |
| **Chốt hoặc bỏ chốt giờ và quán**      | ✓             | ✓ chỉ khi `finalize_policy = 'any_member'` |
| Duyệt/từ chối xin vào phòng riêng tư         | ✓             | ✗                                             |
| Gỡ người tham gia, xóa quán của người khác | ✓             | ✗                                             |
| Sửa cài đặt, đổi mã phòng, xóa sự kiện   | ✓             | ✗                                             |

**Cài đặt quyền chốt (`finalize_policy`):**

- `owner_only`: Chỉ chủ sự kiện được bấm Chốt.
- `any_member` (mặc định): Bất kỳ thành viên nào trong phòng cũng bấm Chốt được (tiện khi nhóm đã bàn xong trong nhóm chat và ai rảnh tay thì chốt).

**Chống chốt nhầm:** Hộp thoại xác nhận *"Nhóm đã thống nhất lựa chọn này chưa?"* trước khi chốt; khung "Đã chốt" ghi rõ tên người chốt và thời gian; chủ sự kiện luôn có quyền **Bỏ chốt** hoặc chuyển quyền về `owner_only` bất cứ lúc nào.

### 3.4 Mã phòng

- Định dạng hiển thị `#K7M2QX` (lưu DB dạng `K7M2QX` không có `#`).
- Bảng 31 ký tự loại bỏ ký tự dễ nhầm (`0`, `O`, `1`, `I`, `L`): `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (~887 triệu tổ hợp).
- Chuẩn hóa input: tự động viết hoa, xóa dấu `#`, dấu cách và dấu gạch ngang.
- Nếu lộ mã, chủ bấm **Đổi mã phòng** để sinh mã mới (mã cũ lập tức vô hiệu).

```ts
// lib/room-code.ts
import { randomInt } from 'node:crypto';

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function newRoomCode(len = 6): string {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}
export const normalizeCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const isValidCode = (c: string) => /^[2-9A-HJ-KM-NP-Z]{6,8}$/.test(c);
export const showCode = (c: string) => '#' + c;
```

---

## 4. Công nghệ & Kiến trúc

| Thành phần        | Công nghệ lựa chọn                               | Lý do                                                                           |
| ------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| Framework           | Next.js (App Router) + TypeScript                    | Fullstack trong một repo, hỗ trợ `ImageResponse` tạo ảnh OG động.       |
| Styling             | Tailwind CSS                                         | Thiết kế nhanh với CSS variables cho Sáng/Tối và Heatmap.                  |
| Animation           | Motion (`motion/react`) + `canvas-confetti`      | Hiệu ứng mượt mà, hỗ trợ `reducedMotion="user"`, pháo giấy khi chốt. |
| Data Fetching       | SWR                                                  | Tự làm mới mỗi 5s kết hợp Optimistic Update khi bình chọn/lưu giờ.     |
| Validation          | `zod`                                              | Kiểm tra chặt chẽ dữ liệu ở cả Client lẫn API Route.                     |
| Auth (Người tạo) | Supabase Auth (Email + Password)                     | Tắt Confirm Email để đăng ký xong dùng ngay.                              |
| Captcha             | Cloudflare Turnstile (`@marsidev/react-turnstile`) | Tích hợp trực tiếp với Supabase Auth, chống bot đăng ký hàng loạt.    |
| Database            | Supabase (PostgreSQL)                                | Gói miễn phí 500MB, bật RLS toàn bộ bảng.                                 |
| Rate Limit          | Upstash Ratelimit (Redis)                            | Chặn dò mã phòng và spam tạo sự kiện.                                    |
| Fonts               | `Bricolage Grotesque` & `Be Vietnam Pro`         | Hỗ trợ dấu tiếng Việt chuẩn, hiện đại.                                  |

**Luồng bảo mật kiến trúc:**

- Trình duyệt chỉ giao tiếp trực tiếp với Supabase Auth để đăng ký/đăng nhập (dùng khóa `anon`).
- Mọi thao tác đọc/ghi dữ liệu phòng đều đi qua `/api/...` của Next.js sử dụng `SUPABASE_SERVICE_ROLE_KEY`.
- Toàn bộ bảng trong Postgres bật RLS và **không tạo policy công khai**, ngăn chặn truy cập trực tiếp từ trình duyệt.

---

## 5. Cấu trúc thư mục

```
hen-gio-ranh/
├─ app/
│  ├─ layout.tsx                     # Font, Background, MotionConfig, Toast
│  ├─ globals.css                    # CSS tokens (Sáng/Tối), heatmap styles
│  ├─ page.tsx                       # Trang chủ: Nhập mã phòng + Sự kiện của tôi
│  ├─ login/page.tsx                 # Đăng nhập & Đăng ký nhanh (Gmail + Pass + Turnstile)
│  ├─ new/page.tsx                   # Tạo sự kiện mới (cần đăng nhập)
│  ├─ e/[code]/page.tsx              # Trang phòng chính
│  ├─ e/[code]/opengraph-image.tsx   # Ảnh preview động khi share Zalo/Messenger
│  └─ api/
│     ├─ events/route.ts                    # POST tạo sự kiện, GET danh sách của tôi
│     └─ rooms/[code]/
│        ├─ route.ts                        # GET dữ liệu phòng, PATCH cài đặt, DELETE xóa
│        ├─ join/route.ts                   # POST vào phòng / xin vào phòng riêng tư
│        ├─ response/route.ts               # PUT cập nhật giờ rảnh của bản thân
│        ├─ places/route.ts                 # POST thêm quán, DELETE xóa quán
│        ├─ votes/route.ts                  # POST bật/tắt bình chọn quán
│        ├─ finalize/route.ts               # POST chốt, DELETE bỏ chốt
│        ├─ members/[id]/route.ts           # PATCH duyệt/từ chối/gỡ thành viên
│        └─ rotate-code/route.ts            # POST đổi mã phòng mới
├─ components/
│  ├─ Background.tsx                 # Nền gradient blob trôi chậm
│  ├─ WebViewBanner.tsx              # Nhắc mở Safari/Chrome nếu đang ở trong Zalo/Messenger
│  ├─ Header.tsx
│  ├─ JoinBox.tsx                    # Ô nhập mã phòng ở trang chủ
│  ├─ TicketCard.tsx                 # Thẻ vé mời kỹ thuật số sau khi tạo phòng
│  ├─ RoomCodeChip.tsx               # Chip "#K7M2QX" bấm copy nhanh
│  ├─ UserAvatar.tsx                 # Avatar tròn 2 chữ cái đầu + màu pastel theo tên
│  ├─ AvailabilityGrid.tsx           # Lưới chọn giờ (chạm, kéo vuốt, chọn nhanh Sáng/Chiều/Tối)
│  ├─ ResultsPanel.tsx               # Top 3 gợi ý, Lưới nhiệt, chi tiết Ai rảnh / Ai bận
│  ├─ PlacesPanel.tsx                # Danh sách quán, bình chọn Optimistic UI
│  ├─ AddPlaceSheet.tsx              # Form 3 bước thêm link Google Maps
│  ├─ NameSheet.tsx                  # Nhập tên lần đầu / Xin vào phòng riêng tư
│  ├─ PrivateRoomGate.tsx            # Màn hình chờ duyệt phòng riêng tư
│  ├─ ManageSheet.tsx                # Cài đặt phòng, link mời, đổi mã, duyệt thành viên
│  ├─ Tabs.tsx                       # Thanh tab có nền trượt layoutId
│  ├─ FinalBanner.tsx                # Khung "Đã chốt" + nút Google Calendar
│  ├─ SaveBar.tsx                    # Thanh lưu cố định phía dưới khi có thay đổi
│  └─ Toast.tsx
├─ lib/
│  ├─ types.ts
│  ├─ timezone.ts                    # Quy ước chuẩn Asia/Ho_Chi_Minh (UTC+7)
│  ├─ dates.ts                       # Định dạng ngày tiếng Việt, chia buổi Sáng/Chiều/Tối
│  ├─ suggest.ts                     # Thuật toán tìm Top 3 khung giờ trùng nhiều nhất
│  ├─ maps.ts                        # Kiểm tra & chuẩn hóa link Google Maps
│  ├─ gcal.ts                        # Tạo URL thêm vào Google Calendar
│  ├─ room-code.ts                   # Sinh & chuẩn hóa mã phòng
│  ├─ permissions.ts                 # Nguồn sự thật duy nhất về phân quyền
│  ├─ validation.ts                  # Toàn bộ schema zod (bao gồm Auth & Room)
│  ├─ auth.ts                        # Xác thực JWT chủ phòng & băm SHA-256 token người tham gia
│  ├─ ratelimit.ts                   # Giới hạn tần suất Upstash Redis
│  ├─ participant-token.ts           # Quản lý token trong localStorage
│  ├─ motion.ts                      # Variants chuyển động dùng chung
│  └─ store/
│     ├─ index.ts                    # Tự chọn Supabase hoặc File adapter theo env
│     ├─ supabase.ts
│     └─ file.ts                     # Lưu data/db.json để chạy thử local
├─ supabase/schema.sql
├─ .env.example
└─ package.json
```

---

## 6. Mô hình dữ liệu (`supabase/schema.sql`)

```sql
create table events (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique
                   check (code ~ '^[2-9A-HJ-KM-NP-Z]{6,8}$'),
  owner_id         uuid not null references auth.users(id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 80),
  note             text not null default '' check (char_length(note) <= 300),
  dates            date[] not null,                              -- tối đa 14 ngày
  hour_from        smallint not null check (hour_from between 0 and 23),
  hour_to          smallint not null check (hour_to between 1 and 24),
  visibility       text not null default 'link'
                   check (visibility in ('link', 'private')),
  finalize_policy  text not null default 'any_member'
                   check (finalize_policy in ('owner_only', 'any_member')),
  invite_token     text not null,
  final_date       date,
  final_from       smallint,
  final_to         smallint,
  final_place      uuid,
  finalized_by     text,                                         -- tên người chốt tại thời điểm chốt
  finalized_at     timestamptz,
  created_at       timestamptz not null default now(),
  check (hour_from < hour_to)
);

create table participants (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  token_hash  text not null,
  name        text not null check (char_length(name) between 1 and 40),
  status      text not null default 'approved' check (status in ('pending', 'approved', 'removed')),
  created_at  timestamptz not null default now(),
  unique (event_id, token_hash)
);

create table responses (
  event_id        uuid not null references events(id) on delete cascade,
  participant_id  uuid not null references participants(id) on delete cascade,
  slots           text[] not null default '{}',                  -- 'YYYY-MM-DDTHH' (UTC+7)
  updated_at      timestamptz not null default now(),
  primary key (event_id, participant_id)
);

create table places (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  participant_id  uuid not null references participants(id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 80),
  addr            text not null default '' check (char_length(addr) <= 160),
  link            text not null default '' check (char_length(link) <= 300),
  created_at      timestamptz not null default now()
);

create table votes (
  place_id        uuid not null references places(id) on delete cascade,
  participant_id  uuid not null references participants(id) on delete cascade,
  primary key (place_id, participant_id)
);

alter table events add foreign key (final_place) references places(id) on delete set null;

-- Bật RLS và không tạo policy: chỉ service_role ở server mới truy cập được
alter table events       enable row level security;
alter table participants enable row level security;
alter table responses    enable row level security;
alter table places       enable row level security;
alter table votes        enable row level security;

create index on events (owner_id);
create index on participants (event_id);
create index on responses (event_id);
create index on places (event_id);
```

---

## 7. API & Validation

### Danh sách Endpoints

| Phương thức | Đường dẫn                         | Ai gọi                       | Nội dung                                                                                 |
| -------------- | ------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------- |
| `POST`       | `/api/events`                       | Người đã đăng nhập     | `{title, note, dates, from, to, visibility, finalizePolicy}` → `{code, inviteToken}` |
| `GET`        | `/api/events`                       | Người đã đăng nhập     | Danh sách sự kiện đã tạo của tài khoản                                           |
| `GET`        | `/api/rooms/[code]`                 | Mọi người (theo quyền)    | Trả `RoomBundle`. Phòng `private` chưa duyệt trả `403 {private: true}`         |
| `POST`       | `/api/rooms/[code]/join`            | Mọi người                  | `{name, i?}` → `{participantToken, status}`                                          |
| `PATCH`      | `/api/rooms/[code]`                 | Chủ phòng                   | Sửa tên, ghi chú, kiểu truy cập, quyền chốt                                        |
| `DELETE`     | `/api/rooms/[code]`                 | Chủ phòng                   | Xóa sự kiện                                                                            |
| `POST`       | `/api/rooms/[code]/rotate-code`     | Chủ phòng                   | Sinh mã phòng mới (và tùy chọn đổi `inviteToken`)                               |
| `PUT`        | `/api/rooms/[code]/response`        | Người tham gia              | `{slots}` ghi đè danh sách giờ rảnh                                                |
| `POST`       | `/api/rooms/[code]/places`          | Người tham gia              | `{name, addr, link}` đề xuất địa điểm                                            |
| `DELETE`     | `/api/rooms/[code]/places?placeId=` | Người đề xuất hoặc Chủ | Xóa địa điểm                                                                         |
| `POST`       | `/api/rooms/[code]/votes`           | Người tham gia              | `{placeId, on}` bình chọn / bỏ bình chọn                                           |
| `POST`       | `/api/rooms/[code]/finalize`        | Người có quyền chốt      | `{date, from, to, placeId?}` chốt lịch                                                |
| `DELETE`     | `/api/rooms/[code]/finalize`        | Người có quyền chốt      | Bỏ chốt                                                                                 |
| `PATCH`      | `/api/rooms/[code]/members/[id]`    | Chủ phòng                   | `{status: 'approved'                                                                      |

### Validation Đăng ký & Đăng nhập (`lib/validation.ts`)

```ts
import { z } from 'zod';

export const registerSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Email không đúng định dạng')
      .refine((val) => val.endsWith('@gmail.com'), {
        message: 'Vui lòng sử dụng địa chỉ @gmail.com',
      }),
    password: z
      .string()
      .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
      .max(72, 'Mật khẩu tối đa 72 ký tự'),
    confirmPassword: z.string(),
    captchaToken: z.string().min(1, 'Vui lòng xác nhận bạn không phải robot'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu nhập lại không khớp',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email không đúng định dạng'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
  captchaToken: z.string().min(1, 'Vui lòng xác nhận Captcha'),
});
```

---

## 8. Bảo mật & Múi giờ

- **Xác thực & Chống bot:** Đăng ký/đăng nhập dùng Cloudflare Turnstile token gửi thẳng lên `supabase.auth.signUp()` / `signInWithPassword()`. Tự động gọi `turnstile.reset()` khi submit lỗi vì token chỉ dùng 1 lần.
- **Tắt Confirm Email:** Trên Supabase Dashboard (**Authentication → Providers → Email**), tắt *Confirm email* để người dùng đăng ký xong có phiên làm việc ngay lập tức.
- **Bảo vệ API:** Giới hạn tần suất qua Upstash Redis (30 req/phút cho tra cứu phòng, 10 req/phút cho join phòng, tối đa 50 sự kiện/tài khoản).
- **Quy ước Múi giờ (`lib/timezone.ts`):** Mọi kiểm tra "ngày không ở quá khứ" khi tạo sự kiện và hàm tạo link Google Calendar đều tính theo `Asia/Ho_Chi_Minh` (`UTC+7`), tránh lệch ngày khi server Vercel chạy giờ UTC.
- **Chống XSS & Link độc hại:** Chỉ chấp nhận link `https://` thuộc `google.com/maps`, `maps.app.goo.gl`, `goo.gl/maps`.

---

## 9. Thiết kế giao diện & Trải nghiệm (UI/UX)

### 9.1 Bảng màu & Typography

- **Fonts:** `Bricolage Grotesque` (tiêu đề đậm, cá tính) + `Be Vietnam Pro` (nội dung, số liệu `tabular-nums`).
- **Màu sắc:**
  - Nền sáng `--bg: #F4F7F8`, thẻ kính `--surface: rgba(255, 255, 255, 0.72)` (`backdrop-blur-xl`, bo góc `20px`).
  - Màu chính `--primary: #0FA3A3` (xanh ngọc hiện đại), màu nhấn `--accent: #FF8A5B` (cam đào cho Top gợi ý & nút Chốt).
  - Hỗ trợ đầy đủ **Dark Mode** (`--bg: #0B1419`, `--primary: #3DD0C6`, `--accent: #FF9E78`).
- **Heatmap:** Dùng `color-mix(in srgb, var(--primary) calc(var(--p) * 100%), var(--surface-solid))` để tô đậm nhạt theo tỉ lệ người rảnh.

### 9.2 Các điểm nhấn UX đặc trưng

1. **Màn hình `/login` (Tab Đăng nhập / Đăng ký nhanh):**
   - Dùng thanh Tab trượt (`layoutId="auth-tab"`) để chuyển giữa **Đăng nhập** và **Đăng ký nhanh**.
   - Có nút hiện/ẩn mật khẩu (`👁`) ở cả 2 ô.
   - Báo trạng thái khớp mật khẩu ngay khi gõ (*"✓ Mật khẩu đã khớp"* / *"Mật khẩu chưa khớp"*).
   - Ánh xạ lỗi Supabase sang tiếng Việt thân thiện (*"Gmail này đã được đăng ký..."*, *"Sai Gmail hoặc mật khẩu"*).
2. **Banner cảnh báo WebView (`WebViewBanner.tsx`):**
   - Kiểm tra `navigator.userAgent` nếu chứa `Zalo` hoặc `FBAN`/`FBAV` (Messenger), hiển thị thanh thông báo nhỏ gọn trên đầu trang: *"Bạn đang mở từ Zalo/Messenger. Hãy mở bằng Safari/Chrome để không bị mất lịch đã chọn"* kèm nút **Sao chép link**.
3. **Thẻ Vé Sự Kiện (`TicketCard.tsx`):**
   - Khi tạo sự kiện thành công, hiển thị thẻ vé mời có vết đục lỗ hai bên, mã phòng `#K7M2QX` cỡ lớn, nghiêng nhẹ 3D khi rê chuột/nghiêng máy, nút **Sao chép mã**, **Sao chép link** và **Chia sẻ**.
4. **Lưới chọn giờ tối ưu Mobile (`AvailabilityGrid.tsx`):**
   - Cột giờ dính bên trái (`sticky left-0`), cuộn ngang mượt khi nhiều ngày.
   - Trên đầu mỗi cột ngày có các chip chọn nhanh: **Sáng** (08–12h), **Chiều** (13–17h), **Tối** (18–22h).
   - Khi kéo ngón tay qua vùng ô lưới (`touch-action: none` trên các ô), gọi `navigator.vibrate?.(10)` mỗi khi lướt qua một ô mới để tạo cảm giác xúc giác chân thực.
5. **Soi chi tiết "Ai rảnh / Ai bận" (`ResultsPanel.tsx`):**
   - Chạm vào bất kỳ ô giờ nào trên lưới nhiệt, bên dưới hiện ngay danh sách `UserAvatar` của những người **Rảnh** (sáng màu) và những người **Bận** (làm mờ, gạch ngang tên).
6. **Hiệu ứng ăn mừng khi Chốt lịch:**
   - Bắn pháo giấy `canvas-confetti` tông màu `#0FA3A3` và `#FF8A5B` khi xác nhận chốt lịch, mở ra khung `FinalBanner` kèm nút **Thêm vào Google Calendar**.

---

## 10. Hiệu ứng chuyển động (`lib/motion.ts`)

- Bọc toàn ứng dụng trong `<MotionConfig reducedMotion="user">`.
- Chỉ animate `transform` và `opacity` để đảm bảo 60fps trên điện thoại tầm trung.
- Không gắn `motion.div` cho từng ô trong lưới chọn giờ (chỉ dùng CSS `transition` cho ô đang thao tác); hiệu ứng xuất hiện dần theo đường chéo chỉ dùng cho lưới Kết quả lần tải đầu.

---

## 11. Cài đặt & Triển khai

### 11.1 Khởi tạo dự án

```bash
npx create-next-app@latest chillwithme --typescript --tailwind --app --eslint
cd chillwithme
npm i motion swr zod @supabase/supabase-js @supabase/ssr @upstash/ratelimit @upstash/redis @marsidev/react-turnstile canvas-confetti
npm i -D @types/canvas-confetti
```

### 11.2 Cấu hình Supabase & Cloudflare Turnstile

1. **Cloudflare Turnstile:** Tạo widget trên Cloudflare Dashboard, lấy `Site Key` và `Secret Key`.
2. **Supabase Auth:**
   - Vào **Authentication → Providers → Email**: Bật **Email**, **TẮT (Disable) Confirm email**.
   - Vào **Authentication → Bot and Abuse Protection**: Bật **Captcha protection**, chọn **Turnstile**, dán `Secret Key`.
3. **Database:** Chạy toàn bộ file `supabase/schema.sql` trong **SQL Editor**.

### 11.3 Biến môi trường (`.env.local` & Vercel)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=https://ten-mien-cua-ban.vn
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAA...

UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Chỉ dùng khi dev local chưa nối Supabase (bắt buộc tắt ở production)
# AUTH_MODE=dev
```

---

## 12. Lộ trình triển khai (6 ngày)

| Giai đoạn | Nội dung công việc                                                                                                                                                  | Thời gian |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **1** | Khung dự án, fonts, CSS tokens Sáng/Tối, `timezone.ts` (UTC+7), File adapter (`AUTH_MODE=dev`), Form đăng ký/đăng nhập (Gmail + Mật khẩu + Turnstile). | 1 ngày    |
| **2** | Tạo sự kiện (`/new`), Thẻ vé mời (`TicketCard`), Open Graph Image động, Trang chủ (`JoinBox` + Sự kiện của tôi).                                    | 1 ngày    |
| **3** | Trang phòng (`/e/[code]`), Token người tham gia, `UserAvatar`, `WebViewBanner`, Lưới chọn giờ (kéo vuốt + chọn nhanh Sáng/Chiều/Tối + rung nhẹ).   | 1.5 ngày  |
| **4** | Tab Kết quả (Top 3 gợi ý, Heatmap, chi tiết Ai rảnh/Ai bận), Tab Địa điểm (Google Maps link + Optimistic bình chọn).                                      | 1 ngày    |
| **5** | Chốt lịch (pháo giấy + Google Calendar), Phòng riêng tư (`PrivateRoomGate` + duyệt thành viên), Sheet Quản lý phòng & Đổi mã.                        | 1 ngày    |
| **6** | Kết nối Supabase thật, Upstash Ratelimit, kiểm thử mobile 360px/WebView Zalo, deploy Vercel.                                                                      | 0.5 ngày  |

---

## 13. Prompt giao việc cho AI / Lập trình viên

```text
Hãy xây dựng dự án "Hẹn Giờ Rảnh" đúng theo tài liệu V2.md.
Thực hiện tuần tự theo 6 giai đoạn ở mục 12. Sau mỗi giai đoạn chạy `npm run build` để kiểm tra lỗi TypeScript/Build.
Các yêu cầu cốt lõi bắt buộc:
1. Next.js App Router, TypeScript, Tailwind CSS, Motion (motion/react), SWR, zod, @marsidev/react-turnstile, canvas-confetti.
2. Giao diện tiếng Việt, mobile-first, hỗ trợ Sáng/Tối, tuân thủ bảng màu và font ở mục 9.1.
3. Đăng ký nhanh cho người tạo bằng Gmail (@gmail.com) + Mật khẩu (>= 8 ký tự) + Nhập lại mật khẩu + Cloudflare Turnstile Captcha. Không dùng OAuth và không bắt xác nhận email.
4. Người tham gia không cần tài khoản, định danh bằng token ngẫu nhiên lưu localStorage (server chỉ lưu SHA-256).
5. Toàn bộ ngày/giờ quy ước cố định theo múi giờ Asia/Ho_Chi_Minh (UTC+7).
6. Có WebViewBanner nhắc mở trình duyệt ngoài khi mở từ Zalo/Messenger, TicketCard sau khi tạo phòng, và opengraph-image.tsx động.
7. Lưới chọn giờ có nút chọn nhanh Sáng/Chiều/Tối, hỗ trợ vuốt trên mobile kèm rung phản hồi nhẹ; tab Kết quả cho phép chạm vào ô giờ để xem Avatar ai rảnh / ai bận.
8. Mọi truy vấn dữ liệu đi qua /api/... dùng service_role và kiểm tra quyền qua lib/permissions.ts; RLS bật trên toàn bộ bảng Supabase.
9. Hỗ trợ AUTH_MODE=dev dùng file JSON để chạy thử local khi chưa cấu hình Supabase/Turnstile.
```
