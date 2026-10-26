# OPPO Service Academy

Website quản lý đào tạo kỹ thuật viên mới trong 90 ngày, giao diện Việt / Trung / Anh, thang điểm 100/100.

Repository được chuẩn bị để lưu **riêng tư trên GitHub** vì có nội dung đào tạo nội bộ từ tài liệu được cung cấp. Không kèm dữ liệu nhân viên, cơ sở dữ liệu đang chạy, ảnh minh chứng hoặc file riêng người dùng đã tải lên.

## Chức năng theo tài khoản

| Tài khoản | Trải nghiệm chính |
| --- | --- |
| Trainee | Lộ trình, bài học, ghi chú riêng, nhật ký, minh chứng, bài kiểm tra, tiến độ và kết quả cá nhân |
| Trainer | Trainee được giao, tiến độ, thời gian học, duyệt thực hành và nhận xét |
| Cửa hàng trưởng | Tiến độ cửa hàng/phạm vi được giao, kết quả và đánh giá khi được chỉ định |
| Giám sát khu vực | Theo dõi khu vực, KPI và đánh giá khi được chỉ định |
| Leader | Đội ngũ và kết quả trong phạm vi, đánh giá khi được chỉ định |
| VPC | Bài học/file/đề thi theo quyền từng khóa, trainee và kết quả trong phạm vi |
| Admin | Tài khoản, vai trò, phạm vi, khóa học, quyền VPC và chỉ định người chấm |

Mỗi kỳ thi của từng trainee có đúng một người chấm được chỉ định. Admin cũng phải được chỉ định để chấm. Kết quả công bố chia sẻ cho các tài khoản liên quan trong phạm vi; bản nháp hạn chế truy cập. LV1 đạt từ 90/100; thực hành phải lớn hơn 90/100.

## Chạy và kiểm tra

Yêu cầu Node.js 24, pnpm 11.25.0. Thư viện được khóa trong `pnpm-lock.yaml`.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Mở `http://localhost:5173/preview?role=trainee`. Đổi `role` thành `trainer`, `vpc`, `store_manager`, `regional_supervisor`, `leader` hoặc `admin` để xem từng giao diện. Preview dùng dữ liệu giả, chỉ đọc, không tạo tài khoản thật.

```bash
pnpm run check
pnpm build
```

`check` kiểm tra TypeScript, API với SQLite trong bộ nhớ, phân quyền, quyền chấm kỳ thi, chia sẻ kết quả, tài khoản và cơ chế đóng xác thực khi chưa cấu hình. GitHub Actions đã được khai báo để chạy các kiểm tra và build sau khi push; cần xem kết quả thực trên GitHub sau khi tạo repo.

## Triển khai nội bộ bằng Cloudflare

Đã bổ sung đăng nhập bằng email qua Cloudflare Access cho giai đoạn tối đa 50 tài khoản; nhân viên không cần ChatGPT. Máy chủ kiểm tra chữ ký và quyền của Access trước giao diện, API và tài nguyên tĩnh. Chưa cấu hình thì đóng truy cập.

Dùng Workers Free, D1 và R2 private trong hạn mức. R2 cần subscription và có thể tính phí khi vượt mức miễn phí. Xem [DEPLOYMENT.md](DEPLOYMENT.md) để tạo tài nguyên, bảo vệ link, tạo Admin và theo dõi chi phí; [HANDOFF.md](HANDOFF.md) cho chi tiết nghiệp vụ.

```bash
pnpm cloudflare:check
pnpm cloudflare:migrate
pnpm cloudflare:deploy
```

Các lệnh cần cấu hình tài khoản Cloudflare thật; mã nguồn không kèm token hoặc tài nguyên đang chạy. File mẫu là `cloudflare.config.example.json`, bản điền thật `cloudflare.config.json` được Git bỏ qua. Chế độ Sites cũ chỉ dùng sau ingress đáng tin cậy của Sites.

## Bố cục mã nguồn

- `app/`: giao diện, API, phân quyền và nội dung lộ trình được trích từ tài liệu gốc.
- `db/`, `drizzle/`: schema và migration D1.
- `tests/`: kiểm tra nghiệp vụ/phân quyền và tài khoản.
- `.github/workflows/ci.yml`: kiểm tra tự động, chưa có bước deploy.
- `.dev.vars.example`: cấu hình mẫu, không chứa thông tin đăng nhập.

Không commit `.dev.vars`, `.env`, token, khóa riêng, dữ liệu thật hoặc ảnh minh chứng. Thành phần bên thứ ba giữ nguyên thông báo giấy phép đi kèm; repo không cấp quyền công khai tài liệu đào tạo nội bộ.
