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

## Trạng thái triển khai

Ứng dụng dùng Vinext, React, Cloudflare D1 và R2. Bản ban đầu chạy trên Sites với đăng nhập ChatGPT. **Đưa code lên GitHub không tự tạo đăng nhập độc lập hoặc chuyển dữ liệu sang hosting mới.**

Bản xuất đã bỏ ID triển khai và email Admin cá nhân. `AUTH_PROVIDER` mặc định chưa bật; API dữ liệu cần đăng nhập sẽ từ chối truy cập. Email Admin ban đầu được cấu hình qua `BOOTSTRAP_ADMIN_EMAIL`, sau khi có xác thực tin cậy.

Xem [DEPLOYMENT.md](DEPLOYMENT.md) để triển khai và [HANDOFF.md](HANDOFF.md) cho nghiệp vụ, phân quyền, kiểm tra và việc cần nghiệm thu.

## Bố cục mã nguồn

- `app/`: giao diện, API, phân quyền và nội dung lộ trình được trích từ tài liệu gốc.
- `db/`, `drizzle/`: schema và migration D1.
- `tests/`: kiểm tra nghiệp vụ/phân quyền và tài khoản.
- `.github/workflows/ci.yml`: kiểm tra tự động, chưa có bước deploy.
- `.dev.vars.example`: cấu hình mẫu, không chứa thông tin đăng nhập.

Không commit `.dev.vars`, `.env`, token, khóa riêng, dữ liệu thật hoặc ảnh minh chứng. Thành phần bên thứ ba giữ nguyên thông báo giấy phép đi kèm; repo không cấp quyền công khai tài liệu đào tạo nội bộ.
