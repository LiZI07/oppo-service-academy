# Triển khai OPPO Service Academy trên Cloudflare

Phương án giai đoạn đầu: tối đa 50 tài khoản, truy cập online bằng link, email đăng nhập do Cloudflare Access xác thực, ứng dụng dùng Workers + D1 + R2. Không cần tài khoản ChatGPT khi dùng phương án Cloudflare này.

## Đã có trong mã nguồn

- Xác thực Access JWT bằng jose: kiểm tra chữ ký RS256, issuer, audience, hạn dùng, sub và email; từ chối service token và header danh tính tự gửi.
- Cổng xác thực chạy trước cả giao diện, API, trang preview và tài nguyên tĩnh. Thiếu cấu hình thì trả 503, thiếu/token sai trả 401.
- Giao diện đăng nhập/đăng xuất VN/CN/EN, hồ sơ tài khoản và quyền ứng dụng giữ nguyên.
- Cấu hình triển khai mẫu, kiểm tra cấu hình, lệnh build/deploy/migrate và migration bổ sung index cho truy vấn theo phạm vi.
- Code có thể build và kiểm tra local; tài khoản hạ tầng, tài nguyên thật và nghiệm thu người dùng thật vẫn cần hoàn tất riêng.

## Chi phí và giới hạn

Các hạn mức được kiểm tra ngày 26/10/2026, cần kiểm tra dashboard trước khi sử dụng:

| Thành phần | Mức miễn phí / điều kiện |
| --- | --- |
| Workers Free | 100.000 request/ngày, kèm giới hạn CPU và tài nguyên của Free |
| D1 Free | Tổng 5 GB; 5 triệu hàng đọc/ngày, 100.000 hàng ghi/ngày |
| Access Free | Tối đa 50 người dùng, gồm cả Admin, VPC và quản lý |
| R2 Standard | 10 GB-tháng; 1 triệu thao tác Class A, 10 triệu Class B/tháng |

R2 cần kích hoạt subscription qua checkout; dùng vượt hạn mức có thể bị tính phí. Không có bảo đảm miễn phí vô hạn hoặc giới hạn chi phí cứng cho R2 trong mã nguồn. Không tự nâng gói, nhập thông tin thanh toán hay chấp nhận subscription thay người phụ trách. Dùng file nén, theo dõi dung lượng và số thao tác; hạn mức có sẵn của tài khoản có thể được dùng chung với ứng dụng khác.

## 1. Tạo hạ tầng trong tài khoản Cloudflare của người phụ trách

1. Đăng nhập Cloudflare, giữ Workers ở gói Free. Không cần mua domain cho giai đoạn thử nghiệm vì có link workers.dev.
2. Tạo D1 tên `oppo-service-academy`, ghi lại database ID. Dùng database mới, không ghi đè DB đang chạy.
3. Người phụ trách xem và hoàn tất điều kiện R2 subscription nếu chấp nhận; tạo bucket `oppo-service-academy-private`. Giữ bucket private, không bật r2.dev/public domain.
4. Bật Zero Trust Free. Chuẩn bị team domain, ví dụ `https://ten-team.cloudflareaccess.com`.

## 2. Cấu hình riêng cho triển khai

Copy `cloudflare.config.example.json` thành `cloudflare.config.json`, điền:

- `d1_databases[0].database_id`: D1 ID thật.
- `r2_buckets[0].bucket_name`: bucket riêng tư đã tạo.
- `vars.ACCESS_TEAM_DOMAIN`: HTTPS team domain, không thêm dấu / cuối.
- `vars.ACCESS_AUD`: AUD 64 ký tự của ứng dụng Access, sau bước bảo vệ bên dưới.

`cloudflare.config.json` bị Git bỏ qua. Không đưa token, email bootstrap hoặc thông tin thanh toán vào repository.

```bash
pnpm cloudflare:check
pnpm cloudflare:migrate
pnpm cloudflare:build
pnpm cloudflare:deploy
```

`migrate` áp dụng cả 0000 và 0001 qua D1 migrations. `deploy` luôn build lại và kiểm tra cấu hình sinh ra trước khi gửi lên. Không sửa migration 0000 đã áp dụng. Trước chuyển dữ liệu thật cần kế hoạch sao lưu/khôi phục D1 và R2 riêng.

## 3. Bảo vệ link bằng Access trước khi mở cho nhân viên

Trong Workers & Pages, chọn Worker → Access hoặc Settings → Domains & Routes → Enable Cloudflare Access. Bảo vệ Worker production; preview_urls hiện được tắt.

- Chính sách Allow chỉ gồm email đã được phê duyệt, lúc đầu chỉ email người phụ trách. Không chọn Everyone hoặc Bypass cho tài liệu nội bộ.
- Bật One-time PIN để người được phép nhận mã qua email; có thể chọn IdP công ty nếu công ty đã cấu hình.
- Lấy Application Audience (AUD) Tag, đưa vào cấu hình và deploy lại.
- Nếu cần tạo Worker/Access trước khi có AUD, chỉ tạo Worker trống để lấy hostname và cấu hình Access. Không upload bản ứng dụng bỏ cổng xác thực để vượt bước này.
- Kiểm tra cửa sổ chưa đăng nhập phải hiện cổng Access hoặc bị chặn; không được đọc trang preview, ảnh quy trình hay file JS riêng của app.

Mã nguồn chủ động kiểm tra JWT kể cả khi một hostname khác vô tình trỏ tới Worker. `assets.run_worker_first=true` bắt buộc và được kiểm tra trước triển khai. Không bật `AUTH_PROVIDER=sites-trusted-proxy` trên Cloudflare độc lập.

## 4. Tạo Admin và tài khoản nhân viên

Đặt Worker secret `BOOTSTRAP_ADMIN_EMAIL` thành đúng email người phụ trách, qua mục Variables and Secrets hoặc lệnh tương tác:

```bash
pnpm exec wrangler secret put BOOTSTRAP_ADMIN_EMAIL --config cloudflare.config.json
```

Không đặt giá trị trên dòng lệnh hoặc trong chat. Sau khi email đó được Access xác thực, mở app để tạo Admin trên DB mới. Kiểm tra đăng nhập, rồi gỡ secret bootstrap; tài khoản Admin đã tạo vẫn được giữ lại. Bootstrap không nâng vai trò tài khoản đã tồn tại.

Admin tạo/nhập hồ sơ nhân viên bằng đúng email Access, gán vai trò, store, trainer và phạm vi; sau đó phân người chấm từng trainee/kỳ thi. Hồ sơ ứng dụng và quyền ở cổng Access là hai bước riêng; không tự gửi thư mời hoặc tự cấp quyền theo tên người trong tài liệu.

## 5. Tự động triển khai từ GitHub, nếu dùng Cloudflare Workers Builds

Chỉ kết nối repo private `LiZI07/oppo-service-academy` với Cloudflare sau khi chủ tài khoản cho phép quyền đó. Chọn nhánh main, build command `pnpm run check`, deploy command `pnpm cloudflare:migrate && pnpm cloudflare:deploy`.

Trong build variables đặt `ACADEMY_D1_ID`, `ACADEMY_R2_BUCKET`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`. Script tạo cấu hình local từ mẫu khi chưa có `cloudflare.config.json`. Đặt `BOOTSTRAP_ADMIN_EMAIL` trong Worker runtime secrets, không phải build variables. Mỗi lần đổi các build variables, tạo lại bản build mới.

Nếu dashboard yêu cầu build command có build output, dùng `pnpm cloudflare:build` rồi deploy command `pnpm exec wrangler deploy --config dist/server/wrangler.json`.

## 6. Nghiệm thu trước khi mở rộng

- Đăng nhập thật bằng email Admin và một tài khoản trainee/trainer/VPC trong phạm vi.
- Học, ghi chú, gửi ảnh từ điện thoại, trainer duyệt, người được chỉ định chấm, người khác chỉ xem kết quả.
- Thu hồi Access và khóa hồ sơ ứng dụng; kiểm tra phiên đang mở mất quyền khi yêu cầu dữ liệu tiếp theo.
- Kiểm tra upload/download private R2, sao lưu/khôi phục D1/R2 và số request/CPU/rows read khi vận hành thực tế.

Các bài kiểm tra tự động không thay thế thử thiết bị điện thoại, tải thực hoặc đăng nhập email qua Cloudflare thật. Chưa có đồng bộ O-learning/GCSM hay quyết định nhân sự tự động.

## Tài liệu chính thức

- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [R2 subscription](https://developers.cloudflare.com/r2/get-started/)
- [Access plans](https://www.cloudflare.com/plans/zero-trust-services/)
- [Protect Workers with Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
- [Validate Access JWTs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)

## Academy email and password sign-in (staged migration)

The new password provider is opt-in. Existing builds still default to `cloudflare-access` so publishing this change cannot silently remove the current identity boundary.

1. Keep Access enabled. Deploy using `pnpm cloudflare:migrate && pnpm cloudflare:deploy`; migration `0002_password_auth.sql` adds credential/session/reset/rate-limit tables without changing training records or member IDs. The build token needs D1 Write/Edit permission for remote migrations.
2. Sign in as the existing Admin. Open **Account management → My profile → Password & security**, set a private password (at least 8 characters), and confirm it saves. Do not put passwords in source, build variables, logs or chat. This preserves the Admin's existing `auth_id` and all scoped records.
3. Set build variable `ACADEMY_AUTH_PROVIDER=password`, retain the existing four D1/R2/Access build variables, and rebuild with the same migration/deploy command. An explicit local config instead needs `vars.AUTH_PROVIDER=password`. Build variables do not override a pre-existing local config file.
4. Only after the password build succeeds and the Admin password exists, remove the *outer Worker Access protection* using the Cloudflare dashboard. Do not make the R2 bucket public. `/login` and the exact login/reset/logout endpoints become public; all other application pages, bundles, APIs and files remain gated by Academy's session and existing role permissions. The retired `/preview` route redirects to sign-in; sample-role selection has been removed.
5. In a fresh browser session, verify the branded `/login`, Admin login, logout, wrong-password rejection and a scoped trainee account. Check Workers CPU/error telemetry before team rollout: secure scrypt can exceed the Free plan's CPU budget. Local workerd integration passing is not proof that a production Free invocation fits. Do not reduce password hashing strength to hide a limit; if the free tier is insufficient, retain Access or arrange an approved authentication host/plan before switching.
6. Admin creates member profiles, then edits each profile to generate a **one-use password setup link**. Share privately after verifying the employee, outside this app. Links expire after 30 minutes. No invitation/reset email is automatically sent. The public **Forgot password?** control explains the Admin-assisted recovery flow; it does not pretend to send an email.

Sessions use random 256-bit opaque tokens in Secure, HttpOnly, SameSite=Lax cookies; only SHA-256 token digests are persisted. Standard sessions expire after 12 hours; Remember me sessions after 7 days. Credentials use salted scrypt (N=32768,r=8,p=3). Credential changes require the current password after the initial verified Access setup and revoke existing sessions. Reset links are one-use, version-bound and stored only as digests. Login has persistent IP/account throttling, same-origin checks, bounded JSON bodies and generic invalid-credential errors. No public registration or automatic email-based role assignment is provided.

Rollback before staff onboarding: restore `ACADEMY_AUTH_PROVIDER=cloudflare-access`, rebuild and restore Worker Access protection using the existing team/AUD/application. Retain the added tables; do not delete existing staff or training data.
