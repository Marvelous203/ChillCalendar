# Đặc tả Tính năng: Đề xuất Địa điểm (Autocomplete & Lộ trình Kéo-Thả)

Tài liệu mô tả kiến trúc, trải nghiệm người dùng (UX), mô hình dữ liệu và mã nguồn mẫu cho hai chế độ đề xuất địa điểm trong dự án **Hẹn Giờ Rảnh**, đảm bảo trải nghiệm mượt mà trên điện thoại với **chi phí vận hành \$0**.

---

## 1. Gợi ý địa chỉ thông minh khi gõ (Chi phí \$0)

Thay vì sử dụng Google Places Autocomplete API trả phí theo lượt gõ, hệ thống tích hợp **OpenStreetMap Photon API (Komoot)** kết hợp kỹ thuật **Debounce 350ms**:

* **Endpoint miễn phí (không cần API Key):**
  ```text
  https://photon.komoot.io/api/?q=<từ_khóa>&lat=10.7769&lon=106.7009&limit=5
  ```
  *(Ưu tiên tọa độ khu vực Việt Nam để kết quả tiếng Việt trả về chính xác số nhà, tên đường, phường/quận).*

* **Luồng hoạt động:**
  1. Người dùng gõ từ khóa (ví dụ: `"Phúc Long Lê Văn Sỹ"`).
  2. Sau `350ms` ngừng gõ, trình duyệt gọi Photon API và hiển thị danh sách tối đa 5 gợi ý kèm tên quán và địa chỉ đầy đủ.
  3. Khi người dùng chọn một gợi ý:
     * Tự động điền **Tên địa điểm** và **Địa chỉ chi tiết**.
     * Tự động tạo **Link Google Maps chuẩn**:
       ```ts
       `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${addr}`)}`
       ```
  4. **Phương án dự phòng (Fallback):** Nếu địa điểm mới chưa có trên bản đồ mở, người dùng vẫn giữ nguyên tên đã nhập và có thể dán trực tiếp link Google Maps hoặc để hệ thống tự sinh link tìm kiếm theo tên.

---

## 2. Thiết kế 2 chế độ đề xuất (`single` & `itinerary`)

Trong tab **Địa điểm**, nút **`+ Đề xuất`** mở ra Sheet gồm **2 tab chuyển đổi (Segmented Control)** ở trên cùng:

### 2.1 Option A: Đề xuất 1 địa điểm lẻ (`single`)
Phù hợp cho kèo đi ăn hoặc đi cà phê đơn lẻ.
* **Ô tìm kiếm Autocomplete:** Gõ tên quán $\rightarrow$ chọn gợi ý $\rightarrow$ tự điền địa chỉ và link Google Maps.
* **Hình ảnh minh họa (Tùy chọn):** Chọn ảnh từ thiết bị (tự nén phía client trước khi upload) hoặc dán trực tiếp URL ảnh.
* **Ghi chú ngắn:** Thông tin bổ sung như chỗ đậu xe, không gian quán, mức giá (tối đa 200 ký tự).

### 2.2 Option B: Đề xuất theo Lộ trình nhiều chặng (`itinerary`)
Phù hợp cho kèo đi chơi nguyên buổi/nguyên ngày (ví dụ: *16:30 Check-in $\rightarrow$ 18:30 Ăn tối $\rightarrow$ 20:30 Cà phê*).

#### Trải nghiệm UX: Kéo-thả trực quan dạng Canva / Visual Timeline
Thay vì nhập form cứng nhắc hoặc nối dây thủ công, giao diện tạo lộ trình chia làm **2 vùng tương tác**:

1. **Khay thẻ chặng (Block Palette) ở phía trên:**
   Gồm 4 thẻ phân loại có màu sắc riêng, chạm để thêm nhanh vào dòng thời gian:
   * 📸 **Check-in** (Dạo chơi, chụp ảnh)
   * 🍜 **Ăn uống** (Bữa chính, ăn vặt)
   * ☕ **Cà phê** (Trà sữa, tráng miệng)
   * 🎤 **Giải trí** (Xem phim, karaoke, boardgame)

2. **Bàn làm việc Lộ trình (Timeline Canvas) ở phía dưới:**
   * **Kéo-thả đổi thứ tự tự do:** Nắm tay cầm **`⋮⋮`** bên trái thẻ để kéo chặng `📸 Check-in` lên trước `🍜 Ăn uống` hoặc đảo vị trí bất kỳ (hỗ trợ mượt mà cả chuột lẫn cảm ứng điện thoại).
   * **Đường nối & đánh số tự động:** Các thẻ tự động nối với nhau bằng đường kẻ dọc đứt nét và cập nhật số thứ tự (`1` $\rightarrow$ `2` $\rightarrow$ `3`) theo thời gian thực mỗi khi thay đổi vị trí.
   * **Chỉnh sửa tại chỗ (Inline Edit) ngay trên từng thẻ:**
     * Chọn **Giờ dự kiến** (ví dụ `17:30`).
     * Nhập **Tên địa điểm** có Autocomplete gợi ý địa chỉ Photon API.
     * Gắn **Ảnh thumbnail** minh họa cho từng chặng.

3. **Hiển thị & Bình chọn:**
   * Trên danh sách địa điểm, lộ trình hiển thị dạng **Timeline Card** trực quan kèm nút **`📍 Maps`** ở từng chặng.
   * Cuối thẻ có nút **`🗺️ Mở toàn bộ lộ trình trên Google Maps`** tự động vẽ tuyến đường chỉ đường đa điểm dừng qua tất cả các chặng.
   * Cả nhóm bình chọn (Vote) hoặc chủ phòng chốt cho **toàn bộ lộ trình**.

---

## 3. Cập nhật Cơ sở dữ liệu & Kiểu dữ liệu

### 3.1 Cập nhật bảng `places` (`supabase/schema.sql`)
Mở rộng bảng `places` hiện có bằng cột `type` và `stops` (`jsonb`) để lưu trữ gọn gàng cả hai chế độ mà không cần tách thêm bảng phụ:

```sql
alter table places
  add column type text not null default 'single'
    check (type in ('single', 'itinerary')),
  add column image_url text not null default ''
    check (char_length(image_url) <= 500),
  add column note text not null default ''
    check (char_length(note) <= 200),
  -- Mảng các chặng khi type = 'itinerary' (tối đa 8 chặng)
  -- Cấu trúc phần tử: { "id": "...", "category": "checkin|food|cafe|play", "time": "18:00", "name": "...", "addr": "...", "link": "...", "imageUrl": "..." }
  add column stops jsonb not null default '[]'::jsonb;
```

### 3.2 Định nghĩa TypeScript (`lib/types.ts`)

```ts
export type PlaceCategory = 'checkin' | 'food' | 'cafe' | 'play';

export interface ItineraryStop {
  id: string;
  category: PlaceCategory;
  time?: string;       // Ví dụ: '17:30'
  name: string;
  addr: string;
  link: string;
  imageUrl?: string;
}

export interface PlaceData {
  id: string;
  participantId: string;
  type: 'single' | 'itinerary';
  // Dùng khi type === 'single'
  name: string;
  addr: string;
  link: string;
  imageUrl?: string;
  note?: string;
  // Dùng khi type === 'itinerary'
  stops?: ItineraryStop[];
}
```

---

## 4. Hàm tạo tuyến đường Google Maps đa điểm (`lib/maps.ts`)

Chuyển đổi danh sách các chặng đã sắp xếp thành đường dẫn chỉ đường nhiều điểm dừng (Multi-stop Directions) trên Google Maps:

```ts
export const searchUrl = (q: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

export function itineraryMapsUrl(stops: Array<{ name: string; addr?: string }>): string {
  const validStops = stops.filter((s) => s.name.trim().length > 0);
  if (validStops.length === 0) return 'https://www.google.com/maps';
  if (validStops.length === 1) {
    return searchUrl(`${validStops[0].name} ${validStops[0].addr ?? ''}`.trim());
  }

  // Google Maps Dir API: /maps/dir/Điểm+1/Điểm+2/Điểm+3
  const waypoints = validStops
    .map((s) => encodeURIComponent(`${s.name} ${s.addr ?? ''}`.trim()))
    .join('/');

  return `https://www.google.com/maps/dir/${waypoints}`;
}
```

---

## 5. Lưu ý tối ưu lưu trữ hình ảnh (Gói Free Supabase)

Để tối ưu hạn mức **1 GB Storage** và **5 GB Egress/tháng** của gói Supabase Free:

1. **Public Bucket:** Tạo bucket `place-photos` ở chế độ công khai (Public) để hiển thị ảnh trực tiếp qua CDN mà không tốn tài nguyên ký URL.
2. **Nén ảnh phía trình duyệt (`lib/image-compress.ts`):** Trước khi gọi API upload, dùng `<canvas>` thu nhỏ ảnh về chiều ngang tối đa **`800px`**, xuất định dạng **`image/webp`** (chất lượng `0.8`). Mỗi ảnh sau nén chỉ nặng khoảng `60KB – 100KB` (lưu trữ được hơn $10{,}000$ ảnh).
3. **Hỗ trợ dán link ảnh ngoài:** Cho phép người dùng dán trực tiếp URL ảnh từ Facebook hoặc Google Maps để không tiêu tốn dung lượng Storage.