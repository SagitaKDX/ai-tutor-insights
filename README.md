# 📊 AI Tutor — EDA Insights & Executive Presentation Dashboard

Trang web ứng dụng tương tác **Executive Dashboard & Slide Presentation** phân tích 1.000 lượt tương tác học viên từ dữ liệu `labeled_semantic.csv` khóa học AI, phát hiện các điểm mù kiến trúc (P0), phân rã 11 chuyên đề insight, và vạch ra lộ trình cải tiến hệ thống trợ giảng AI.

🌐 **Xem trực tiếp trên GitHub Pages:** `https://<your-username>.github.io/<repo-name>/`

---

## 🌟 Tính Năng Nổi Bật

### 1. Chế Độ Kép (Dual-Mode System):
- **📊 Executive Dashboard Mode:**
  - 6 thẻ KPI chính (Tổng query, User duy nhất, Phiên hội thoại, Echo bug 48%, Simplify retry alert 20%).
  - 4 Biểu đồ Chart.js trực quan (Doughnut Context Capture, Bar Rule Win Rate, Horizontal Bar Intent vs Retry, Line Daily Volume).
  - 11 Chuyên đề Phân tích chuyên sâu (Accordion expand/collapse) kèm bằng chứng định lượng và đề xuất hành động.
  - **⚡ 2 Trình Giả Lập Tương Tác:**
    1. *Bộ giả lập ngân sách độ dài câu trả lời* theo từng ý định học tập (P0).
    2. *Bộ thử nghiệm luật phân loại Rule Engine* với câu hỏi bất kỳ.
  - Bảng Lộ trình Backlog P0 / P1 / P2 kèm bộ lọc tức thì.
  - Bảng kiểm tra mẫu câu hỏi thực tế (Live Q&A Inspector).

- **📽️ Slide Presentation Mode (Trình chiếu Cấp cao):**
  - Khung slide chuẩn tỷ lệ 16:9 với giao diện kính mờ Glassmorphism sang trọng.
  - 12 slide thiết kế theo cấu trúc thuyết trình chuyên nghiệp cho Tech Lead, CTO và Ban lãnh đạo.
  - Nhúng biểu đồ tương tác trực tiếp trong từng slide.
  - Hộp ghi chú diễn giả (Speaker Notes) tích hợp sẵn.
  - Hỗ trợ toàn màn hình (Fullscreen) và phím tắt tiện lợi.

---

## ⌨️ Phím Tắt Trình Chiếu

| Phím tắt | Chức năng |
|---|---|
| <kbd>→</kbd> / <kbd>Space</kbd> / <kbd>PageDown</kbd> | Chuyển Slide tiếp theo |
| <kbd>←</kbd> / <kbd>PageUp</kbd> | Quay lại Slide trước |
| <kbd>F</kbd> | Bật / Tắt chế độ Toàn màn hình (Fullscreen) |
| <kbd>Home</kbd> / <kbd>End</kbd> | Về Slide đầu / Slide cuối |

---

## 📁 Cấu Trúc Thư Mục

```text
ai-tutor-dashboard/
├── index.html        ← Trang web chính (Dashboard + Slide Deck tích hợp)
├── css/
│   └── styles.css    ← Design system Glassmorphism, Dark/Light Mode, Animation
├── js/
│   ├── data.js       ← Cơ sở dữ liệu 1.000 log, 11 chương EDA, KPI, 12 Slide
│   ├── dashboard.js  ← Bộ điều khiển biểu đồ Chart.js, Simulator, Bảng lọc
│   └── slides.js     ← Bộ điều khiển Slide Deck, Phím tắt, Fullscreen
└── README.md         ← Tài liệu hướng dẫn sử dụng & triển khai
```

---

## 🚀 Hướng Dẫn Triển Khai GitHub Pages (`github.io`)

### Cách 1: Đẩy trực tiếp vào nhánh `main`

1. Tạo một repository mới trên GitHub (ví dụ: `ai-tutor-insights`).
2. Mở terminal và đẩy toàn bộ thư mục `ai-tutor-dashboard` lên:
   ```bash
   cd /Users/minhlethanh/Downloads/ai-tutor-dashboard
   git init
   git add .
   git commit -m "feat: AI Tutor Executive Dashboard and Slide Deck"
   git branch -M main
   git remote add origin https://github.com/<your-username>/ai-tutor-insights.git
   git push -u origin main
   ```
3. Trên GitHub, vào **Settings** → **Pages** → Trong mục **Build and deployment**, chọn **Source** là `Deploy from a branch` → Chọn nhánh `main` và thư mục `/(root)` → Nhấn **Save**.
4. Sau 1 phút, link GitHub Pages của bạn sẽ có dạng:  
   👉 `https://<your-username>.github.io/ai-tutor-insights/`

---

## 🖥️ Mở Cục Bộ Trên Máy Tính

Bạn chỉ cần nhấp đúp chuột vào file `index.html` trong thư mục `ai-tutor-dashboard` để mở trực tiếp trên Chrome, Safari, Edge hoặc bất kỳ trình duyệt nào mà không cần cài thêm web server!
