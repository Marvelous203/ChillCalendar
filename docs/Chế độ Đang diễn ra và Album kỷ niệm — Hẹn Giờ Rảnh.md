# Chế độ "Đang diễn ra" và Album kỷ niệm — Hẹn Giờ Rảnh

Nov 27, 2026 · @phat

## 1. Tổng quan và mục tiêu

Khi đến giờ kèo, phòng chuyển sang chế độ "Đang diễn ra": ô trên lưới hiện số người thật sự có mặt, mỗi người check-in kèm ảnh và một dòng ghi chú, và sau kèo toàn bộ gom thành một album kỷ niệm riêng tư của nhóm. Giai đoạn đầu chỉ làm **ảnh và chữ**; video để giai đoạn sau.

**Vấn đề cần giải.** MVP hiện dừng ở bước chốt giờ. Người dùng không có lý do quay lại phòng sau khi kèo bắt đầu, và nhóm không có chỗ lưu dấu kỷ niệm. Chế độ mới biến phòng từ công cụ chốt lịch thành nơi ghi lại kèo đã thật sự diễn ra.

**Phạm vi giai đoạn 1**

- Trạng thái `live` tự bật 30 phút trước giờ hẹn, kết thúc khi chủ phòng bấm kết thúc hoặc tự động sau 24 giờ; số người cập nhật ngay qua WebSocket.
- Check-in một chạm, mở mọi lúc trong khi `live`, kèm 1 ảnh (tùy chọn) và ghi chú tối đa 200 ký tự.
- Album xem lại sau kèo, tải về bản zip, tự xóa sau 90 ngày.
- Hộp quà kỷ niệm dạng chữ và ảnh, ẩn đến khi kèo kết thúc.

**Ngoài phạm vi giai đoạn 1:** video, xác thực vị trí GPS, Google Meet / Calendar OAuth, trang đặt lịch `/u/[slug]`.

**Nguyên tắc thiết kế**

- Không thêm bên thứ 3 ngoài một nơi lưu file duy nhất, đặt sau `StorageAdapter` để đổi được.
- Anonymous-first: người tham gia vẫn dùng `participantToken`, không bắt đăng nhập.
- Riêng tư mặc định: ảnh chỉ người trong phòng xem được, không xuất hiện trong bản xem trước link.
- Tái dùng tối đa `AvailabilityGrid`, `lib/permissions.ts`, `lib/ratelimit.ts` và `StoreAdapter` hiện có.

## 2. Vòng đời sự kiện

Phòng đi qua bốn trạng thái `voting → finalized → live → done`, và `live` tự bật 30 phút trước giờ hẹn mà chủ phòng không phải bấm gì.

&#91;embedded content: vòng đời phòng · 4 trạng thái, live nổi bật\]

Cùng một lưới `AvailabilityGrid` được dùng cho cả bốn trạng thái, chỉ đổi ý nghĩa con số trong ô.

**Quy tắc chuyển trạng thái**

- `live_from` = giờ bắt đầu của ô đã chốt trừ 30 phút. **Không có giờ kết thúc cố định.**
- Phòng kết thúc khi chủ phòng bấm **Kết thúc sự kiện**, hoặc tự động 24 giờ sau `live_from`. Hệ thống lưu `ended_at` và `ended_by` (`owner` hoặc `auto`).
- Trong lúc `live`, check-in mở mọi lúc, kể cả khi đã quá giờ dự kiến của kèo.
- Trạng thái được **tính khi đọc** bằng cách so giờ server với `live_from`, `live_from + 24 giờ` và `ended_at`, nên không phụ thuộc cron. Tiến trình WebSocket cũng đặt hẹn giờ để đóng phòng đúng lúc.
- Mọi mốc giờ tính theo `VN_TZ` trong `lib/timezone.ts`, hiển thị cho người xem theo múi giờ của họ.
- Chủ phòng có thêm nút **Bắt đầu sớm**, ghi vào `audit_log`.
- Đổi giờ khi phòng đã `finalized` phải xác nhận lại và cập nhật `live_from`; không đổi giờ được khi phòng đang `live`.
- Khi sang `done`, hệ thống khóa check-in và tải mới, nhưng **toàn bộ dữ liệu được giữ nguyên** (check-in, ghi chú, ảnh, quà) để làm album. Dữ liệu chỉ bị xóa theo thời hạn lưu 90 ngày tính từ `ended_at`.

## 3. Chế độ "Đang diễn ra"

Khi `status = live`, trang phòng đổi giao diện: lưới thu nhỏ lại làm nền, và màn hình chính xoay quanh một câu hỏi duy nhất là "ai đã đến rồi".

| Khối giao diện | Nội dung | Ghi chú |
| --- | --- | --- |
| Ô trên lưới | Số `x/y`: x người đã check-in, y người đã bấm "Đi" | Giai đoạn 1 dùng một con số cho cả kèo |
| Nút lớn | **Tôi đã đến**, kèm ô ảnh và ô ghi chú tùy chọn | Hiện suốt lúc `live`, chỉ với người có `participantToken` |
| Đã đến | Danh sách tên, giờ đến, ghi chú, ảnh thu nhỏ, mới nhất ở trên | Bấm vào ảnh để xem lớn |
| Chưa đến | Tên những người đã hứa đi nhưng chưa check-in | Chỉ là danh sách, không gửi nhắc tự động |
| Dải trạng thái | "Đang diễn ra", thời gian đã diễn ra và giờ tự kết thúc | Giờ tự kết thúc = `live_from` + 24 giờ |
| Nút **Kết thúc sự kiện** | Chỉ chủ phòng thấy, có hộp xác nhận | Ghi `ended_at`, dữ liệu được giữ nguyên |

**Số người trong ô**

- `y` lấy từ RSVP "Đi". Người chưa RSVP mà vẫn check-in thì được tính vào `x`, và `y` tự tăng thêm để tránh hiện `6/5`.
- Check-in lưu `checked_in_at`; cột `left_at` để trống ở giai đoạn 1 và dùng khi cần số người theo từng giờ cho kèo kéo dài.

**Cập nhật thời gian thực bằng WebSocket**

- Vào phòng `live`, trình duyệt mở một kết nối tới `/ws/rooms/[code]`, xác thực bằng `participantToken` ngay lúc bắt tay.
- Khi vừa nối, server gửi ảnh chụp trạng thái hiện tại để người vào muộn thấy đủ. Sau đó server chỉ đẩy các sự kiện nhỏ: `checkin`, `media_added`, `media_removed`, `counts` (số `x/y`) và `ended`.
- Ghi dữ liệu vẫn đi qua REST API (check-in, tải ảnh); API ghi xong thì báo cho server WebSocket phát tới cả phòng. Nhờ vậy kiểm quyền và giới hạn tần suất giữ nguyên một chỗ.
- Mất kết nối thì tự nối lại với thời gian chờ tăng dần, và xin phần đã bỏ lỡ bằng mốc `since`.
- Nếu WebSocket không dùng được (mạng chặn, server lỗi), giao diện tự lùi về hỏi `GET /api/rooms/[code]/live` định kỳ.
- WebSocket cần một máy chủ chạy liên tục, xem mục 6.

## 4. Check-in, ảnh và ghi chú (giai đoạn 1)

Check-in là một chạm; ảnh và ghi chú là phần thêm vào, nên người ngại chụp vẫn check-in được.

**Luồng người dùng**

1. Người tham gia bấm **Tôi đã đến**.
2. Hệ thống ghi check-in ngay, không chờ ảnh.
3. Một bảng nhỏ hiện ra: "Thêm ảnh" và "Thêm ghi chú" (tối đa 200 ký tự). Bỏ qua cũng được.
4. Ảnh và ghi chú gửi lên sau, có thể bổ sung hoặc sửa trong lúc `live`.
5. Người đã check-in xuất hiện ở danh sách "Đã đến" của mọi người.

**Xử lý ảnh ngay trên máy người dùng**

- Chọn ảnh bằng `<input type="file" accept="image/*">`, thêm `capture` khi muốn mở thẳng camera. Chạy được trên iOS và Android, kể cả khi mở từ PWA.
- Vẽ ảnh lên canvas, thu về cạnh dài tối đa 1600 px, xuất WebP (JPEG nếu trình duyệt không hỗ trợ) ở mức khoảng 300 KB.
- Vẽ qua canvas làm mất toàn bộ EXIF, trong đó có tọa độ GPS, nên không lộ nơi người chụp ở.
- Ảnh iPhone định dạng HEIC được trình duyệt giải mã trước khi vẽ; nếu không giải mã được, báo lỗi rõ ràng và gợi ý chụp lại.

**Giới hạn ban đầu**

| Mục | Giới hạn | Lý do |
| --- | --- | --- |
| Ảnh mỗi người mỗi kèo | 5 | Giữ dung lượng và album gọn |
| Dung lượng mỗi ảnh sau nén | 1 MB (cứng, kiểm tra ở server) | Chặn client gửi file lớn |
| Ghi chú | 200 ký tự | Đủ cho một dòng cảm nghĩ |
| Số lượt gửi | Theo `lib/ratelimit.ts`, tính theo từng người tham gia | Tránh lạm dụng |

**Trường hợp lỗi cần xử lý**

- Mất mạng giữa chừng: giữ ảnh trong hàng đợi trên máy (IndexedDB) và tự gửi lại khi có mạng; check-in không bị mất vì đã ghi trước.
- Gửi trùng: ràng buộc duy nhất `(event_id, participant_id)` cho check-in, và khóa chống lặp theo mã tạm cho từng ảnh.
- Chủ phòng kết thúc sự kiện khi đang gửi: cho hoàn tất ảnh đã bắt đầu trong một khoảng ngắn sau `ended_at` (đề xuất 15 phút), sau đó từ chối.

## 5. Album kỷ niệm và Hộp quà

Album gom mọi thứ phát sinh lúc kèo diễn ra, còn Hộp quà là phần lời nhắn được giữ kín cho đến khi kèo kết thúc.

| Thành phần | Khi nào thấy | Ai thấy |
| --- | --- | --- |
| Ảnh và ghi chú check-in | Ngay lúc `live` | Người trong phòng |
| Album xem lại | Từ `done` | Theo `album_visibility` |
| Hộp quà | Nội dung chỉ mở từ `done` | Người nhận do người gửi chọn |

**Album xem lại**

- Lưới ảnh theo thứ tự thời gian, mỗi ảnh kèm tên người đăng và ghi chú; bấm vào để xem lớn và lướt qua ảnh kế tiếp.
- `album_visibility` do chủ phòng chọn: *người đã check-in* (mặc định) hoặc *mọi người trong phòng*.
- Người đăng xóa được ảnh của mình; chủ phòng xóa được mọi ảnh.
- Nút **Tải cả album (.zip)**: server phát luồng zip trực tiếp từ nơi lưu file, không nén lại ảnh, giới hạn vài lần mỗi phút cho mỗi người.
- Hiện dòng "Album sẽ tự xóa vào ngày …" và nhắc tải về trước hạn.

**Hộp quà kỷ niệm**

- Mỗi người để lại một lời nhắn: chữ tối đa 500 ký tự và tối đa 1 ảnh, gửi cho cả nhóm hoặc chỉ cho chủ phòng.
- Nội dung **không được server trả về** trước `done`; ẩn bằng giao diện thôi là chưa đủ vì người dùng có thể xem qua công cụ nhà phát triển. Trước đó, người khác chỉ thấy số lời nhắn đang chờ, ví dụ "4 món quà chưa mở".
- Người gửi sửa hoặc xóa được lời nhắn cho đến khi phòng sang `done`.
- Khi phòng sang `done`, quà mở cùng lúc; giao diện mở từng món một để có cảm giác bóc quà.
- Phù hợp với sinh nhật, họp lớp, tiễn bạn. Hộp quà có thể tắt khi tạo phòng.

## 6. Kiến trúc kỹ thuật

Ảnh đi thẳng từ trình duyệt đến nơi lưu file bằng URL có hạn, còn API Next.js chỉ cấp quyền và ghi bản ghi `media`. Đường tải ảnh này chạy được trên cả Vercel (nơi body request bị giới hạn khoảng 4,5 MB) lẫn VPS riêng; riêng WebSocket cần máy chủ chạy liên tục, xem phần Realtime bên dưới.

&#91;embedded content: luồng tải ảnh · 3 thành phần, 1 đường tải trực tiếp\]

Bước cuối không nằm trên hình: sau khi tải xong, trình duyệt báo lại, API kiểm tra file có thật sự tồn tại, đúng dung lượng và loại file rồi mới ghi `media`. File tải lên mà không được xác nhận sẽ bị dọn sau vài giờ.

**StorageAdapter**

Giống `StoreAdapter` hiện có, mọi thao tác file nằm sau một giao diện, để đổi nơi lưu mà không sửa mã phía trên. Triển khai đầu tiên chỉ chọn một nơi lưu (Cloudflare R2, Supabase Storage hoặc ổ đĩa VPS); việc chọn phụ thuộc nơi host, xem mục 10.

```ts
interface StorageAdapter {
  createUploadUrl(key: string, opts: { mime: string; maxBytes: number; ttlSec: number }): Promise<{ url: string; headers?: Record<string, string> }>;
  head(key: string): Promise<{ bytes: number; mime: string } | null>;
  createReadUrl(key: string, ttlSec: number): Promise<string>;
  stream(key: string): Promise<ReadableStream>; // dùng cho zip
  delete(key: string): Promise<void>;
}
```

**Mô hình dữ liệu**

| Bảng | Cột chính | Ràng buộc |
| --- | --- | --- |
| `events` (thêm cột) | `live_from`, `ended_at`, `ended_by` (`owner` hoặc `auto`), `album_visibility`, `gift_enabled`, `retention_days` (mặc định 90) |  |
| `checkins` | `event_id`, `participant_id`, `checked_in_at`, `left_at`, `note` | duy nhất `(event_id, participant_id)` |
| `media` | `id`, `event_id`, `participant_id`, `kind`, `storage_key`, `mime`, `bytes`, `width`, `height`, `created_at`, `deleted_at` | chỉ mục `(event_id, created_at)` |
| `gifts` | `id`, `event_id`, `author_id`, `body`, `media_id`, `audience`, `updated_at` | duy nhất `(event_id, author_id)` |

Cột `media.kind` mới chỉ nhận `photo`; thêm giá trị `video` ở giai đoạn sau không cần đổi cấu trúc bảng.

**API**

| Method và đường dẫn | Việc làm |
| --- | --- |
| `WS /ws/rooms/[code]` | Kết nối thời gian thực: trạng thái ban đầu, rồi nhận sự kiện check-in, ảnh, số `x/y`, kết thúc |
| `GET /api/rooms/[code]/live` | Ảnh chụp trạng thái hiện tại, dùng khi WebSocket không nối được |
| `POST /api/rooms/[code]/checkin` | Ghi check-in và ghi chú |
| `POST /api/rooms/[code]/end` | Chủ phòng kết thúc sự kiện |
| `POST /api/rooms/[code]/media/upload-url` | Kiểm tra quyền, trả URL ghi có hạn |
| `POST /api/rooms/[code]/media` | Xác nhận file rồi ghi `media` |
| `DELETE /api/rooms/[code]/media/[id]` | Xóa ảnh (người đăng hoặc chủ phòng) |
| `GET /api/rooms/[code]/album` | Danh sách ảnh kèm URL đọc có hạn |
| `GET /api/rooms/[code]/album.zip` | Phát luồng zip của cả album |
| `PUT /api/rooms/[code]/gift` | Tạo hoặc sửa lời nhắn của mình |
| `GET /api/rooms/[code]/gifts` | Trả nội dung chỉ khi `done`, trước đó chỉ trả số lượng |

**Realtime**

- Một tiến trình Node chạy liên tục (thư viện `ws`) giữ các kết nối và đọc cùng cơ sở dữ liệu với API.
- API ghi xong thì báo cho tiến trình này phát sự kiện tới cả phòng. Một máy chủ thì dùng bộ nhớ trong; chỉ khi chạy nhiều máy mới cần Redis pub/sub, chưa cần ở giai đoạn 1.
- Vercel không giữ được kết nối WebSocket, nên cần VPS (hoặc dịch vụ realtime bên thứ 3, trái với nguyên tắc ban đầu). Phần tải ảnh vẫn chạy được ở bất kỳ nơi nào.
- Tiến trình này đặt hẹn giờ tự kết thúc sau 24 giờ cho mỗi phòng `live`, và khi khởi động lại thì quét các phòng `live` để đặt lại hẹn giờ.

## 7. Bảo mật, quyền riêng tư và pháp lý

Ảnh kỷ niệm là dữ liệu riêng của nhóm: file nằm trong kho riêng tư, chỉ xem qua URL có hạn sau khi kiểm tra quyền, và tự xóa sau 90 ngày.

**Ai được làm gì** (mở rộng `lib/permissions.ts`)

| Hành động | Điều kiện |
| --- | --- |
| Kết nối WebSocket | Có `participantToken` hợp lệ của phòng |
| Check-in | Có `participantToken`, phòng đang `live` (mọi lúc cho đến khi kết thúc) |
| Tải ảnh lên | Đã check-in, phòng `live` (cộng khoảng ân hạn ngắn sau `ended_at`) |
| Xem ảnh và album | Theo `album_visibility`: người đã check-in hoặc mọi người trong phòng |
| Tải zip | Người được xem album |
| Xóa ảnh | Người đăng ảnh, hoặc chủ phòng |
| Kết thúc sự kiện | Chỉ chủ phòng |
| Gửi hoặc sửa quà | Có `participantToken`, phòng chưa sang `done` |
| Đọc nội dung quà | Phòng đã `done` và là người nhận |

**Bảo vệ file**

- Kho file để chế độ riêng tư; không có đường dẫn công khai.
- Khóa file do server sinh (`events/{event_id}/{uuid}.webp`), không dùng tên file của người dùng.
- URL tải lên giới hạn `Content-Type` và dung lượng. Khi xác nhận, server đọc vài byte đầu của file để kiểm tra đúng JPEG, PNG hoặc WebP, không tin vào đuôi file. Không nhận SVG.
- URL xem ảnh chỉ được cấp sau khi kiểm tra quyền và hết hạn trong vài phút.
- Bản xem trước link (OG image) tuyệt đối không dùng ảnh kỷ niệm.

**Nội dung xấu**

- Mỗi ảnh có nút **Báo cáo**; chủ phòng nhận thông báo trong phòng và ẩn hoặc xóa được ngay.
- Mọi lần xóa hoặc ẩn của chủ phòng ghi vào `audit_log`.

**Dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP)**

- Ảnh có khuôn mặt là dữ liệu cá nhân. Lần check-in đầu tiên hiện một dòng đồng ý ngắn: ảnh được chia sẻ trong nhóm kèo này và tự xóa sau 90 ngày.
- Người dùng có quyền xóa ảnh của mình bất cứ lúc nào, và có thể rút lại đồng ý bằng cách xóa.
- Tự xóa: một job chạy mỗi ngày quét các phòng có `ended_at + retention_days` đã qua, xóa file trước rồi mới xóa bản ghi. Gói cron miễn phí của Vercel cho chạy một lần mỗi ngày, đủ cho việc này; nếu đã dùng VPS thì chạy bằng cron của hệ thống.
- Mình không phải luật sư; nên có người am hiểu xem lại điều khoản và chính sách quyền riêng tư trước khi mở công khai.

## 8. Lộ trình triển khai

Giai đoạn 1 gồm bốn bước phát hành độc lập, mỗi bước qua một cổng kiểm tra rồi mới sang bước sau; video nằm ngoài giai đoạn 1 và chỉ mở khi đủ điều kiện ở mục 9.

&#91;embedded content: lộ trình · 4 bước giai đoạn 1, 4 cổng, 1 bước sau\]

**Mỗi bước gồm gì**

1. **Live:** cột `live_from`, `ended_at`, trạng thái tính khi đọc, nút Kết thúc sự kiện, bảng `checkins`, máy chủ WebSocket, giao diện live và con số `x/y` trên ô.
2. **Ảnh:** `StorageAdapter`, cặp `upload-url` và `media`, nén và xóa EXIF ở máy, hàng đợi gửi lại, dòng đồng ý dữ liệu.
3. **Album:** trang xem lại, `album_visibility`, xóa và báo cáo ảnh, tải zip, job tự xóa sau 90 ngày.
4. **Hộp quà:** bảng `gifts`, API chỉ trả nội dung khi `done`, giao diện mở quà.

Bước 4 độc lập với bước 3 về mặt kỹ thuật, nên có thể đổi thứ tự nếu bạn muốn có Hộp quà sớm hơn.

## 9. Giai đoạn sau: video ngắn

Video chỉ bắt đầu sau khi giai đoạn 1 chạy ổn, vì phần khó nhất không phải tải lên mà là làm cho video phát được trên mọi máy.

**Ba điều kiện để bắt đầu**

1. Giai đoạn 1 đã chạy thật và người dùng có nhu cầu video rõ ràng (qua phản hồi, không đoán).
2. Đã chốt nơi host và nơi lưu file, và chi phí dung lượng cùng băng thông chấp nhận được.
3. Đã chọn cách xử lý định dạng ở bảng dưới, và thử trên máy thật.

**Giới hạn đề xuất:** 10 đến 15 giây mỗi video, tối đa khoảng 25 MB, tối đa 2 video mỗi người mỗi kèo.

**Vấn đề định dạng.** iPhone quay HEVC (`.mov`), một số trình duyệt trên Android và Windows không phát được. Có ba cách xử lý:

| Cách | Ưu điểm | Nhược điểm | Hợp khi |
| --- | --- | --- | --- |
| Nhận nguyên bản, hiện nút tải nếu không phát được | Rẻ và đơn giản nhất | Trải nghiệm kém với người xem không phát được | Thử nghiệm sớm |
| Chuyển sang H.264 ngay trên máy người dùng trước khi tải | Không tốn tài nguyên server | Nặng và chậm trên máy yếu, tốn pin | Host trên Vercel |
| Chuyển mã ở server (ffmpeg) | Ổn định nhất, ra một định dạng duy nhất | Cần server hoặc worker riêng, tốn CPU | Có VPS riêng |

Chuyển mã lại cũng loại bỏ metadata vị trí trong file gốc, việc mà ảnh đã có sẵn nhờ vẽ qua canvas.

**Thay đổi so với giai đoạn 1**

- `media.kind = 'video'`, thêm `duration_s` và một ảnh đại diện (poster) tạo ở máy người dùng bằng canvas.
- Kiểm tra thời lượng và dung lượng ở cả client lẫn server (đọc metadata khi xác nhận).
- Phát bằng thẻ `<video>` với `playsinline` và `preload="metadata"`, chỉ tải khi người xem bấm phát.
- Dòng đồng ý dữ liệu cập nhật vì video có hình và tiếng; giới hạn dung lượng album để file zip không quá lớn.
- Hộp quà thêm lựa chọn "clip ngắn", dùng chung đường tải và kiểm duyệt với album.

## 10. Rủi ro, câu hỏi mở và chỉ số đo thành công

Rủi ro lớn nhất là chi phí lưu trữ và lộ ảnh riêng tư; cả hai đã có biện pháp giảm trong thiết kế, và câu hỏi cần chốt sớm nhất là nơi host.

**Rủi ro**

| Rủi ro | Cách giảm |
| --- | --- |
| Chi phí lưu trữ tăng nhanh | Nén ảnh còn khoảng 300 KB, tối đa 5 ảnh mỗi người, tự xóa sau 90 ngày |
| Lộ ảnh riêng tư ra ngoài nhóm | Kho file riêng tư, URL có hạn, OG image không dùng ảnh kỷ niệm |
| Ảnh không phù hợp | Nút báo cáo, chủ phòng xóa được, ghi `audit_log` |
| Tải ảnh lỗi trên một số máy (HEIC, thiếu bộ nhớ) | Thử trên máy thật, hàng đợi gửi lại, thông báo lỗi rõ ràng |
| Check-in không phản ánh đúng ai thật sự có mặt | Chấp nhận ở giai đoạn 1 vì đây là nhóm bạn bè; GPS chỉ là tùy chọn về sau |
| WebSocket cần máy chủ chạy liên tục, không chạy được trên Vercel | Chốt VPS sớm; giao diện tự lùi về `GET .../live` khi kết nối lỗi |
| Phòng `live` không ai bấm kết thúc | Tự kết thúc sau 24 giờ; dữ liệu vẫn được giữ |
| Nội dung quà lộ trước `done` | Server không trả nội dung trước đó, có kiểm thử riêng |

**Câu hỏi cần chốt**

- [ ] Host ở VPS riêng hay Vercel? WebSocket cần máy chủ chạy liên tục, nên đây là câu hỏi cần chốt đầu tiên.
- [ ] Mốc 24 giờ tính từ `live_from` (như đề xuất) hay từ giờ bắt đầu của ô đã chốt?
- [ ] Check-in chỉ mở từ khi `live` bật (30 phút trước giờ hẹn), hay mở cả trước đó?
- [ ] Ô trên lưới hiện một con số cho cả kèo (như đề xuất) hay số người theo từng giờ?
- [ ] Người chưa bấm "Đi" vẫn được check-in (như đề xuất), hay phải RSVP trước?
- [ ] Hộp quà bật sẵn khi tạo phòng, hay để chủ phòng tự bật?
- [ ] Thời hạn 90 ngày cố định, hay cho chủ phòng chọn?

**Chỉ số đo thành công**

- Tỷ lệ kèo đã chốt có ít nhất một lượt check-in.
- Tỷ lệ người bấm "Đi" thực sự check-in.
- Số ảnh trung bình mỗi kèo, và tỷ lệ tải ảnh thành công ngay lần đầu.
- Tỷ lệ album được mở lại sau kèo, và tỷ lệ tải zip.
- Số lần xóa và báo cáo ảnh, để phát hiện vấn đề nội dung sớm.
