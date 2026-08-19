// AI Tutor EDA Insights & Slide Presentation Data
window.AI_TUTOR_DATA = {
  overview: {
    title: "AI Tutor — EDA Insights & Improvement Backlog",
    subtitle: "Phân tích 1.000 lượt hỏi/đáp học viên & Lộ trình cải tiến hệ thống Trợ giảng AI",
    source: "labeled_semantic.csv",
    timeWindow: "2026-08-10 → 2026-08-15 (6 ngày)",
    metrics: [
      { id: "total_queries", label: "Tổng lượt Hỏi/Đáp", value: "1.000", change: "100% in-class", icon: "message-square", color: "blue" },
      { id: "total_users", label: "Học viên duy nhất", value: "258", change: "Top 10% tạo 41,6% query", icon: "users", color: "purple" },
      { id: "total_convs", label: "Cuộc hội thoại", value: "360", change: "47,8% chỉ 1 lượt", icon: "git-branch", color: "cyan" },
      { id: "total_days", label: "Mã buổi học (Day Code)", value: "18", change: "46,6% dồn vào 14/08", icon: "calendar", color: "amber" },
      { id: "echo_rate", label: "Context bị Echo giả", value: "48,1%", change: "P0 Bug cần fix", icon: "alert-triangle", color: "rose" },
      { id: "retry_simplify", label: "Retry Intent 'Đơn giản'", value: "20,0%", change: "Gấp 3,4x mức nền (5,9%)", icon: "refresh-cw", color: "emerald" }
    ]
  },

  // 11 Detailed Chapters
  chapters: [
    {
      id: 0,
      title: "0. Phạm vi & Giới hạn dữ liệu",
      subtitle: "Đọc trước khi tin bất kỳ con số nào",
      badge: "Data Limitations",
      badgeColor: "amber",
      summary: "Dataset gồm 1.000 log trong 6 ngày, trong đó 46,6% tập trung vào buổi 14/08 và 100% ở chế độ in-class. Phù hợp rút insight về cơ chế và hành vi, chưa đủ đại diện cho xu hướng thời vụ.",
      metrics: [
        { label: "Thời gian", value: "6 ngày" },
        { label: "Ngày đỉnh điểm (14/08)", value: "46,6%" },
        { label: "Độ lệch nhãn (3 vs 8)", value: "612 : 1" },
        { label: "Tỉ lệ Fallback rỗng", value: "30,2%" }
      ],
      keyTakeaways: [
        "Không được dùng accuracy tổng do nhãn cực lệch (612:1).",
        "Mọi trung bình toàn cục thực chất bị kéo theo buổi 14/08. Bắt buộc báo cáo theo từng `day_code`.",
        "Cột `mode` là hằng số `in_class` ⇒ mọi kết luận chỉ đúng cho bối cảnh trong lớp học."
      ],
      actions: ["Đo lường baseline phân rã theo từng day_code thay vì lấy trung bình toàn cục."]
    },
    {
      id: 1,
      title: "1. Tầng thu thập ngữ cảnh đang bị mù",
      subtitle: "48,1% context chỉ là echo lại câu hỏi của học viên",
      badge: "P0 Critical Bug",
      badgeColor: "rose",
      summary: "Cờ `selected_region = yes` cho 891/1000 dòng nhưng thực chất 48,1% chỉ là client copy paste câu hỏi vào trường selection thay vì bôi đen slide.",
      metrics: [
        { label: "Bôi đen thật trên slide", value: "405 (40,5%)" },
        { label: "Selection echo câu hỏi", value: "481 (48,1%)" },
        { label: "Nhúng thẳng vào body", value: "5 (0,5%)" },
        { label: "Không có ngữ cảnh trang", value: "109 (10,9%)" }
      ],
      keyTakeaways: [
        "Cờ `selected_region` nhị phân làm nhiễu ~48% dữ liệu ngữ cảnh.",
        "Xuất hiện 3 dòng dump toàn bộ HTML/UI trang web do học viên Ctrl+A nhầm.",
        "Tồn tại 2 biến thể UI log gây phân mảnh schema."
      ],
      actions: [
        "P0: Thay `selected_region` bằng enum 3 giá trị: `highlight` | `page_only` | `no_context`.",
        "P0: Chặn echo: Nếu `selection == user_message` thì set `page_only`.",
        "P0: Giới hạn độ dài selection (1.500 ký tự) + strip UI chrome trước khi gửi prompt."
      ]
    },
    {
      id: 2,
      title: "2. 43% câu hỏi là nút bấm Preset, không phải tự gõ",
      subtitle: "Ảnh hưởng lớn tới clustering và phân tích ngữ nghĩa",
      badge: "Prompt Engineering",
      badgeColor: "blue",
      summary: "434/1.000 lượt là prompt preset (quick-action). Riêng 'Giải thích rõ đoạn này giúp mình.' chiếm 220 lượt (22%). Điều này làm KMeans silhouette chỉ đạt 0,14 do chuỗi lặp.",
      metrics: [
        { label: "Preset Quick-Action", value: "434 (43,4%)" },
        { label: "Giải thích đoạn này...", value: "220 (22,0%)" },
        { label: "Câu tự gõ thật", value: "566 (56,6%)" },
        { label: "KMeans Silhouette", value: "0,14 (Peak)" }
      ],
      keyTakeaways: [
        "Bắt buộc tách phân tích text giữa `preset` vs `typed` để không bị nhấn chìm tín hiệu.",
        "Preset hoạt động rất tốt như một affordance giúp học viên thao tác nhanh.",
        "Hiện thiếu event `preset_id` ở client nên không A/B test được hiệu quả từng nút."
      ],
      actions: [
        "P0: Log `prompt_source` (`preset` | `typed`) + `preset_id` trực tiếp tại client.",
        "P0: Đo CTR & retry-rate từng preset để đào thải nút kém và bổ sung nút mới."
      ]
    },
    {
      id: 3,
      title: "3. Rule Engine: 1 Rule vô dụng & Nhánh Fallback ẩn",
      subtitle: "Rule 7 thắng 0,5% và 30,2% rơi vào fallback mù",
      badge: "Rule Architecture",
      badgeColor: "purple",
      summary: "`7_ngu_canh_dai_tu` khớp 377 lần nhưng chỉ thắng đúng 2 lần (Win rate 0,5%). Ngược lại, 302 dòng (30,2%) không khớp rule nào bị đẩy vào fallback `2_noi_dung_bai_hoc` với tỉ lệ trả lời ngoài phạm vi cao nhất (19,4%).",
      metrics: [
        { label: "Win Rate Rule 6 (Tìm slide)", value: "97,0% (295/304)" },
        { label: "Win Rate Rule 4 (Tự kiểm tra)", value: "94,0% (33/35)" },
        { label: "Win Rate Rule 7 (Đại từ)", value: "0,5% (2/377) ⚠️" },
        { label: "Fallback rỗng (302 dòng)", value: "30,2% toàn bộ" }
      ],
      keyTakeaways: [
        "`7_ngu_canh_dai_tu` tạo multi-label giả tạo mà không mang lại giá trị quyết định.",
        "`2_noi_dung_bai_hoc` thực chất là nhãn 'chưa phân loại được' của hệ thống.",
        "Quy tắc ưu tiên (Resolve) rất sạch, vấn đề nằm ở định nghĩa rule."
      ],
      actions: [
        "P1: Hạ cấp `7_ngu_canh_dai_tu` thành cờ boolean `needs_coref: bool` trong prompt.",
        "P1: Đổi tên nhánh fallback thành `0_unclassified` để giám sát tỉ lệ mù thật sự.",
        "P1: Ưu tiên gán nhãn tay 302 dòng fallback để mở rộng taxonomy rule."
      ]
    },
    {
      id: 4,
      title: "4. Taxonomy nhãn chưa khớp Ý định học tập",
      subtitle: "Nhãn 3_reference_trang chứa tới 7 nhu cầu học khác nhau",
      badge: "Taxonomy Redesign",
      badgeColor: "cyan",
      summary: "`3_reference_trang` (61,2% dataset) đang là thùng chứa cho 7 ý định: Định nghĩa, Đơn giản hóa, Đào sâu, Ví dụ, So sánh, Tóm tắt, và Giải thích. Cần 7 chiến lược prompt khác nhau thay vì 1 pipeline chung.",
      metrics: [
        { label: "Giải thích đoạn chọn", value: "345 câu" },
        { label: "Ý định chưa rõ (Khác)", value: "301 câu (30%)" },
        { label: "Định nghĩa / Là gì", value: "109 câu" },
        { label: "Tóm tắt bài giảng", value: "110 câu" }
      ],
      keyTakeaways: [
        "Taxonomy hiện tại phân loại theo cơ chế truy xuất (Retrieval) chứ không theo nhu cầu học tập (Pedagogy).",
        "Tóm tắt bị chẻ 56% sang Rule 6 và 35% sang Rule 3.",
        "Đề xuất mô hình phân loại 2 trục: `intent × source`."
      ],
      actions: [
        "P1: Chuyển taxonomy sang `intent` (define, simplify, deepen, example...) × `source` (current_page, whole_deck...)."
      ]
    },
    {
      id: 5,
      title: "5. Học viên vướng Thuật ngữ tiếng Anh, không vướng tiếng Việt",
      subtitle: "76,8% token bôi đen là tiếng Anh kỹ thuật",
      badge: "UX / Glossary",
      badgeColor: "emerald",
      summary: "Trong 410 lần bôi đen thật, 76,8% là thuật ngữ tiếng Anh: `agent` (44), `model` (31), `gpu` (31), `llm` (23), `context` (22), `latency` (17), `cost` (17). Đồng thời phát hiện nhiễu bôi đen header/footer slide.",
      metrics: [
        { label: "Token tiếng Anh trong Highlight", value: "76,8%" },
        { label: "Top 1 Thuật ngữ (Agent)", value: "44 lần" },
        { label: "Top 2 Thuật ngữ (Model/GPU)", value: "31 lần" },
        { label: "Nhiễu Header Slide", value: "16 bigram" }
      ],
      keyTakeaways: [
        "Học viên dùng bot như một từ điển thuật ngữ chuyên ngành tức thời.",
        "Thuật ngữ bám rất sát chủ đề từng buổi học (Buổi GPU chiếm 35% query về GPU).",
        "Có thể giải quyết phần lớn câu hỏi định nghĩa bằng Tooltip inline mà không cần tốn chi phí gọi LLM."
      ],
      actions: [
        "P1: Tích hợp Glossary / Tooltip inline ngay trên slide cho Top 25 thuật ngữ.",
        "P1: Loại bỏ text layer header/footer slide khỏi vùng chọn được.",
        "P2: Gợi ý 3 từ khóa nóng nhất vào slide mở đầu cho giảng viên."
      ]
    },
    {
      id: 6,
      title: "6. Dồn vào 1/3 đầu Slide & 35% Hỏi lại trang cũ",
      subtitle: "Attention decay hay giảng viên chưa dạy kịp?",
      badge: "Learning Behavior",
      badgeColor: "blue",
      summary: "59,3% câu hỏi rơi vào 1/3 đầu slide, chỉ 13,1% ở 1/3 cuối. 35,2% cặp câu hỏi liên tiếp xảy ra trên cùng một trang slide, cho thấy câu trả lời đầu tiên chưa đủ thỏa mãn.",
      metrics: [
        { label: "Câu hỏi ở 1/3 đầu Slide", value: "59,3%" },
        { label: "Câu hỏi ở 1/3 cuối Slide", value: "13,1%" },
        { label: "Hỏi tiếp trên cùng trang", value: "35,2%" },
        { label: "Trang nóng nhất (Day 3cb)", value: "Trang 6 (27 câu)" }
      ],
      keyTakeaways: [
        "Học viên bị quá tải nhận thức ở nửa sau buổi học hoặc giảng viên lướt nhanh phần cuối.",
        "35,2% hỏi lại trang cũ chứng minh học viên có nhu cầu đào sâu thêm về trang đó.",
        "Trang có ≥10 câu hỏi từ ≥5 học viên là ứng viên cần viết lại nội dung slide."
      ],
      actions: [
        "P1: Log `slide_presented_at` từ phía giảng viên để tách attention decay khỏi 'chưa dạy tới'.",
        "P1: Dashboard 'Trang nóng' gửi giảng viên sau mỗi buổi học.",
        "P2: Chủ động đề xuất nút 'Xem giải thích đầy đủ trang này'."
      ]
    },
    {
      id: 7,
      title: "7. Tương tác nông & Tập trung vào thiểu số",
      subtitle: "47,8% hội thoại 1 lượt và Gini 0,52",
      badge: "Engagement",
      badgeColor: "purple",
      summary: "47,8% hội thoại chỉ có 1 câu hỏi rồi thoát. Top 10% học viên tạo ra 41,6% câu hỏi (Gini 0,52). Nhóm học viên quay lại ≥2 ngày tương tác gấp 3,4 lần nhóm 1 ngày.",
      metrics: [
        { label: "Hội thoại 1 lượt rồi thoát", value: "47,8% (172/360)" },
        { label: "Học viên chỉ hỏi 1 câu", value: "34,5% (89/258)" },
        { label: "Học viên quay lại ≥2 ngày", value: "24,0%" },
        { label: "Hệ số bất bình đẳng Gini", value: "0,52" }
      ],
      keyTakeaways: [
        "Hiện tại hệ thống hoàn toàn MÙ feedback: Không biết 1 lượt là 'đã hiểu ngay' hay 'thất vọng bỏ đi'.",
        "Nhóm user trung thành (quay lại nhiều ngày) tạo giá trị sử dụng cực cao (8,4 câu/user).",
        "Cần nuôi dưỡng và thu hút 76% học viên nhóm 1-ngày."
      ],
      actions: [
        "P0: Bổ sung nút Feedback 👍/👎 + Chip chọn lý do ngay dưới mỗi câu trả lời.",
        "P2: Thiết kế tính năng gợi ý câu hỏi tiếp theo để kích thích hội thoại đa lượt."
      ]
    },
    {
      id: 8,
      title: "8. Trả lời Quá dài (37x) & Nghịch lý Trích dẫn",
      subtitle: "Median 243 từ — Đọc mất 1 phút trong giờ nghe giảng",
      badge: "Answer Quality",
      badgeColor: "amber",
      summary: "Câu trả lời dài gấp 37 lần câu hỏi (median 243 từ). Số lượng trích dẫn `[trang N]` không có tương quan với độ ăn nhập câu hỏi (r = 0,02), trích dẫn chỉ là format compliance.",
      metrics: [
        { label: "Độ dài câu trả lời (Median)", value: "243 từ (p90=369)" },
        { label: "Tỉ lệ lạm phát ký tự", value: "37x (Ref: 42x)" },
        { label: "Tương quan Citation ↔ Cosine", value: "r = 0,02 (Không liên quan)" },
        { label: "Citation lệch >20 trang", value: "4,4% (Nghi vấn bug)" }
      ],
      keyTakeaways: [
        "Đọc câu 243 từ trong lớp làm học viên mất mạch nghe giảng viên giảng.",
        "Số lượng trích dẫn nhiều không đồng nghĩa với câu trả lời đúng trọng tâm.",
        "10% câu trả lời có Cosine QA cực thấp (P10 = 0,015) cần rà soát thủ công."
      ],
      actions: [
        "P0: Đặt ngân sách độ dài theo intent (`define` ≤ 80 từ, `simplify` ≤ 120 từ) + nút 'Kỹ hơn'.",
        "P1: Trích 100 câu cosine thấp nhất để đội ngũ chuyên môn kiểm thử Hallucination."
      ]
    },
    {
      id: 9,
      title: "9. Tín hiệu Chưa hài lòng tập trung vào 'Đơn giản hóa'",
      subtitle: "Retry rate lên tới 20% cho Intent 'Làm đơn giản hơn'",
      badge: "P0 Quality Alert",
      badgeColor: "rose",
      summary: "Retry rate nền là 5,9%. Tuy nhiên, intent 'Đơn giản hóa' thất bại tới 20,0% và 'Xin ví dụ' thất bại 13,8%. Prompt phía sau 2 nút này chưa thực sự thay đổi cách giải thích.",
      metrics: [
        { label: "Retry Rate nền toàn hệ thống", value: "5,9%" },
        { label: "Retry Intent 'Đơn giản hóa'", value: "20,0% ⚠️ (Gấp 3,4x)" },
        { label: "Retry Intent 'Xin ví dụ'", value: "13,8% ⚠️ (Gấp 2,3x)" },
        { label: "Retry Intent 'Tóm tắt'", value: "3,6% (Rất tốt)" }
      ],
      keyTakeaways: [
        "Khi học viên bấm 'Làm đơn giản hơn', bot vẫn giải thích bằng ngôn ngữ trừu tượng kỹ thuật.",
        "Ví dụ bot đưa ra còn chung chung, chưa gắn liền với bài toán thực tế của khóa học.",
        "Đây là điểm fail rõ ràng nhất và có ROI cải thiện cao nhất nếu viết lại prompt."
      ],
      actions: [
        "P0: Viết lại prompt `simplify`: Bắt buộc dùng Analogy đời thường + cấm thuật ngữ thừa + trần 120 từ.",
        "P0: Viết lại prompt `example`: Bắt buộc ví dụ có số liệu cụ thể và ngữ cảnh bài học.",
        "P0: Theo dõi `retry_rate` như KPI chất lượng cốt lõi."
      ]
    },
    {
      id: 10,
      title: "10. Đúng phạm vi nhưng lạnh lùng với Tâm lý học viên",
      subtitle: "60% câu hỏi tâm tư bị từ chối khô cứng",
      badge: "Emotional UX",
      badgeColor: "cyan",
      summary: "60% câu hỏi tâm lý/ngoài lề bị từ chối dạng 'Ngoài phạm vi, hãy liên hệ giảng viên', tạo cảm giác dội ngược khi học viên đang gặp áp lực học tập.",
      metrics: [
        { label: "Từ chối câu hỏi tâm lý", value: "60,0% (3/5 câu)" },
        { label: "Từ chối nhánh Fallback", value: "19,4% (7/36 câu)" },
        { label: "Đẩy sang Giảng viên (Xã giao)", value: "81,0%" },
        { label: "Tổng tỉ lệ Out-of-Scope", value: "2,9%" }
      ],
      keyTakeaways: [
        "Từ chối tư vấn tâm lý chuyên sâu là đúng thiết kế, nhưng cách từ chối đang quá máy móc.",
        "Cần phản hồi đồng cảm, ghi nhận cảm xúc trước khi chuyển hướng hành động học tập."
      ],
      actions: [
        "P1: Thiết kế Escalation Path 3 bước cho `emotional`: Đồng cảm → Gợi ý 1 việc học nhỏ → Cung cấp contact cụ thể."
      ]
    },
    {
      id: 11,
      title: "11. Tải hệ thống bám sát giờ lên lớp",
      subtitle: "79,1% lưu lượng tập trung 8-11h & 14-16h",
      badge: "Infra Capacity",
      badgeColor: "emerald",
      summary: "79,1% câu hỏi dồn vào 2 khung giờ học chính. Phân bố nhịp gõ có 2 đỉnh: Burst hỏi dồn dưới 1 phút (32,7%) và quay lại sau >30 phút (9,2%).",
      metrics: [
        { label: "Khung giờ học (8-11h & 14-16h)", value: "79,1%" },
        { label: "Khung đêm muộn (22h-6h)", value: "6,0%" },
        { label: "Hỏi dồn (Interarrival < 1p)", value: "32,7%" },
        { label: "Ngưỡng cắt Session tối ưu", value: "30 phút" }
      ],
      keyTakeaways: [
        "Hạ tầng cần scale theo giờ học thực tế, không scale theo trung bình ngày.",
        "30 phút là ngưỡng timeout session chuẩn xác nhất dựa trên đường cong ECDF."
      ],
      actions: [
        "P2: Thiết lập cơ chế Auto-scaling và Rate-limit theo giờ cao điểm lớp học."
      ]
    }
  ],

  // Backlog Table (P0, P1, P2)
  backlog: [
    { id: 1, priority: "P0", task: "Feedback 👍/👎 + Chip lý do sau mỗi câu trả lời", reason: "Giải mã 47,8% hội thoại 1 lượt", section: "§7", status: "Ready", impact: "High", effort: "Low" },
    { id: 2, priority: "P0", task: "Enum context_state 3 giá trị + chặn selection echo", reason: "48,1% dataset bị log sai ngữ cảnh", section: "§1", status: "In Progress", impact: "Critical", effort: "Low" },
    { id: 3, priority: "P0", task: "Log prompt_source + preset_id tại client", reason: "Mở khả năng A/B testing preset", section: "§2", status: "Ready", impact: "High", effort: "Low" },
    { id: 4, priority: "P0", task: "Ngân sách độ dài theo intent + nút 'Giải thích kỹ hơn'", reason: "Giảm lạm phát độ dài 37x trong lớp", section: "§8", status: "In Progress", impact: "High", effort: "Medium" },
    { id: 5, priority: "P0", task: "Viết lại prompt 'simplify' & 'example'", reason: "Hạ retry rate 20,0% và 13,8%", section: "§9", status: "Testing", impact: "Critical", effort: "Medium" },
    { id: 6, priority: "P1", task: "Tái thiết kế taxonomy theo intent × source", reason: "Bóc tách 7 nhu cầu trong 3_reference_trang", section: "§4", status: "Planning", impact: "High", effort: "High" },
    { id: 7, priority: "P1", task: "Hạ cấp rule 7_ngu_canh_dai_tu thành cờ needs_coref", reason: "Win rate 0,5% làm nhiễu multi-label", section: "§3", status: "Ready", impact: "Medium", effort: "Low" },
    { id: 8, priority: "P1", task: "Đổi tên fallback thành 0_unclassified + gán nhãn tay 302 dòng", reason: "Đo lường độ mù thật sự 30,2%", section: "§3", status: "Planning", impact: "Medium", effort: "Medium" },
    { id: 9, priority: "P1", task: "Loại bỏ header/footer slide khỏi text layer bôi đen", reason: "Lọc nhiễu template trong highlight", section: "§5", status: "Ready", impact: "Low", effort: "Low" },
    { id: 10, priority: "P1", task: "Glossary / Tooltip inline cho Top 25 thuật ngữ", reason: "Giải quyết 76,8% vướng mắc tiếng Anh", section: "§5", status: "Planning", impact: "High", effort: "Medium" },
    { id: 11, priority: "P1", task: "Log slide_presented_at từ phía giảng viên", reason: "Phân biệt attention decay vs chưa dạy tới", section: "§6", status: "Planning", impact: "Medium", effort: "Medium" },
    { id: 12, priority: "P1", task: "Dashboard 'Trang nóng' gửi giảng viên", reason: "Phát hiện slide cần viết lại", section: "§6", status: "Ready", impact: "Medium", effort: "Low" },
    { id: 13, priority: "P1", task: "Escalation path 3 bước cho intent emotional", reason: "Phản hồi đồng cảm thay vì từ chối lạnh lùng", section: "§10", status: "Ready", impact: "Low", effort: "Low" },
    { id: 14, priority: "P1", task: "Review tay 100 câu có QA cosine similarity thấp nhất", reason: "Đánh giá lỗi Hallucination/Retrieval thực tế", section: "§8", status: "Planning", impact: "High", effort: "Medium" },
    { id: 15, priority: "P1", task: "Chuẩn hóa về 1 schema truyền vùng bôi đen (header)", reason: "Xóa bỏ 2 biến thể UI log phân mảnh", section: "§1", status: "Ready", impact: "Low", effort: "Low" },
    { id: 16, priority: "P2", task: "Rate limit & auto-scale theo giờ lớp học", reason: "79,1% tải dồn vào 5 tiếng", section: "§11", status: "Backlog", impact: "Medium", effort: "Medium" },
    { id: 17, priority: "P2", task: "Gợi ý 'Xem giải thích đầy đủ' khi hỏi lặp cùng trang", reason: "Tối ưu cho 35,2% query cùng trang", section: "§6", status: "Backlog", impact: "Low", effort: "Medium" },
    { id: 18, priority: "P2", task: "Nurture campaign cho nhóm học viên 1-ngày", reason: "Tăng tỷ lệ quay lại từ 24% lên 40%", section: "§7", status: "Backlog", impact: "Medium", effort: "High" },
    { id: 19, priority: "P2", task: "Đưa Top 3 từ khóa nóng mỗi buổi vào slide mở đầu", reason: "Chuẩn bị tâm thế học viên trước buổi học", section: "§5", status: "Backlog", impact: "Low", effort: "Low" }
  ],

  // 12 Slides for Senior Executive Presentation
  slides: [
    {
      id: 1,
      tag: "Executive Summary",
      title: "AI Tutor EDA Insights & Improvement Backlog",
      subtitle: "Phân tích 1.000 lượt tương tác học viên & Lộ trình tối ưu Trợ giảng AI",
      content: `
        <div class="slide-grid-2">
          <div class="glass-box">
            <h3 class="gradient-text">Quy mô Phân tích</h3>
            <ul class="clean-list">
              <li><strong>1.000</strong> lượt hỏi/đáp log thực tế</li>
              <li><strong>258</strong> học viên tham gia tích cực</li>
              <li><strong>360</strong> phiên hội thoại đa lượt</li>
              <li><strong>18</strong> buổi học chuyên sâu (Day Codes)</li>
              <li><strong>6</strong> ngày thu thập (10/08 → 15/08/2026)</li>
            </ul>
          </div>
          <div class="glass-box highlight-border">
            <h3 class="text-rose">3 Phát hiện Cốt lõi (P0)</h3>
            <div class="stat-pill-list">
              <div class="stat-pill"><span class="pill-num">48,1%</span> Context bôi đen bị echo giả (Client log nhầm)</div>
              <div class="stat-pill"><span class="pill-num">20,0%</span> Retry rate khi user xin 'Làm đơn giản hơn'</div>
              <div class="stat-pill"><span class="pill-num">37x</span> Độ dài câu trả lời quá tải trong giờ nghe giảng</div>
            </div>
          </div>
        </div>
      `,
      notes: "Mở đầu báo cáo cho các Senior/Stakeholder: Khái quát quy mô 1.000 log và nhấn mạnh ngay 3 vấn đề kiến trúc cần khắc phục ở mức P0."
    },
    {
      id: 2,
      tag: "Data Scope & Boundaries",
      title: "0. Phạm vi & Giới hạn dữ liệu",
      subtitle: "Báo cáo theo cơ chế, không quy chụp xu hướng thời vụ",
      content: `
        <div class="slide-grid-3">
          <div class="stat-card-mini">
            <div class="stat-title">Tập trung Thời gian</div>
            <div class="stat-big">46,6%</div>
            <div class="stat-desc">Dồn toàn bộ vào ngày 14/08 (162 users)</div>
          </div>
          <div class="stat-card-mini">
            <div class="stat-title">Độ lệch Nhãn</div>
            <div class="stat-big">612 : 1</div>
            <div class="stat-desc">3_reference_trang áp đảo tuyệt đối</div>
          </div>
          <div class="stat-card-mini">
            <div class="stat-title">Bối cảnh Học</div>
            <div class="stat-big">100%</div>
            <div class="stat-desc">Chỉ log trong giờ lên lớp (in_class)</div>
          </div>
        </div>
        <div class="glass-banner mt-3">
          <i data-lucide="info"></i>
          <span><strong>Nguyên tắc đánh giá:</strong> Mọi chỉ số KPI baseline bắt buộc phải phân rã theo từng <code>day_code</code> thay vì lấy trung bình cộng toàn cục.</span>
        </div>
      `,
      notes: "Cảnh báo sớm về tính chất phân bố dữ liệu: 46.6% dồn vào 14/08 nên nếu tính trung bình toàn cục sẽ bị skew."
    },
    {
      id: 3,
      tag: "Architecture & Bug P0",
      title: "1. Tầng thu thập Ngữ cảnh đang bị 'Mù'",
      subtitle: "48,1% ngữ cảnh gửi vào model là bản copy paste của câu hỏi",
      content: `
        <div class="chart-slide-layout">
          <div class="chart-box-slide">
            <canvas id="slideChartContext"></canvas>
          </div>
          <div class="text-box-slide">
            <h4 class="text-rose">Thực trạng Context Capture:</h4>
            <ul>
              <li><strong>40,5%</strong>: Học viên bôi đen thật trên slide.</li>
              <li><strong>48,1%</strong>: Client tự echo câu hỏi vào trường selection.</li>
              <li><strong>10,9%</strong>: Không có ngữ cảnh trang.</li>
              <li><strong>Artifact</strong>: 3 câu hỏi dump toàn bộ HTML/UI do select all.</li>
            </ul>
            <div class="action-badge-box">
              <span class="badge badge-rose">Hành động P0</span>
              <p>Thay cờ nhị phân bằng <code>context_state</code> enum 3 trạng thái và strip selection echo tại client.</p>
            </div>
          </div>
        </div>
      `,
      chartInit: "initSlideContextChart",
      notes: "Lỗ hổng lớn nhất tầng Client: Biến cờ selected_region = yes cho 89% nhưng thực tế gần 1 nửa là echo text câu hỏi."
    },
    {
      id: 4,
      tag: "User Interaction",
      title: "2. 43,4% Câu hỏi là Nút bấm Preset",
      subtitle: "Affordance hoạt động tốt nhưng thiếu định danh A/B test",
      content: `
        <div class="slide-grid-2">
          <div>
            <div class="glass-box">
              <h4>Top Nút Bấm Quick-Action:</h4>
              <div class="bar-stat-row">
                <span>"Giải thích rõ đoạn này giúp mình."</span>
                <span class="bar-val">220 (22,0%)</span>
              </div>
              <div class="bar-stat-row">
                <span>"…thật đơn giản, dễ hiểu"</span>
                <span class="bar-val">34 (3,4%)</span>
              </div>
              <div class="bar-stat-row">
                <span>"Dựa trên tiến độ của mình…"</span>
                <span class="bar-val">21 (2,1%)</span>
              </div>
              <div class="bar-stat-row">
                <span>"…sâu và chi tiết hơn"</span>
                <span class="bar-val">16 (1,6%)</span>
              </div>
            </div>
          </div>
          <div class="glass-box">
            <h4>Hệ quả Phân tích Kỹ thuật:</h4>
            <p>KMeans Silhouette trên TF-IDF chỉ đạt <strong>0,14</strong> vì gần nửa dataset là các chuỗi ký tự trùng lặp giống hệt nhau.</p>
            <div class="action-badge-box mt-3">
              <span class="badge badge-blue">Hành động P0</span>
              <p>Log trực tiếp <code>prompt_source: preset | typed</code> và <code>preset_id</code> từ giao diện người dùng.</p>
            </div>
          </div>
        </div>
      `,
      notes: "Nút bấm preset được học viên dùng rất nhiều, giúp giảm ma sát đặt câu hỏi nhưng cần telemetry để A/B test."
    },
    {
      id: 5,
      tag: "Rule Engine",
      title: "3. Rule Engine: 1 Rule Vô dụng & Fallback 30%",
      subtitle: "Rule 7_ngu_canh_dai_tu khớp 377 lần nhưng chỉ thắng 2 lần (0,5%)",
      content: `
        <div class="chart-slide-layout">
          <div class="chart-box-slide">
            <canvas id="slideChartRuleWinRate"></canvas>
          </div>
          <div class="text-box-slide">
            <h4>Bảng Win Rate Rule Engine:</h4>
            <ul>
              <li><strong>6_tim_slide</strong>: Khớp 304 → Thắng 295 (<strong>97%</strong>)</li>
              <li><strong>4_tu_kiem_tra</strong>: Khớp 35 → Thắng 33 (<strong>94%</strong>)</li>
              <li><strong>3_reference_trang</strong>: Khớp 501 → Thắng 299 (<strong>60%</strong>)</li>
              <li><strong>7_ngu_canh_dai_tu</strong>: Khớp 377 → Thắng 2 (<strong>0,5%</strong>) ⚠️</li>
            </ul>
            <div class="action-badge-box">
              <span class="badge badge-purple">Hành động P1</span>
              <p>Chuyển Rule 7 thành flag <code>needs_coref</code> trong prompt. Đổi tên Fallback 302 dòng thành <code>0_unclassified</code>.</p>
            </div>
          </div>
        </div>
      `,
      chartInit: "initSlideRuleChart",
      notes: "Rule 7 gây nhiễu multi-label vì hầu như luôn bị rule 3 và 6 đè bẹp. Nhánh fallback 302 dòng cần được đo lường đúng nghĩa."
    },
    {
      id: 6,
      tag: "Taxonomy",
      title: "4. Tái cấu trúc Taxonomy theo Ý định học tập",
      subtitle: "3_reference_trang là 'thùng chứa' 7 nhu cầu học khác nhau",
      content: `
        <div class="slide-grid-2">
          <div class="glass-box">
            <h4 class="text-amber">Mô hình Hiện tại (Retrieval-based)</h4>
            <p>Phân loại theo cơ chế lấy dữ liệu:</p>
            <div class="tree-box">
              <code>3_reference_trang (61,2%)</code><br>
              ├── Định nghĩa (109)<br>
              ├── Đơn giản hóa (50)<br>
              ├── Xin ví dụ (29)<br>
              ├── Đào sâu (23)<br>
              ├── So sánh (16)<br>
              └── Tóm tắt (38)
            </div>
            <p class="text-muted text-sm mt-2">→ Tất cả cùng nhận 1 chiến lược prompt trả lời!</p>
          </div>
          <div class="glass-box highlight-border">
            <h4 class="text-emerald">Mô hình Đề xuất (Intent × Source)</h4>
            <p>Phân tách 2 chiều độc lập:</p>
            <div class="schema-box">
              <strong>Intent (Mục tiêu học):</strong><br>
              <code>define | simplify | deepen | example | compare | summarize | locate | progress | quiz</code><br><br>
              <strong>Source (Nguồn tài liệu):</strong><br>
              <code>current_page | whole_deck | cross_day | progress</code>
            </div>
          </div>
        </div>
      `,
      notes: "Chuyển từ taxonomy kỹ thuật sang taxonomy sư phạm (Pedagogical Intent), giúp gán prompt chuyên biệt cho từng loại câu hỏi."
    },
    {
      id: 7,
      tag: "Terminology & UX",
      title: "5. Điểm nghẽn Thuật ngữ tiếng Anh",
      subtitle: "76,8% token bôi đen là tiếng Anh kỹ thuật",
      content: `
        <div class="slide-grid-2">
          <div class="glass-box">
            <h4>Top Thuật ngữ bị Bôi đen nhiều nhất:</h4>
            <div class="word-cloud-badges">
              <span class="tag-badge lg">agent (44)</span>
              <span class="tag-badge lg">model (31)</span>
              <span class="tag-badge lg">gpu (31)</span>
              <span class="tag-badge md">llm (23)</span>
              <span class="tag-badge md">context (22)</span>
              <span class="tag-badge md">latency (17)</span>
              <span class="tag-badge md">cost (17)</span>
              <span class="tag-badge md">serving (16)</span>
              <span class="tag-badge sm">reflexion (15)</span>
              <span class="tag-badge sm">vllm (14)</span>
            </div>
          </div>
          <div class="glass-box">
            <h4>Giải pháp UX Zero-Cost:</h4>
            <div class="solution-card">
              <i data-lucide="zap" class="text-amber"></i>
              <div>
                <strong>Glossary / Tooltip Inline:</strong>
                <p>Hiển thị định nghĩa tức thời khi hover vào 25 thuật ngữ cốt lõi ngay trên slide PDF.</p>
              </div>
            </div>
            <div class="solution-card mt-2">
              <i data-lucide="filter" class="text-cyan"></i>
              <div>
                <strong>Lọc Text Layer Header/Footer:</strong>
                <p>Loại bỏ các cụm chữ template (Viên VinUni, AICB Ngày...) khỏi vùng bắt chữ.</p>
              </div>
            </div>
          </div>
        </div>
      `,
      notes: "Học viên gặp rào cản tiếng Anh chuyên ngành. Có thể giải quyết 70% câu hỏi định nghĩa bằng tooltip mà không cần tốn tiền gọi LLM."
    },
    {
      id: 8,
      tag: "Attention & Navigation",
      title: "6. Dồn tải ở 1/3 đầu Slide & Hỏi lặp lại",
      subtitle: "59,3% câu hỏi rơi vào đầu buổi học — 35,2% hỏi lại cùng trang",
      content: `
        <div class="slide-grid-3">
          <div class="stat-card-mini">
            <div class="stat-title">1/3 Đầu Slide</div>
            <div class="stat-big text-blue">59,3%</div>
            <div class="stat-desc">Tập trung cao độ đầu giờ</div>
          </div>
          <div class="stat-card-mini">
            <div class="stat-title">1/3 Cuối Slide</div>
            <div class="stat-big text-muted">13,1%</div>
            <div class="stat-desc">Attention decay hoặc lướt nhanh</div>
          </div>
          <div class="stat-card-mini">
            <div class="stat-title">Hỏi cùng trang</div>
            <div class="stat-big text-amber">35,2%</div>
            <div class="stat-desc">Cần đào sâu thêm về trang đó</div>
          </div>
        </div>
        <div class="glass-box mt-3">
          <h4>Ứng dụng cho Giảng viên & Hệ thống:</h4>
          <p>• <strong>Dashboard Trang nóng:</strong> Tự động cảnh báo slide có trên 10 câu hỏi từ trên 5 học viên để giảng viên giảng kỹ hơn hoặc biên soạn lại slide.<br>
          • <strong>Chủ động gợi ý:</strong> Với các trang có nhiều lượt hỏi lặp, bot đề xuất nút <em>'Xem giải thích trọn vẹn slide này'</em>.</p>
        </div>
      `,
      notes: "Hiện tượng tập trung đầu bài và hỏi lặp lại trên cùng trang là dữ liệu quý giá giúp hoàn thiện bài giảng."
    },
    {
      id: 9,
      tag: "Engagement & Gini",
      title: "7. Độ sâu Tương tác & Lỗ hổng Feedback",
      subtitle: "47,8% phiên hội thoại 1 lượt — Top 10% user tạo 41,6% câu hỏi",
      content: `
        <div class="slide-grid-2">
          <div class="glass-box">
            <h4>Phân khúc Học viên:</h4>
            <ul>
              <li><strong>47,8%</strong> hội thoại chỉ hỏi 1 câu rồi dừng.</li>
              <li><strong>34,5%</strong> học viên chỉ hỏi đúng 1 câu duy nhất.</li>
              <li><strong>24,0%</strong> học viên quay lại từ 2 ngày trở lên.</li>
              <li>Nhóm quay lại dùng gấp <strong>3,4 lần</strong> nhóm 1 ngày (8,4 vs 2,4 câu/user).</li>
            </ul>
          </div>
          <div class="glass-box highlight-border">
            <h4 class="text-rose">Lỗ hổng Đo lường Lớn nhất:</h4>
            <p>Hệ thống hiện tại <strong>hoàn toàn không có nút đánh giá</strong>. Không thể biết 47,8% rời đi là vì <em>'Đã hiểu ngay'</em> hay <em>'Thất vọng vì trả lời dở'</em>.</p>
            <div class="action-badge-box">
              <span class="badge badge-rose">Hành động P0</span>
              <p>Thêm widget đánh giá 👍 / 👎 kèm 4 chip lý do: <code>Chưa hiểu | Sai | Quá dài | Không liên quan</code>.</p>
            </div>
          </div>
        </div>
      `,
      notes: "Không có rating thì mọi tối ưu chất lượng chỉ là phỏng đoán. Nút feedback 👍/👎 là ưu tiên P0 số một."
    },
    {
      id: 10,
      tag: "Cognitive Load",
      title: "8. Lạm phát Độ dài (37x) & Nghịch lý Trích dẫn",
      subtitle: "Median câu trả lời 243 từ — r = 0,02 giữa Citation và Relevance",
      content: `
        <div class="slide-grid-2">
          <div class="glass-box">
            <h4 class="text-amber">Lạm phát Độ dài:</h4>
            <div class="compare-row">
              <div><strong>Câu hỏi học viên:</strong> ~6 - 15 từ</div>
              <div><strong>Câu trả lời của Bot:</strong> <span class="text-rose">243 từ (37x)</span></div>
            </div>
            <p class="text-sm text-muted mt-2">Học viên mất 60 giây để đọc hết câu trả lời trong khi giảng viên vẫn đang nói trên lớp → Quá tải nhận thức!</p>
          </div>
          <div class="glass-box">
            <h4 class="text-cyan">Nghịch lý Trích dẫn:</h4>
            <p>86,1% câu trả lời có trích dẫn <code>[trang N]</code> nhưng tương quan giữa số lượng trích dẫn và độ liên quan ngữ nghĩa chỉ đạt <strong>r = 0,02</strong>.</p>
            <p class="text-sm">→ Trích dẫn nhiều là <em>Format Compliance</em>, không phản ánh độ chính xác nội dung.</p>
          </div>
        </div>
        <div class="action-badge-box mt-3">
          <span class="badge badge-emerald">Hành động P0</span>
          <p>Áp đặt ngân sách từ: <code>define</code> ≤ 80 từ; <code>simplify</code> ≤ 120 từ. Bổ sung nút <em>'Giải thích chi tiết hơn'</em> cho ai muốn đọc sâu.</p>
        </div>
      `,
      notes: "Cắt giảm độ dài câu trả lời là chìa khóa để học viên vừa theo dõi bài giảng vừa tra cứu trợ giảng."
    },
    {
      id: 11,
      tag: "Failure Point P0",
      title: "9. Điểm Fail rõ nhất: Intent 'Đơn giản hóa' (20% Retry)",
      subtitle: "User bấm nút xin giải thích dễ hiểu nhưng bot vẫn trả lời khó hiểu",
      content: `
        <div class="chart-slide-layout">
          <div class="chart-box-slide">
            <canvas id="slideChartRetry"></canvas>
          </div>
          <div class="text-box-slide">
            <h4>Tỉ lệ Retry theo Ý định:</h4>
            <ul>
              <li><strong class="text-rose">Đơn giản hóa</strong>: <strong>20,0%</strong> retry ⚠️</li>
              <li><strong class="text-rose">Xin ví dụ</strong>: <strong>13,8%</strong> retry ⚠️</li>
              <li><strong>So sánh</strong>: 6,2% retry</li>
              <li><strong>Định nghĩa</strong>: 5,5% retry</li>
              <li><strong>Tóm tắt</strong>: 3,6% retry</li>
            </ul>
            <div class="action-badge-box">
              <span class="badge badge-rose">Hành động P0</span>
              <p>Viết lại prompt <code>simplify</code> (bắt buộc dùng phép ẩn dụ đời thường) và <code>example</code> (ví dụ có số liệu thực tế).</p>
            </div>
          </div>
        </div>
      `,
      chartInit: "initSlideRetryChart",
      notes: "Dữ liệu retry chứng minh rõ nét: Học viên bấm 'Làm đơn giản hơn' nhưng vẫn phải hỏi lại vì prompt chưa đổi độ trừu tượng."
    },
    {
      id: 12,
      tag: "Roadmap & Action Plan",
      title: "10. Lộ trình Thực thi & KPI Mục tiêu",
      subtitle: "5 Đầu việc P0 triển khai ngay trong Sprint tới",
      content: `
        <div class="backlog-mini-grid">
          <div class="backlog-card p0">
            <div class="p-tag">P0-1</div>
            <div class="p-title">Widget Feedback 👍/👎</div>
            <div class="p-desc">Thêm nút chấm điểm kèm 4 chip lý do sau mỗi câu trả lời.</div>
          </div>
          <div class="backlog-card p0">
            <div class="p-tag">P0-2</div>
            <div class="p-title">Sửa Context Capture</div>
            <div class="p-desc">Enum 3 trạng thái + chặn echo selection tại client.</div>
          </div>
          <div class="backlog-card p0">
            <div class="p-tag">P0-3</div>
            <div class="p-title">Ngân sách Độ dài Prompt</div>
            <div class="p-desc">Siết độ dài define ≤80 từ, simplify ≤120 từ + nút mở rộng.</div>
          </div>
          <div class="backlog-card p0">
            <div class="p-tag">P0-4</div>
            <div class="p-title">Viết lại Prompt Simplify & Example</div>
            <div class="p-desc">Đưa analogy đời thường và số liệu cụ thể vào prompt.</div>
          </div>
        </div>
        <div class="kpi-target-banner mt-3">
          <h4>🎯 KPI Mục tiêu sau tối ưu:</h4>
          <div class="kpi-target-row">
            <span>Retry Rate Simplify: <strong class="text-rose">20% → <8%</strong></span>
            <span>Tỉ lệ mù Context: <strong class="text-rose">48,1% → 0%</strong></span>
            <span>Độ dài Median: <strong class="text-amber">243 từ → 110 từ</strong></span>
            <span>Hội thoại ≥2 lượt: <strong class="text-emerald">52,2% → >70%</strong></span>
          </div>
        </div>
      `,
      notes: "Slide chốt lộ trình hành động P0 và cam kết KPI rõ ràng cho ban lãnh đạo và tech lead."
    }
  ],

  // Sample Q&A for live inspector
  sampleQuestions: [
    { id: "ded994db", label: "3_reference_trang", intent: "define", page: 41, selection: "middleware", question: "Giải thích rõ đoạn này giúp mình.", answerWords: 218, citationCount: 6, similarity: 0.28, retry: false },
    { id: "6d9913db", label: "3_reference_trang", intent: "deepen", page: 9, selection: "ReAct struggle với multi-hop reasoning", question: "Giải thích rõ đoạn này giúp mình.", answerWords: 195, citationCount: 5, similarity: 0.32, retry: false },
    { id: "634af2d1", label: "3_reference_trang", intent: "define", page: 9, selection: "Reflexion.", question: "Giải thích rõ đoạn này giúp mình.", answerWords: 165, citationCount: 4, similarity: 0.25, retry: false },
    { id: "aa02b273", label: "6_tim_slide", intent: "locate", page: 17, selection: "macos có tải slide xuống để ôn tập ko ạ", question: "macos có tải slide xuống để ôn tập ko ạ", answerWords: 68, citationCount: 0, similarity: 0.08, retry: false },
    { id: "9d518734", label: "6_tim_slide", intent: "summarize", page: 30, selection: "giải thích trang 30", question: "giải thích trang 30", answerWords: 242, citationCount: 8, similarity: 0.19, retry: false },
    { id: "41118a40", label: "6_tim_slide", intent: "summarize", page: 27, selection: "giải thichs slide 27", question: "giải thichs slide 27", answerWords: 256, citationCount: 9, similarity: 0.22, retry: false },
    { id: "1ea2b460", label: "3_reference_trang", intent: "define", page: 2, selection: "dedup", question: "Giải thích rõ đoạn này giúp mình.", answerWords: 184, citationCount: 5, similarity: 0.30, retry: false },
    { id: "62711a52", label: "3_reference_trang", intent: "simplify", page: 7, selection: "overload", question: "Giải thích rõ đoạn này giúp mình.", answerWords: 178, citationCount: 4, similarity: 0.21, retry: true },
    { id: "6062ea9c", label: "3_reference_trang", intent: "example", page: 6, selection: "Lookup(X)", question: "Giải thích rõ đoạn này giúp mình.", answerWords: 192, citationCount: 4, similarity: 0.24, retry: true },
    { id: "887d6cf0", label: "6_tim_slide", intent: "summarize", page: 22, selection: "Best Practices", question: "Giải thích rõ đoạn này giúp mình.", answerWords: 210, citationCount: 5, similarity: 0.26, retry: false }
  ]
};
