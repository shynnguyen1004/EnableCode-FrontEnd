# Enable Code

**Enable Code** là nền tảng học lập trình dễ tiếp cận, cho phép người dùng điều khiển giao diện bằng mắt và lập trình qua các khối lệnh trực quan (kéo-thả). Dự án hướng tới người có hạn chế vận động, giúp học lập trình mà không phụ thuộc hoàn toàn vào chuột và bàn phím.

## Tính năng chính

- **Điều khiển bằng mắt** — Sử dụng [MediaPipe Face Mesh](https://developers.google.com/mediapipe/solutions/vision/face_landmarker) để theo dõi ánh nhìn và điều khiển con trỏ trên màn hình. Bật/tắt nhanh bằng phím tắt `Ctrl/Cmd + M`.
- **Lập trình khối lệnh** — Giao diện workspace với thư viện khối lệnh trực quan, vùng thả rộng, phù hợp điều khiển bằng mắt.
- **Lộ trình học có cấu trúc** — Chủ đề và bài học theo thứ tự, có trạng thái khóa/mở và theo dõi tiến độ.
- **Hiệu chuẩn (Calibration)** — Trang hiệu chuẩn 9 điểm giúp tinh chỉnh độ chính xác của theo dõi mắt.
- **Đa ngôn ngữ** — Hỗ trợ tiếng Việt và tiếng Anh.
- **Xác thực người dùng** — Đăng nhập, đăng ký, quản lý hồ sơ; tích hợp API backend qua JWT.

## Công nghệ

| Thành phần   | Công nghệ                 |
| ------------ | ------------------------- |
| Framework    | React 19 + TypeScript     |
| Build tool   | Vite 8                    |
| Routing      | React Router 7            |
| HTTP client  | Axios                     |
| Icons        | Lucide React              |
| Eye tracking | MediaPipe Face Mesh (CDN) |
| Triển khai   | Vercel (SPA)              |

## Yêu cầu hệ thống

- **Node.js** 18 trở lên
- **npm** (hoặc pnpm/yarn)
- **Webcam** — Cần thiết khi sử dụng tính năng điều khiển bằng mắt
- **Trình duyệt desktop** — Ứng dụng hiện chưa hỗ trợ thiết bị di động

## Cài đặt và chạy

```bash
# Clone repository
git clone <repository-url>
cd EnableCode

# Cài dependencies
npm install

# Chạy development server
npm run dev
```

Mở trình duyệt tại địa chỉ Vite hiển thị (mặc định `http://localhost:5173`).

### Biến môi trường

Tạo file `.env` ở thư mục gốc nếu cần kết nối backend:

```env
VITE_API_URL=http://localhost:5000/api
```

Nếu không cấu hình, ứng dụng mặc định gọi API tại `http://localhost:5000/api`.

## Scripts

| Lệnh              | Mô tả                                   |
| ----------------- | --------------------------------------- |
| `npm run dev`     | Khởi chạy dev server với HMR            |
| `npm run build`   | Kiểm tra TypeScript và build production |
| `npm run preview` | Xem trước bản build production          |
| `npm run lint`    | Chạy ESLint                             |

## Cấu trúc thư mục

```
src/
├── api/            # Client gọi REST API (auth, lesson, profile)
├── components/     # UI dùng chung (Mouse, sidebar, toggle, ...)
├── context/        # React Context (Auth, EyeTracking)
├── hooks/          # Custom hooks (useIsMobile, ...)
├── i18n/           # Đa ngôn ngữ (vi, en) và curriculum
├── lib/            # Logic nghiệp vụ (curriculum, progress, ...)
├── pages/          # Các trang ứng dụng
├── styles/         # CSS variables, base, components
├── types/          # TypeScript types
└── utils/          # Tiện ích (lesson mapper, ...)
public/
├── logo/           # Logo sáng/tối
└── images/         # Tài nguyên tĩnh
```

## Các trang

| Đường dẫn              | Mô tả                                                   |
| ---------------------- | ------------------------------------------------------- |
| `/`                    | Trang chủ — giới thiệu, bật điều khiển mắt, CTA bắt đầu |
| `/login`               | Đăng nhập (email/mật khẩu hoặc quét mắt)                |
| `/register`            | Đăng ký tài khoản                                       |
| `/lessons`             | Danh sách chủ đề                                        |
| `/lessons/:topicId`    | Danh sách bài học theo chủ đề                           |
| `/workspace/:lessonId` | Không gian lập trình (mục tiêu + khối lệnh)             |
| `/settings`            | Hồ sơ và cài đặt theo dõi mắt                           |
| `/calibration`         | Hiệu chuẩn theo dõi mắt 9 điểm                          |

## Điều khiển bằng mắt

1. Bật tính năng từ trang chủ hoặc dùng phím tắt `Ctrl/Cmd + M`.
2. Cho phép trình duyệt truy cập webcam khi được hỏi.
3. (Khuyến nghị) Chạy hiệu chuẩn tại `/calibration` trước khi sử dụng lâu dài.
4. Con trỏ ảo sẽ theo ánh nhìn; các hành động click/drag được xử lý qua nhận diện khuôn mặt.

Trạng thái bật/tắt được lưu trong `localStorage` (`enablecode.eyeTrackingEnabled`).

## Backend API

Frontend kỳ vọng một REST API backend cung cấp các endpoint:

- `POST /auth/login`, `/auth/register`, `/auth/refresh-token`
- `GET` topics, lessons, lesson details
- Profile và calibration settings

Chi tiết xem trong `src/api/`.

## Triển khai

Dự án cấu hình sẵn cho [Vercel](https://vercel.com) với SPA fallback (`vercel.json`). Build command:

```bash
npm run build
```

Output nằm trong thư mục `dist/`.

## Quy ước phát triển

- **Logo**: `/logo/TL_App_Logo.png` trên nền sáng, `/logo/TD_App_Logo.png` trên nền tối.
- **Commit**: Tuân theo [Conventional Commits](https://www.conventionalcommits.org/) (commitlint + husky).
- **Format**: Prettier và ESLint chạy qua lint-staged trước mỗi commit.

## Thiết kế UI

Giao diện được triển khai theo thiết kế Figma Make:

[Figma — Enable Code UI/UX Design](https://www.figma.com/make/RlxTkeDp7lExAGRl7ocRjg/Enable-Code-%7C-UI-UX-Dessign)

## Giấy phép

Dự án private — liên hệ chủ sở hữu repository để biết điều khoản sử dụng.
