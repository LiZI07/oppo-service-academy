# Triển khai và bàn giao

## Repository và bản đang chạy

Đây là bản xuất mã nguồn để quản lý riêng tư bằng GitHub. Việc chuẩn bị bản xuất không đổi URL, repository nguồn, quyền chia sẻ hoặc dữ liệu website Sites đang chạy. Lịch sử Git mới không chứa cấu hình triển khai gốc hay email Admin cá nhân.

GitHub Actions chỉ cài thư viện theo lockfile, kiểm tra TypeScript, chạy kiểm tra nghiệp vụ và build; chưa tự deploy. Kiểm tra local không thay thế kết quả CI thực trên GitHub.

## Chọn hướng hosting

| Hướng | Công việc |
| --- | --- |
| Tiếp tục Sites | Gắn source qua luồng Sites hỗ trợ, cấu hình project của chính bạn, giữ ingress xác thực của nền tảng, cấp quyền Site và tạo hồ sơ nhân viên riêng |
| Hosting công ty | Cấu hình Worker, D1, R2 của công ty; thay xác thực Sites bằng SSO hoặc phiên đăng nhập do máy chủ kiểm chứng; cấu hình domain, vận hành và sao lưu |

Không triển khai lên Worker công khai rồi bật tin cậy header `oai-authenticated-user-*`. Header này chỉ đáng tin sau ingress Sites đã xác thực và loại bỏ dữ liệu giả do khách tự gửi; host thông thường không có lớp đó.

## Cấu hình

| Tên | Ý nghĩa |
| --- | --- |
| `DB` | Binding D1 chứa members, documents và events |
| `BUCKET` | R2 riêng tư, tải file qua API kiểm tra quyền |
| `AUTH_PROVIDER` | Bỏ trống/disabled: không nhận danh tính; sites-trusted-proxy: chỉ sau ingress Sites đáng tin hoặc mock loopback khi phát triển |
| `BOOTSTRAP_ADMIN_EMAIL` | Email đã xác thực để tạo Admin ban đầu khi chưa có hồ sơ; bỏ trống thì không tự tạo Admin |

Bootstrap không tự nâng vai trò tài khoản đã tồn tại. Gỡ cấu hình bootstrap sau khi tạo và kiểm tra Admin. Không có mật khẩu mặc định hay API bỏ qua phân quyền.

Copy `.dev.vars.example` sang `.dev.vars` khi cần thử luồng local. Mock của bộ khởi tạo chỉ hoạt động trên loopback. Preview các vai trò không cần đăng nhập. Không dùng máy chủ dev cho sản xuất.

## Đưa repository lên GitHub

Khi đã kết nối tài khoản GitHub có quyền tạo repo, dùng repository riêng tư tên `oppo-service-academy`. Không tạo repo công khai vì có tài liệu nội bộ. Nếu tự dùng GitHub CLI đã đăng nhập, chạy trong thư mục mã nguồn:

```bash
gh repo create oppo-service-academy --private --source=. --remote=origin --push
```

Chỉ dùng lệnh này khi repo chưa tồn tại và thư mục hiện tại là bản xuất riêng, không phải checkout Sites. Sau đó kiểm tra visibility private, nhánh main và kết quả Actions. Lệnh này chưa được chạy trong bước chuẩn bị.

## Các bước hosting độc lập

1. Chọn tài khoản công ty và người phụ trách hạ tầng/xác thực. Tách môi trường thử nghiệm và chính thức.
2. Thay `app/chatgpt-auth.ts`: máy chủ kiểm tra phiên/token hoặc assertion SSO, trả về ID ổn định và email đã xác minh. Cập nhật đăng nhập/đăng xuất trong `app/session-panel.tsx` và trang login. Không nhận vai trò từ trình duyệt.
3. Cấu hình Worker và binding `DB`, `BUCKET` thật. Vite hiện dùng database ID và bucket local; repo chưa chứa tài nguyên Cloudflare thật.
4. Áp dụng `drizzle/0000_previous_rictor.sql` qua migration lên D1 mới. Nếu chuyển dữ liệu cũ, xuất/nhập D1 và R2 riêng có kiểm soát; source repo không có dữ liệu này. Không dùng lệnh phá dữ liệu lên DB đang chạy.
5. Cấu hình email Admin ban đầu, đăng nhập bằng danh tính đã xác thực, kiểm tra rồi gỡ bootstrap.
6. Tạo tài khoản, trainer, cửa hàng, phạm vi từng người và chỉ định người chấm từng trainee/kỳ thi. Tạo hồ sơ không tự gửi thư mời hoặc cấp quyền nền tảng.
7. Nghiệm thu một cửa hàng với tài khoản thật: học/ghi nhật ký, upload bằng điện thoại, trainer duyệt, người được giao chấm, người khác xem kết quả, thu hồi quyền.
8. Chốt domain, sao lưu/khôi phục D1 và R2, thời hạn lưu dữ liệu, người vận hành và tải dự kiến trước khi mở rộng.

## Quy tắc cần giữ khi phát triển

- Điểm 100; LV1 >=90, thực hành >90 với 20 tiêu chí x 5 điểm.
- Chỉ assessorId hiện hành được ghi điểm; assignmentRevision phải kiểm tra trong điều kiện ghi SQL để chặn lưu sau khi đã đổi người chấm.
- Kết quả công bố chia sẻ trong phạm vi; không lộ nháp/lịch sử nháp. Ghi chú trainee riêng tư.
- Kiểm tra quyền đọc/ghi/file ở máy chủ, không chỉ ẩn nút.
- Archive/restore giữ lịch sử khóa học; dữ liệu preview không được dùng làm kết quả chính thức.
- Học liệu, ngân hàng đề và ngưỡng nguồn còn mơ hồ cần người phụ trách duyệt.

## Tài liệu chính thức

- [Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/)
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [R2](https://developers.cloudflare.com/r2/)
- [GitHub Actions checkout](https://github.com/actions/checkout)
- [GitHub Actions setup-node](https://github.com/actions/setup-node)
