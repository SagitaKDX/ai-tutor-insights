// AI Tutor EDA Insights & Slide Presentation Data - Tiếng Việt Chuẩn Hóa & Dễ Hiểu
window.AI_TUTOR_DATA = {
  overview: {
    title: "AI Tutor — Báo Cáo Phân Tích Dữ Liệu & Lộ Trình Cải Tiến Trợ Giảng AI",
    subtitle: "Phân tích 1.000 lượt hỏi đáp thực tế của 258 học viên nhằm phát hiện điểm nghẽn kiến trúc và nâng cao chất lượng trợ giảng trong lớp học",
    source: "labeled_semantic.csv",
    timeWindow: "10/08/2026 → 15/08/2026 (6 ngày học liên tục)",
    metrics: [
      { id: "total_queries", label: "Tổng lượt Hỏi / Đáp", value: "1.000", change: "100% hỏi trong giờ học", icon: "message-square", color: "blue" },
      { id: "total_users", label: "Số Học Viên Tương Tác", value: "258", change: "Top 10% học viên chiếm 41,6% câu hỏi", icon: "users", color: "purple" },
      { id: "total_convs", label: "Phiên Hội Thoại", value: "360", change: "47,8% học viên chỉ hỏi đúng 1 câu rồi rời đi", icon: "git-branch", color: "cyan" },
      { id: "total_days", label: "Mã Buổi Học (Day Codes)", value: "18", change: "46,6% dồn vào ngày cao điểm 14/08", icon: "calendar", color: "amber" },
      { id: "echo_rate", label: "Lỗi Lặp Câu Hỏi (Context Echo)", value: "48,1%", change: "Lỗi P0: Client copy nhầm câu hỏi vào ngữ cảnh", icon: "alert-triangle", color: "rose" },
      { id: "retry_simplify", label: "Thất Bại Khi Xin 'Làm Dễ Hiểu'", value: "20,0%", change: "Cao gấp 3,4 lần mức nền (5,9%)", icon: "refresh-cw", color: "emerald" }
    ]
  },

  // 11 Chuyên Đề Phân Tích Chuyên Sâu (Tiếng Việt Rõ Ràng & Trực Quan)
  chapters: [
    {
      id: 0,
      title: "0. Phạm Vi & Giới Hạn Dữ Liệu Cần Biết",
      subtitle: "Hiểu đúng bối cảnh dữ liệu trước khi kết luận số liệu",
      badge: "Giới hạn dữ liệu",
      badgeColor: "amber",
      summary: "Dữ liệu gồm 1.000 câu hỏi thu thập trong 6 ngày, trong đó 46,6% dồn vào ngày 14/08 và 100% diễn ra trong lớp học (in_class). Số liệu phản ánh rất tốt hành vi tương tác và cơ chế kỹ thuật, nhưng chưa đại diện cho việc tự học ở nhà.",
      metrics: [
        { label: "Thời gian theo dõi", value: "6 ngày liên tiếp" },
        { label: "Ngày cao điểm (14/08)", value: "46,6% tổng số câu" },
        { label: "Độ lệch nhãn (Nhãn 3 vs 8)", value: "612 : 1 (Cực lệch)" },
        { label: "Nhánh Fallback chưa phân loại", value: "30,2% (302 câu)" }
      ],
      keyTakeaways: [
        "Không được lấy điểm chính xác trung bình (Accuracy) do nhãn bị lệch quá lớn (612:1).",
        "Số liệu trung bình toàn cục bị kéo theo ngày 14/08 $\to$ Bắt buộc phải chia nhỏ theo từng buổi học (`day_code`).",
        "Toàn bộ 1.000 câu hỏi đều trong bối cảnh lớp học $\to$ Học viên cần câu trả lời cực ngắn để không mất mạch nghe giảng."
      ],
      actions: ["Đo lường KPI phân rã theo từng buổi học (day_code) thay vì tính trung bình chung."]
    },
    {
      id: 1,
      title: "1. Lỗi Thu Thập Ngữ Cảnh: 48,1% Bị Lặp Câu Hỏi Giả",
      subtitle: "Hệ thống tưởng học viên bôi đen slide, nhưng thực ra client tự copy câu hỏi vào",
      badge: "Lỗi P0 Cực Nghiêm Trọng",
      badgeColor: "rose",
      summary: "Cột `selected_region` báo 'Có bôi đen' ở 891/1.000 dòng. Tuy nhiên khi soi kỹ nội dung, có tới 481 dòng (48,1%) chỉ là giao diện client tự copy lại câu hỏi của học viên gán vào phần bôi đen. LLM nhận prompt giải thích chính câu hỏi thay vì giải thích kiến thức trên slide.",
      metrics: [
        { label: "Bôi đen thật trên slide", value: "405 câu (40,5%)" },
        { label: "Lỗi lặp lại câu hỏi (Echo)", value: "481 câu (48,1%) ⚠️" },
        { label: "Không có ngữ cảnh slide", value: "109 câu (10,9%)" },
        { label: "Lỗi chọn nhầm cả giao diện HTML", value: "5 câu (0,5%)" }
      ],
      keyTakeaways: [
        "Biến cờ nhị phân (Yes/No) đang làm mù 48% dữ liệu ngữ cảnh thực tế.",
        "Học viên vô tình bấm Ctrl+A làm hệ thống nuốt luôn toàn bộ code HTML của trang web.",
        "Hệ thống đang có 2 định dạng truyền dữ liệu khác nhau gây phân mảnh xử lý."
      ],
      actions: [
        "P0: Đổi cờ dữ liệu sang 3 trạng thái rõ ràng: `highlight` (Bôi đen thật) | `page_only` (Chỉ có số trang) | `no_context` (Không có ngữ cảnh).",
        "P0: Chặn lỗi lặp: Nếu đoạn bôi đen trùng với câu hỏi $\to$ Tự động chuyển về `page_only`.",
        "P0: Cắt độ dài tối đa 1.500 ký tự và lọc bỏ rác giao diện web trước khi gửi cho LLM."
      ]
    },
    {
      id: 2,
      title: "2. 43,4% Câu Hỏi Là Nút Bấm Gợi Ý Có Sẵn (Preset)",
      subtitle: "Nút bấm nhanh giúp học viên đỡ phải gõ, nhưng cần phân biệt với câu tự gõ",
      badge: "Tương tác người dùng",
      badgeColor: "blue",
      summary: "434/1.000 câu hỏi sinh ra từ các nút bấm nhanh (Quick-Action). Riêng nút 'Giải thích rõ đoạn này giúp mình.' chiếm tới 220 câu (22%). Điều này làm các thuật toán phân cụm chủ đề bị sai lệch vì gặp quá nhiều chuỗi ký tự trùng lặp.",
      metrics: [
        { label: "Câu hỏi từ nút bấm gợi ý", value: "434 câu (43,4%)" },
        { label: "Nút 'Giải thích rõ đoạn này...'", value: "220 câu (22,0%)" },
        { label: "Câu hỏi học viên tự gõ tay", value: "566 câu (56,6%)" },
        { label: "Điểm phân cụm KMeans", value: "0,14 (Thấp do trùng chuỗi)" }
      ],
      keyTakeaways: [
        "Nút bấm gợi ý là công cụ tuyệt vời giúp học viên thao tác nhanh mà không tốn công gõ phím.",
        "Cần tách riêng phân tích dữ liệu giữa 'câu tự gõ' và 'nút bấm gợi ý' để không làm sai lệch kết quả.",
        "Hiện tại hệ thống chưa lưu mã định danh `preset_id` nên chưa đo được nút nào hiệu quả nhất."
      ],
      actions: [
        "P0: Ghi nhận thêm 2 trường dữ liệu tại client: `prompt_source` (preset / typed) và `preset_id`.",
        "P0: Đo tỷ lệ bấm và tỷ lệ hỏi lại của từng nút để loại bỏ nút kém, thêm nút hữu ích."
      ]
    },
    {
      id: 3,
      title: "3. Bộ Quy Tắc Phân Loại: 1 Rule Vô Tác Dụng & 30% Rơi Vào Fallback",
      subtitle: "Rule 7 khớp 377 lần nhưng chỉ thắng 2 lần (0,5%) — 302 câu bị đẩy vào nhánh mù",
      badge: "Bộ Quy Tắc (Rule Engine)",
      badgeColor: "purple",
      summary: "Quy tắc `7_ngu_canh_dai_tu` (Đại từ chỉ định: nó, cái đó, phần này) khớp tới 377 lần nhưng chỉ thắng đúng 2 lần (0,5%) vì hầu như luôn bị Rule 3 và Rule 6 đè bẹp. Ngược lại, có tới 302 câu (30,2%) không khớp bất kỳ rule nào và bị dồn vào nhánh Fallback với tỷ lệ trả lời lạc đề cao nhất (19,4%).",
      metrics: [
        { label: "Tỷ lệ thắng Rule 6 (Tìm slide)", value: "97,0% (295 / 304 lần)" },
        { label: "Tỷ lệ thắng Rule 4 (Tự kiểm tra)", value: "94,0% (33 / 35 lần)" },
        { label: "Tỷ lệ thắng Rule 7 (Đại từ)", value: "0,5% (2 / 377 lần) ⚠️" },
        { label: "Số câu rơi vào Fallback mù", value: "302 câu (30,2%)" }
      ],
      keyTakeaways: [
        "Rule 7 tạo ra gán nhãn đa tầng giả tạo, gây phức tạp hóa hệ thống mà không mang lại giá trị.",
        "Nhãn `2_noi_dung_bai_hoc` thực chất đang bị biến thành 'thùng rác chứa câu chưa phân loại'.",
        "Bộ phân giải ưu tiên hoạt động tốt, nhưng định nghĩa các rule cần được viết lại chuẩn xác hơn."
      ],
      actions: [
        "P1: Hạ cấp Rule 7 thành cờ boolean `needs_coref: bool` (cần giải quyết đại từ) trong câu lệnh prompt.",
        "P1: Đổi tên nhánh Fallback thành `0_unclassified` (Chưa phân loại) để giám sát độ mù thật sự.",
        "P1: Gán nhãn thủ công cho 302 câu Fallback để tìm thêm các nhóm nhu cầu mới."
      ]
    },
    {
      id: 4,
      title: "4. Danh Mục Nhãn Chưa Phản Ánh Đúng Ý Định Học Tập",
      subtitle: "Nhãn 3_reference_trang đang chứa tới 7 nhu cầu học tập hoàn toàn khác nhau",
      badge: "Tái Cấu Trúc Danh Mục",
      badgeColor: "cyan",
      summary: "Nhãn `3_reference_trang` chiếm tới 61,2% toàn bộ dữ liệu, nhưng bên trong nó chứa 7 nhu cầu học tập riêng biệt: Định nghĩa, Làm đơn giản, Đào sâu, Xin ví dụ, So sánh, Tóm tắt và Giải thích. Việc dùng chung 1 prompt cho cả 7 nhu cầu này khiến bot không đáp ứng đúng kỳ vọng của học viên.",
      metrics: [
        { label: "Yêu cầu giải thích đoạn chọn", value: "345 câu" },
        { label: "Câu hỏi chưa rõ ý định", value: "301 câu (30%)" },
        { label: "Yêu cầu định nghĩa khái niệm", value: "109 câu" },
        { label: "Yêu cầu tóm tắt bài giảng", value: "110 câu" }
      ],
      keyTakeaways: [
        "Hệ thống hiện tại phân loại theo 'cách lấy dữ liệu' (Retrieval) chứ không theo 'mục tiêu học tập' (Pedagogy).",
        "Nhu cầu 'Tóm tắt' đang bị xé lẻ: 56% rơi vào Rule 6 và 35% rơi vào Rule 3.",
        "Cần chuyển sang mô hình phân loại 2 chiều: `Ý định học (Intent)` × `Nguồn tài liệu (Source)`."
      ],
      actions: [
        "P1: Tách danh mục phân loại thành 2 trục: Ý định (`define`, `simplify`, `deepen`, `example`...) × Nguồn (`current_page`, `whole_deck`...)."
      ]
    },
    {
      id: 5,
      title: "5. Điểm Nghẽn Thuật Ngữ Tiếng Anh Chuyên Ngành",
      subtitle: "76,8% lượt bôi đen là thuật ngữ tiếng Anh kỹ thuật AI / LLM",
      badge: "Trải Nghiệm & Thuật Ngữ",
      badgeColor: "emerald",
      summary: "Trong 410 lần bôi đen thật trên slide, có tới 76,8% là các thuật ngữ tiếng Anh chuyên ngành như: `agent` (44 lần), `model` (31), `gpu` (31), `llm` (23), `context` (22), `latency` (17), `cost` (17). Học viên đang dùng bot như một cuốn từ điển thuật ngữ nhanh.",
      metrics: [
        { label: "Tỷ lệ từ tiếng Anh khi bôi đen", value: "76,8%" },
        { label: "Từ khóa hỏi nhiều nhất: Agent", value: "44 lần" },
        { label: "Từ khóa Model & GPU", value: "31 lần mỗi từ" },
        { label: "Rác bôi đen trúng Header slide", value: "16 trường hợp" }
      ],
      keyTakeaways: [
        "Học viên gặp rào cản lớn nhất ở các thuật ngữ kỹ thuật mới.",
        "Thuật ngữ bám rất sát nội dung bài (Buổi học về GPU có tới 35% câu hỏi liên quan đến GPU).",
        "Có thể giải quyết hơn 70% câu hỏi định nghĩa thuật ngữ bằng tính năng Tooltip giải nghĩa ngay trên slide mà không tốn tiền gọi API LLM."
      ],
      actions: [
        "P1: Tích hợp bảng giải nghĩa Tooltip / Glossary tức thì ngay trên slide PDF cho Top 25 thuật ngữ phổ biến.",
        "P1: Lọc bỏ lớp chữ Header/Footer của slide để học viên không bôi đen nhầm tiêu đề mẫu.",
        "P2: Đưa Top 3 từ khóa nóng vào slide mở đầu mỗi buổi để giảng viên nhấn mạnh trước."
      ]
    },
    {
      id: 6,
      title: "6. Dồn Tải Ở 1/3 Đầu Slide & 35% Hỏi Lặp Lại Cùng Trang",
      subtitle: "Học viên bị quá tải nhận thức ở nửa sau hoặc giảng viên chưa kịp giảng tới",
      badge: "Hành Vi Học Tập",
      badgeColor: "blue",
      summary: "59,3% câu hỏi tập trung ở 1/3 số trang đầu của bài giảng, chỉ 13,1% ở 1/3 cuối. Có tới 35,2% các cặp câu hỏi liên tiếp diễn ra trên cùng một trang slide, chứng tỏ câu trả lời đầu tiên của bot chưa làm học viên thỏa mãn hoàn toàn.",
      metrics: [
        { label: "Câu hỏi ở 1/3 đầu slide", value: "59,3%" },
        { label: "Câu hỏi ở 1/3 cuối slide", value: "13,1%" },
        { label: "Hỏi tiếp trên cùng 1 trang", value: "35,2%" },
        { label: "Trang nóng nhất (Buổi 3cb)", value: "Trang 6 (27 câu hỏi)" }
      ],
      keyTakeaways: [
        "Học viên bị đuối sức về cuối buổi học hoặc giảng viên lướt nhanh phần sau.",
        "Hiện tượng hỏi lặp lại trên cùng một trang cho thấy trang slide đó chứa kiến thức khó hiểu hoặc câu trả lời trước của bot chưa rõ.",
        "Những trang có từ 10 câu hỏi từ 5 học viên trở lên là tín hiệu cần viết lại nội dung slide đó."
      ],
      actions: [
        "P1: Ghi nhận thời điểm giảng viên chuyển trang (`slide_presented_at`) để biết học viên hỏi trước hay hỏi sau khi nghe giảng.",
        "P1: Tự động gửi báo cáo 'Trang slide có nhiều thắc mắc nhất' cho giảng viên sau mỗi buổi học.",
        "P2: Chủ động đề xuất nút 'Xem giải thích đầy đủ toàn bộ trang này'."
      ]
    },
    {
      id: 7,
      title: "7. Tương Tác Nông: 47,8% Hỏi 1 Câu Rồi Rời Đi & Lỗ Hổng Feedback",
      subtitle: "Hệ thống đang hoàn toàn mù đánh giá — Không biết học viên hài lòng hay thất vọng bỏ đi",
      badge: "Mức Độ Gắn Kết",
      badgeColor: "purple",
      summary: "47,8% phiên hội thoại chỉ diễn ra đúng 1 câu hỏi rồi dừng lại. Top 10% học viên tích cực tạo ra tới 41,6% tổng số câu hỏi (Hệ số Gini 0,52). Nhóm học viên quay lại từ 2 ngày trở lên hỏi nhiều gấp 3,4 lần nhóm chỉ học 1 ngày.",
      metrics: [
        { label: "Hội thoại chỉ hỏi 1 câu rồi thoát", value: "47,8% (172 / 360 phiên)" },
        { label: "Học viên chỉ hỏi đúng 1 câu", value: "34,5% (89 / 258 người)" },
        { label: "Học viên quay lại từ 2 ngày", value: "24,0%" },
        { label: "Hệ số chênh lệch tương tác (Gini)", value: "0,52 (Khá cao)" }
      ],
      keyTakeaways: [
        "Lỗ hổng lớn nhất: Hệ thống không có nút đánh giá 👍/👎 nên không thể biết học viên rời đi vì 'Đã hiểu bài' hay 'Thất vọng vì bot trả lời dở'.",
        "Nhóm học viên trung thành (học nhiều ngày) tạo ra giá trị sử dụng rất lớn (trung bình 8,4 câu hỏi/người).",
        "Cần có cơ chế khuyến khích và giữ chân 76% học viên mới chỉ tương tác 1 ngày."
      ],
      actions: [
        "P0: Bổ sung ngay nút chấm điểm 👍/👎 kèm 4 lý do nhanh: `Chưa hiểu | Sai kiến thức | Quá dài | Lạc đề`.",
        "P2: Gợi ý các câu hỏi đào sâu tiếp theo để kích thích học viên trò chuyện đa lượt."
      ]
    },
    {
      id: 8,
      title: "8. Lạm Phát Độ Dài 37 Lần & Nghịch Lý Trích Dẫn Trang",
      subtitle: "Bot trả lời trung bình 243 từ — Học viên mất cả phút để đọc trong khi giảng viên đang nói",
      badge: "Chất Lượng Câu Trả Lời",
      badgeColor: "amber",
      summary: "Câu hỏi của học viên rất ngắn (6-15 từ), nhưng bot trả về câu trả lời dài gấp 37 lần (trung bình 243 từ, nhiều câu lên tới 369 từ). Việc trích dẫn số trang `[trang N]` chỉ là tuân thủ định dạng chứ không đồng nghĩa với việc trả lời đúng trọng tâm (hệ số tương quan r = 0,02).",
      metrics: [
        { label: "Độ dài câu trả lời trung bình", value: "243 từ (Mất 60s để đọc)" },
        { label: "Tỷ lệ lạm phát độ dài", value: "37 lần so với câu hỏi" },
        { label: "Tương quan Trích dẫn ↔ Đúng ý", value: "r = 0,02 (Gần như không liên quan)" },
        { label: "Trích dẫn lệch quá 20 trang", value: "4,4% (Nghi vấn lỗi trích xuất)" }
      ],
      keyTakeaways: [
        "Đọc một đoạn văn 243 từ trong lớp làm học viên bị phân tâm, không theo kịp lời giảng viên trên bục giảng.",
        "Trích dẫn nhiều trang không phản ánh chất lượng câu trả lời.",
        "10% câu trả lời có độ liên quan ngữ nghĩa rất thấp cần được rà soát lỗi ảo giác (Hallucination)."
      ],
      actions: [
        "P0: Giới hạn ngân sách độ dài theo từng loại câu hỏi: Định nghĩa `define` ≤ 80 từ; Làm dễ hiểu `simplify` ≤ 120 từ. Thêm nút 'Xem chi tiết hơn' nếu muốn đọc sâu.",
        "P1: Kiểm tra thủ công 100 câu trả lời có độ tương đồng thấp nhất để đo lường lỗi ảo giác."
      ]
    },
    {
      id: 9,
      title: "9. Điểm Thất Bại Rõ Nhất: Nút 'Làm Đơn Giản Hơn' Có Tỷ Lệ Hỏi Lại 20%",
      subtitle: "Học viên bấm nút xin giải thích dễ hiểu, nhưng bot vẫn trả lời bằng từ ngữ khó hiểu",
      badge: "Báo Động Chất Lượng P0",
      badgeColor: "rose",
      summary: "Tỷ lệ hỏi lại (Retry Rate) trung bình toàn hệ thống là 5,9%. Tuy nhiên, khi học viên bấm nút 'Làm đơn giản hơn', tỷ lệ thất bại vọt lên tới 20,0% và nút 'Xin ví dụ cụ thể' thất bại 13,8%. Prompt phía sau 2 nút này chưa thực sự thay đổi cách tiếp cận sư phạm.",
      metrics: [
        { label: "Tỷ lệ hỏi lại trung bình toàn hệ thống", value: "5,9%" },
        { label: "Tỷ lệ hỏi lại khi xin 'Làm đơn giản'", value: "20,0% ⚠️ (Gấp 3,4 lần)" },
        { label: "Tỷ lệ hỏi lại khi xin 'Ví dụ cụ thể'", value: "13,8% ⚠️ (Gấp 2,3 lần)" },
        { label: "Tỷ lệ hỏi lại khi xin 'Tóm tắt'", value: "3,6% (Rất tốt)" }
      ],
      keyTakeaways: [
        "Khi học viên kêu khó hiểu, bot vẫn dùng các định nghĩa trừu tượng kỹ thuật để giải thích.",
        "Ví dụ bot đưa ra còn chung chung, chưa gắn liền với bài tập thực tế trong lớp học.",
        "Đây là điểm yếu rõ ràng nhất nhưng cũng có tiềm năng cải thiện hiệu quả cao nhất khi viết lại prompt."
      ],
      actions: [
        "P0: Viết lại prompt cho `simplify`: Bắt buộc dùng phép ẩn dụ (Analogy) đời thường + Cấm dùng thuật ngữ thừa + Giới hạn 120 từ.",
        "P0: Viết lại prompt cho `example`: Bắt buộc đưa ví dụ có số liệu cụ thể và ngữ cảnh bài học.",
        "P0: Theo dõi tỷ lệ hỏi lại `retry_rate` như chỉ số KPI chất lượng cốt lõi."
      ]
    },
    {
      id: 10,
      title: "10. Đúng Quy Trình Nhưng Lạnh Lùng Với Cảm Xúc Của Học Viên",
      subtitle: "60% câu hỏi tâm tư ngoài lề bị từ chối một cách máy móc, gây cụt hứng",
      badge: "Trải Nghiệm Tâm Lý",
      badgeColor: "cyan",
      summary: "60% các câu hỏi chia sẻ áp lực hoặc hỏi ngoài lề bị bot từ chối bằng các câu khô cứng như 'Ngoài phạm vi hỗ trợ, hãy liên hệ giảng viên', tạo cảm giác dội ngược khi học viên đang gặp khó khăn trong học tập.",
      metrics: [
        { label: "Từ chối câu hỏi tâm lý học tập", value: "60,0% (3 / 5 câu)" },
        { label: "Từ chối ở nhánh Fallback", value: "19,4% (7 / 36 câu)" },
        { label: "Chuyển hướng sang giảng viên", value: "81,0%" },
        { label: "Tổng tỷ lệ câu hỏi ngoài phạm vi", value: "2,9%" }
      ],
      keyTakeaways: [
        "Từ chối tư vấn tâm lý chuyên sâu là đúng chức năng, nhưng cách phản hồi đang quá cứng nhắc.",
        "Cần phản hồi đồng cảm, khích lệ tinh thần trước khi gợi ý một hành động học tập nhỏ."
      ],
      actions: [
        "P1: Thiết kế quy trình phản hồi 3 bước cho câu hỏi tâm lý: Lắng nghe đồng cảm $\to$ Gợi ý 1 bước học tập nhỏ $\to$ Cung cấp thông tin liên hệ hỗ trợ."
      ]
    },
    {
      id: 11,
      title: "11. Lưu Lượng Tải Dồn Theo Khung Giờ Lên Lớp",
      subtitle: "79,1% câu hỏi tập trung vào 2 ca học: 8h-11h sáng và 14h-16h chiều",
      badge: "Hạ Tầng & Khả Năng Chịu Tải",
      badgeColor: "emerald",
      summary: "79,1% lưu lượng câu hỏi dồn vào đúng 5 tiếng học chính trên lớp. Phân bố thời gian cho thấy 32,7% câu hỏi đến dồn dập trong vòng dưới 1 phút (hỏi liên tiếp), và 30 phút là khoảng thời gian lý tưởng để ngắt một phiên làm việc (session timeout).",
      metrics: [
        { label: "Lưu lượng trong giờ học (8-11h & 14-16h)", value: "79,1%" },
        { label: "Lưu lượng đêm muộn (22h - 6h)", value: "6,0%" },
        { label: "Hỏi dồn dập (Dưới 1 phút)", value: "32,7%" },
        { label: "Ngưỡng ngắt phiên tối ưu", value: "30 phút" }
      ],
      keyTakeaways: [
        "Hạ tầng máy chủ cần tự động tăng cường tài nguyên (Auto-scale) theo giờ học, không tính theo mức bình quân ngày.",
        "30 phút là mốc cắt phiên chính xác nhất dựa trên đường cong khoảng cách thời gian giữa các câu hỏi."
      ],
      actions: [
        "P2: Thiết lập cơ chế tự động mở rộng tài nguyên máy chủ (Auto-scaling) và giới hạn tốc độ gọi (Rate-limit) theo lịch học."
      ]
    }
  ],

  // Bảng Lộ Trình Backlog Cải Tiến P0 / P1 / P2
  backlog: [
    { id: 1, priority: "P0", task: "Gắn nút chấm điểm 👍/👎 + 4 lý do nhanh sau mỗi câu trả lời", reason: "Giải mã lý do 47,8% học viên chỉ hỏi 1 câu rồi rời đi", section: "Chương 7", status: "Sẵn sàng", impact: "Rất cao", effort: "Thấp" },
    { id: 2, priority: "P0", task: "Sửa lỗi lưu ngữ cảnh: Enum 3 trạng thái + chặn lặp câu hỏi", reason: "48,1% dữ liệu ngữ cảnh đang bị log sai lệch", section: "Chương 1", status: "Đang làm", impact: "Cực kỳ cấp thiết", effort: "Thấp" },
    { id: 3, priority: "P0", task: "Lưu thêm nguồn câu hỏi (prompt_source) và mã nút bấm (preset_id)", reason: "Cho phép thử nghiệm A/B testing hiệu quả từng nút gợi ý", section: "Chương 2", status: "Sẵn sàng", impact: "Rất cao", effort: "Thấp" },
    { id: 4, priority: "P0", task: "Khống chế ngân sách độ dài theo ý định + thêm nút 'Xem chi tiết'", reason: "Cắt giảm lạm phát độ dài 37 lần trong giờ học", section: "Chương 8", status: "Đang làm", impact: "Rất cao", effort: "Trung bình" },
    { id: 5, priority: "P0", task: "Viết lại prompt cho nút 'Làm đơn giản' và 'Xin ví dụ'", reason: "Hạ tỷ lệ hỏi lại đang ở mức báo động 20,0% và 13,8%", section: "Chương 9", status: "Đang thử nghiệm", impact: "Cực kỳ cấp thiết", effort: "Trung bình" },
    { id: 6, priority: "P1", task: "Tái cấu trúc danh mục phân loại theo 2 chiều: Ý định × Nguồn tài liệu", reason: "Bóc tách 7 nhu cầu học tập đang bị gộp chung trong nhãn 3", section: "Chương 4", status: "Lên kế hoạch", impact: "Rất cao", effort: "Cao" },
    { id: 7, priority: "P1", task: "Hạ cấp Rule 7 (Đại từ) thành cờ boolean needs_coref trong prompt", reason: "Tỷ lệ thắng chỉ 0,5% làm rối loạn bộ phân loại", section: "Chương 3", status: "Sẵn sàng", impact: "Trung bình", effort: "Thấp" },
    { id: 8, priority: "P1", task: "Đổi tên nhánh Fallback thành 0_unclassified + gán nhãn tay 302 câu", reason: "Đo lường chính xác tỷ lệ câu hỏi chưa phân loại được", section: "Chương 3", status: "Lên kế hoạch", impact: "Trung bình", effort: "Trung bình" },
    { id: 9, priority: "P1", task: "Loại bỏ phần tiêu đề Header/Footer slide khỏi vùng bôi đen", reason: "Lọc sạch rác giao diện khi học viên chọn chữ", section: "Chương 5", status: "Sẵn sàng", impact: "Thấp", effort: "Thấp" },
    { id: 10, priority: "P1", task: "Tích hợp bảng tra cứu Tooltip / Glossary cho Top 25 thuật ngữ tiếng Anh", reason: "Giải quyết 76,8% vướng mắc thuật ngữ với chi phí 0$", section: "Chương 5", status: "Lên kế hoạch", impact: "Rất cao", effort: "Trung bình" },
    { id: 11, priority: "P1", task: "Ghi nhận thời điểm giảng viên chuyển trang (slide_presented_at)", reason: "Phân biệt học viên bị đuối sức hay do chưa giảng tới", section: "Chương 6", status: "Lên kế hoạch", impact: "Trung bình", effort: "Trung bình" },
    { id: 12, priority: "P1", task: "Xây dựng bảng tổng hợp 'Slide nóng' gửi giảng viên sau buổi học", reason: "Chỉ ra chính xác slide nào cần được giảng viên biên soạn lại", section: "Chương 6", status: "Sẵn sàng", impact: "Trung bình", effort: "Thấp" },
    { id: 13, priority: "P1", task: "Quy trình phản hồi 3 bước thân thiện cho câu hỏi tâm lý học tập", reason: "Phản hồi đồng cảm thay vì từ chối khô cứng", section: "Chương 10", status: "Sẵn sàng", impact: "Thấp", effort: "Thấp" },
    { id: 14, priority: "P1", task: "Rà soát thủ công 100 câu trả lời có điểm ngữ nghĩa thấp nhất", reason: "Đánh giá mức độ ảo giác và chất lượng trích xuất tài liệu", section: "Chương 8", status: "Lên kế hoạch", impact: "Rất cao", effort: "Trung bình" },
    { id: 15, priority: "P1", task: "Chuẩn hóa về một cấu trúc dữ liệu truyền vùng bôi đen duy nhất", reason: "Xóa bỏ tình trạng 2 biến thể giao diện gây phân mảnh", section: "Chương 1", status: "Sẵn sàng", impact: "Thấp", effort: "Thấp" },
    { id: 16, priority: "P2", task: "Tự động điều chỉnh tài nguyên máy chủ theo lịch học trong ngày", reason: "79,1% lưu lượng dồn vào đúng 5 tiếng học", section: "Chương 11", status: "Chờ duyệt", impact: "Trung bình", effort: "Trung bình" },
    { id: 17, priority: "P2", task: "Gợi ý 'Xem giải thích đầy đủ' khi học viên hỏi lặp lại trên cùng trang", reason: "Tối ưu trải nghiệm cho 35,2% trường hợp hỏi dồn", section: "Chương 6", status: "Chờ duyệt", impact: "Thấp", effort: "Trung bình" },
    { id: 18, priority: "P2", task: "Chương trình chăm sóc và gợi mở câu hỏi cho học viên mới học 1 ngày", reason: "Tăng tỷ lệ học viên quay lại từ 24% lên trên 40%", section: "Chương 7", status: "Chờ duyệt", impact: "Trung bình", effort: "Cao" },
    { id: 19, priority: "P2", task: "Đưa Top 3 thuật ngữ trọng tâm vào slide mở đầu mỗi buổi học", reason: "Giúp học viên làm quen từ vựng trước khi nghe giảng", section: "Chương 5", status: "Chờ duyệt", impact: "Thấp", effort: "Thấp" }
  ],

  // 12 Slide Trình Chiếu Chuẩn Cấp Cao (Tiếng Việt Rõ Ràng, Mạch Lạc)
  slides: [
    {
      id: 1,
      tag: "Báo Cáo Cấp Cao",
      title: "Phân Tích Dữ Liệu & Lộ Trình Tối Ưu Trợ Giảng AI",
      subtitle: "Báo cáo thực chứng trên 1.000 lượt tương tác học viên & Các giải pháp kiến trúc P0",
      content: `
        <div class="slide-grid-2">
          <div class="glass-box">
            <h3 class="text-blue">Quy Mô Dữ Liệu Phân Tích</h3>
            <ul class="clean-list mt-2">
              <li><strong>1.000</strong> câu hỏi/đáp thực tế được ghi nhận</li>
              <li><strong>258</strong> học viên tham gia tích cực</li>
              <li><strong>360</strong> phiên hội thoại trao đổi</li>
              <li><strong>18</strong> buổi học chuyên sâu (Day Codes)</li>
              <li><strong>6</strong> ngày theo dõi liên tục (10/08 → 15/08/2026)</li>
            </ul>
          </div>
          <div class="glass-box highlight-border">
            <h3 class="text-red">3 Điểm Mù Cốt Lõi (Cần Sửa Ngay P0)</h3>
            <div class="stat-pill-list">
              <div class="stat-pill"><span class="pill-num">48,1%</span> Ngữ cảnh bôi đen bị copy nhầm câu hỏi (Lỗi Client)</div>
              <div class="stat-pill"><span class="pill-num">20,0%</span> Tỷ lệ hỏi lại khi học viên xin 'Làm đơn giản hơn'</div>
              <div class="stat-pill"><span class="pill-num">37x</span> Độ dài câu trả lời quá dài trong lúc giảng viên đang giảng</div>
            </div>
          </div>
        </div>
      `,
      notes: "Mở đầu báo cáo cho các Senior/Stakeholder: Nêu bật quy mô 1.000 log và nhấn mạnh ngay 3 vấn đề kiến trúc cần khắc phục ở mức P0."
    },
    {
      id: 2,
      tag: "Phạm Vi Dữ Liệu",
      title: "0. Phạm Vi & Đặc Điểm Dữ Liệu",
      subtitle: "Báo cáo phản ánh đúng cơ chế và hành vi trong lớp, không quy chụp theo mùa vụ",
      content: `
        <div class="slide-grid-3">
          <div class="stat-card-mini">
            <div class="stat-title">Dồn Vào 1 Buổi Học</div>
            <div class="stat-big">46,6%</div>
            <div class="stat-desc">Tập trung vào ngày 14/08 (162 học viên)</div>
          </div>
          <div class="stat-card-mini">
            <div class="stat-title">Độ Lệch Nhãn Dữ Liệu</div>
            <div class="stat-big">612 : 1</div>
            <div class="stat-desc">Nhãn 3_reference_trang áp đảo tuyệt đối</div>
          </div>
          <div class="stat-card-mini">
            <div class="stat-title">Bối Cảnh Tương Tác</div>
            <div class="stat-big">100%</div>
            <div class="stat-desc">Đều diễn ra trong giờ học (in_class)</div>
          </div>
        </div>
        <div class="action-badge-box mt-3" style="background: var(--amber-subtle); border-color: #fde68a;">
          <strong class="text-amber">Nguyên tắc đánh giá:</strong>
          <p style="color: var(--text-primary);">Mọi chỉ số đo lường hiệu năng bắt buộc phải chia theo từng buổi học (day_code) thay vì tính trung bình cộng toàn cục để không bị méo số liệu.</p>
        </div>
      `,
      notes: "Cảnh báo sớm về tính chất phân bố dữ liệu: 46.6% dồn vào ngày 14/08 nên nếu tính trung bình toàn cục sẽ bị sai lệch."
    },
    {
      id: 3,
      tag: "Lỗ Hổng Kiến Trúc P0",
      title: "1. Tầng Thu Thập Ngữ Cảnh Đang Bị 'Mù'",
      subtitle: "48,1% ngữ cảnh gửi vào AI là bản copy paste của chính câu hỏi",
      content: `
        <div class="chart-slide-layout">
          <div class="chart-box-slide">
            <canvas id="slideChartContext"></canvas>
          </div>
          <div class="text-box-slide">
            <h4 class="text-red font-bold">Thực Trạng Ngữ Cảnh Bôi Đen:</h4>
            <ul>
              <li><strong>40,5%</strong>: Học viên bôi đen đúng đoạn chữ trên slide.</li>
              <li><strong>48,1%</strong>: Client tự copy câu hỏi gán vào phần bôi đen.</li>
              <li><strong>10,9%</strong>: Không có thông tin trang slide.</li>
              <li><strong>Rác UI</strong>: 5 câu hỏi nuốt trọn cả mã HTML giao diện web.</li>
            </ul>
            <div class="action-badge-box">
              <span class="p0-badge">Hành Động P0</span>
              <p>Chuyển sang 3 trạng thái rõ ràng (highlight / page_only / no_context) và chặn tự động copy câu hỏi tại client.</p>
            </div>
          </div>
        </div>
      `,
      chartInit: "initSlideContextChart",
      notes: "Lỗ hổng lớn nhất tầng Client: Biến cờ selected_region = yes cho 89% nhưng thực tế gần một nửa là copy nhầm câu hỏi."
    },
    {
      id: 4,
      tag: "Hành Vi Người Dùng",
      title: "2. 43,4% Câu Hỏi Sinh Ra Từ Nút Bấm Gợi Ý",
      subtitle: "Nút bấm nhanh giúp giảm công gõ nhưng cần gắn mã để đo lường A/B testing",
      content: `
        <div class="slide-grid-2">
          <div>
            <div class="glass-box">
              <h4 class="text-blue">Top Nút Bấm Gợi Ý Phổ Biến:</h4>
              <div class="stat-pill-list">
                <div class="comp-pill"><span>"Giải thích rõ đoạn này giúp mình."</span><strong class="text-blue">220 câu (22,0%)</strong></div>
                <div class="comp-pill"><span>"…thật đơn giản, dễ hiểu"</span><strong>34 câu (3,4%)</strong></div>
                <div class="comp-pill"><span>"Dựa trên tiến độ của mình…"</span><strong>21 câu (2,1%)</strong></div>
                <div class="comp-pill"><span>"…sâu và chi tiết hơn"</span><strong>16 câu (1,6%)</strong></div>
              </div>
            </div>
          </div>
          <div class="glass-box">
            <h4 class="text-blue">Hệ Quả Phân Tích Kỹ Thuật:</h4>
            <p class="mt-2">Các thuật toán phân cụm chủ đề chỉ đạt điểm <strong>0,14</strong> vì gần một nửa dữ liệu là các câu chữ lặp đi lặp lại giống hệt nhau.</p>
            <div class="action-badge-box mt-3">
              <span class="p0-badge">Hành Động P0</span>
              <p>Lưu trực tiếp mã <code>prompt_source: preset | typed</code> và <code>preset_id</code> từ giao diện người dùng.</p>
            </div>
          </div>
        </div>
      `,
      notes: "Nút bấm gợi ý được học viên dùng rất nhiều, giúp giảm ma sát đặt câu hỏi nhưng cần telemetry để A/B test."
    },
    {
      id: 5,
      tag: "Bộ Quy Tắc Phân Loại",
      title: "3. Rule 7 Vô Tác Dụng & 30% Rơi Vào Fallback Mù",
      subtitle: "Rule 7_ngu_canh_dai_tu khớp 377 lần nhưng chỉ thắng đúng 2 lần (0,5%)",
      content: `
        <div class="chart-slide-layout">
          <div class="chart-box-slide">
            <canvas id="slideChartRuleWinRate"></canvas>
          </div>
          <div class="text-box-slide">
            <h4 class="text-blue">Tỷ Lệ Thắng Của Các Quy Tắc:</h4>
            <ul>
              <li><strong>6_tim_slide</strong>: Khớp 304 $\to$ Thắng 295 (<strong>97,0%</strong>)</li>
              <li><strong>4_tu_kiem_tra</strong>: Khớp 35 $\to$ Thắng 33 (<strong>94,0%</strong>)</li>
              <li><strong>3_reference_trang</strong>: Khớp 501 $\to$ Thắng 299 (<strong>60,0%</strong>)</li>
              <li><strong>7_ngu_canh_dai_tu</strong>: Khớp 377 $\to$ Thắng 2 (<strong>0,5%</strong>) ⚠️</li>
            </ul>
            <div class="action-badge-box">
              <span class="p1-badge">Hành Động P1</span>
              <p>Chuyển Rule 7 thành cờ boolean trong prompt. Đổi tên Fallback 302 câu thành <code>0_unclassified</code> để đo lường chính xác.</p>
            </div>
          </div>
        </div>
      `,
      chartInit: "initSlideRuleChart",
      notes: "Rule 7 gây nhiễu vì hầu như luôn bị Rule 3 và 6 đè bẹp. Nhánh fallback 302 dòng cần được đo lường đúng nghĩa."
    },
    {
      id: 6,
      tag: "Tái Cấu Trúc Danh Mục",
      title: "4. Tái Thiết Kế Danh Mục Theo Ý Định Học Tập",
      subtitle: "Nhãn 3_reference_trang đang là 'thùng chứa' cho 7 nhu cầu học tập khác nhau",
      content: `
        <div class="slide-grid-2">
          <div class="glass-box" style="border-left: 4px solid var(--amber-gold);">
            <h4 class="text-amber">Mô Hình Cũ (Phân loại theo cách lấy tin)</h4>
            <p class="text-sm text-secondary mt-1">Dùng chung 1 prompt cho mọi câu hỏi:</p>
            <div style="background: #f8fafc; padding: 0.75rem; border-radius: 8px; font-family: var(--font-mono); font-size: 0.85rem; margin-top: 0.5rem;">
              <strong>3_reference_trang (61,2%)</strong><br>
              ├── Định nghĩa (109 câu)<br>
              ├── Làm đơn giản (50 câu)<br>
              ├── Xin ví dụ (29 câu)<br>
              ├── Đào sâu (23 câu)<br>
              └── Tóm tắt (38 câu)
            </div>
            <p class="text-sm text-muted mt-2">→ Tất cả cùng nhận 1 câu trả lời dài và chung chung!</p>
          </div>
          <div class="glass-box" style="border-left: 4px solid var(--emerald-green);">
            <h4 class="text-emerald">Mô Hình Mới (Ý Định × Nguồn Tài Liệu)</h4>
            <p class="text-sm text-secondary mt-1">Phân tách 2 chiều độc lập để gán prompt riêng:</p>
            <div style="background: var(--emerald-subtle); padding: 0.75rem; border-radius: 8px; font-size: 0.85rem; margin-top: 0.5rem;">
              <strong>1. Ý Định Học (Pedagogical Intent):</strong><br>
              <code>Định nghĩa | Làm dễ hiểu | Đào sâu | Ví dụ | So sánh | Tóm tắt</code><br><br>
              <strong>2. Nguồn Tài Liệu (Source Scope):</strong><br>
              <code>Trang hiện tại | Toàn bộ bài giảng | Liên buổi học</code>
            </div>
          </div>
        </div>
      `,
      notes: "Chuyển từ taxonomy kỹ thuật sang taxonomy sư phạm (Pedagogical Intent), giúp gán prompt chuyên biệt cho từng loại câu hỏi."
    },
    {
      id: 7,
      tag: "Thuật Ngữ & Trải Nghiệm",
      title: "5. Điểm Nghẽn Thuật Ngữ Tiếng Anh Kỹ Thuật",
      subtitle: "76,8% từ ngữ học viên bôi đen là tiếng Anh chuyên ngành AI/LLM",
      content: `
        <div class="slide-grid-2">
          <div class="glass-box">
            <h4 class="text-blue">Top Thuật Ngữ Bị Bôi Đen Nhiều Nhất:</h4>
            <div class="vocab-grid mt-2" style="grid-template-columns: repeat(3, 1fr);">
              <div class="vocab-chip"><div class="vocab-term">agent</div><div class="vocab-count">44 lần</div></div>
              <div class="vocab-chip"><div class="vocab-term">model</div><div class="vocab-count">31 lần</div></div>
              <div class="vocab-chip"><div class="vocab-term">gpu</div><div class="vocab-count">31 lần</div></div>
              <div class="vocab-chip"><div class="vocab-term">llm</div><div class="vocab-count">23 lần</div></div>
              <div class="vocab-chip"><div class="vocab-term">context</div><div class="vocab-count">22 lần</div></div>
              <div class="vocab-chip"><div class="vocab-term">latency</div><div class="vocab-count">17 lần</div></div>
            </div>
          </div>
          <div class="glass-box">
            <h4 class="text-blue">Giải Pháp UX Chi Phí 0$:</h4>
            <div class="comp-pill good mt-2">
              <div>
                <strong>Bảng Tra Cứu Tooltip Tức Thì:</strong>
                <p class="text-sm text-secondary">Hiển thị định nghĩa ngay khi rê chuột vào 25 thuật ngữ trên slide PDF mà không cần gọi API LLM.</p>
              </div>
            </div>
            <div class="comp-pill good mt-2">
              <div>
                <strong>Lọc Bỏ Tiêu Đề Header Slide:</strong>
                <p class="text-sm text-secondary">Loại bỏ các cụm chữ khuôn mẫu khỏi vùng nhận diện bôi đen.</p>
              </div>
            </div>
          </div>
        </div>
      `,
      notes: "Học viên gặp rào cản tiếng Anh chuyên ngành. Có thể giải quyết 70% câu hỏi định nghĩa bằng tooltip mà không cần tốn tiền gọi LLM."
    },
    {
      id: 8,
      tag: "Hành Vi Lớp Học",
      title: "6. Dồn Vào Đầu Buổi Học & Hỏi Lặp Lại Cùng Trang",
      subtitle: "59,3% câu hỏi tập trung ở 1/3 đầu bài giảng — 35,2% hỏi tiếp trên cùng trang",
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
            <div class="stat-desc">Đuối sức hoặc giảng viên lướt nhanh</div>
          </div>
          <div class="stat-card-mini">
            <div class="stat-title">Hỏi Lặp Cùng Trang</div>
            <div class="stat-big text-amber">35,2%</div>
            <div class="stat-desc">Cần đào sâu thêm về trang đó</div>
          </div>
        </div>
        <div class="glass-box mt-3">
          <h4 class="text-blue">Ứng Dụng Thực Tế Cho Giảng Viên:</h4>
          <p class="mt-1">• <strong>Báo cáo Slide Nóng:</strong> Cảnh báo các trang slide có từ 10 câu hỏi trở lên để giảng viên giảng kỹ hơn hoặc biên soạn lại nội dung.<br>
          • <strong>Gợi ý thông minh:</strong> Khi học viên hỏi lặp lại trên cùng trang, bot chủ động đề xuất nút <em>'Xem giải thích đầy đủ trang này'</em>.</p>
        </div>
      `,
      notes: "Hiện tượng tập trung đầu bài và hỏi lặp lại trên cùng trang là dữ liệu quý giá giúp hoàn thiện bài giảng."
    },
    {
      id: 9,
      tag: "Độ Sâu Tương Tác",
      title: "7. Tương Tác Nông & Lỗ Hổng Đánh Giá Feedback",
      subtitle: "47,8% phiên hỏi 1 câu rồi rời đi — Thiếu hoàn toàn nút đánh giá chất lượng",
      content: `
        <div class="slide-grid-2">
          <div class="glass-box">
            <h4 class="text-blue">Phân Bố Tương Tác Học Viên:</h4>
            <ul class="clean-list mt-2">
              <li><strong>47,8%</strong> phiên hội thoại chỉ hỏi đúng 1 câu rồi dừng.</li>
              <li><strong>34,5%</strong> học viên chỉ hỏi 1 câu trong suốt khóa học.</li>
              <li><strong>24,0%</strong> học viên quay lại học từ 2 ngày trở lên.</li>
              <li>Nhóm quay lại hỏi nhiều gấp <strong>3,4 lần</strong> nhóm 1 ngày (8,4 vs 2,4 câu/người).</li>
            </ul>
          </div>
          <div class="glass-box highlight-border">
            <h4 class="text-red">Lỗ Hổng Đo Lường Lớn Nhất:</h4>
            <p class="mt-2">Hệ thống hiện tại <strong>hoàn toàn không có nút đánh giá</strong>. Không thể biết 47,8% rời đi là vì <em>'Đã hiểu bài'</em> hay <em>'Thất vọng vì bot trả lời dở'</em>.</p>
            <div class="action-badge-box mt-3">
              <span class="p0-badge">Hành Động P0</span>
              <p>Bổ sung ngay widget đánh giá 👍 / 👎 kèm 4 lý do nhanh: <code>Chưa hiểu | Sai kiến thức | Quá dài | Lạc đề</code>.</p>
            </div>
          </div>
        </div>
      `,
      notes: "Không có rating thì mọi tối ưu chất lượng chỉ là phỏng đoán. Nút feedback 👍/👎 là ưu tiên P0 số một."
    },
    {
      id: 10,
      tag: "Quá Tải Nhận Thức",
      title: "8. Lạm Phát Độ Dài 37 Lần & Nghịch Lý Trích Dẫn",
      subtitle: "Bot trả lời trung bình 243 từ — Học viên mất cả phút để đọc trong khi giảng viên đang giảng",
      content: `
        <div class="slide-grid-2">
          <div class="glass-box">
            <h4 class="text-red">Lạm Phát Độ Dài Trong Lớp:</h4>
            <div class="comp-pill bad mt-2">
              <div><strong>Câu hỏi học viên:</strong> ~6 - 15 từ</div>
              <div><strong>Bot trả lời:</strong> <span class="text-red font-bold">243 từ (Dài gấp 37 lần)</span></div>
            </div>
            <p class="text-sm text-secondary mt-2">Học viên mất 60 giây để đọc hết câu trả lời trong khi giảng viên vẫn đang nói trên bục giảng $\to$ Gây quá tải nhận thức!</p>
          </div>
          <div class="glass-box">
            <h4 class="text-blue">Nghịch Lý Trích Dẫn:</h4>
            <p class="mt-2">86,1% câu trả lời có trích dẫn <code>[trang N]</code> nhưng tương quan giữa số lượng trích dẫn và độ đúng trọng tâm chỉ đạt <strong>r = 0,02</strong>.</p>
            <p class="text-sm text-muted mt-2">→ Trích dẫn nhiều chỉ là tuân thủ định dạng (Format Compliance), không đồng nghĩa với câu trả lời trúng ý.</p>
          </div>
        </div>
        <div class="action-badge-box mt-3">
          <span class="p0-badge">Hành Động P0</span>
          <p>Áp đặt ngân sách từ: Định nghĩa <code>define</code> ≤ 80 từ; Làm dễ hiểu <code>simplify</code> ≤ 120 từ. Bổ sung nút <em>'Giải thích chi tiết hơn'</em> cho ai muốn đọc sâu.</p>
        </div>
      `,
      notes: "Cắt giảm độ dài câu trả lời là chìa khóa để học viên vừa theo dõi bài giảng vừa tra cứu trợ giảng."
    },
    {
      id: 11,
      tag: "Điểm Thất Bại P0",
      title: "9. Điểm Thất Bại Rõ Nhất: Nút 'Làm Đơn Giản' (20% Hỏi Lại)",
      subtitle: "Học viên xin giải thích dễ hiểu nhưng bot vẫn trả lời bằng từ ngữ khó hiểu",
      content: `
        <div class="chart-slide-layout">
          <div class="chart-box-slide">
            <canvas id="slideChartRetry"></canvas>
          </div>
          <div class="text-box-slide">
            <h4 class="text-red font-bold">Tỷ Lệ Hỏi Lại Theo Ý Định:</h4>
            <ul>
              <li><strong class="text-red">Làm đơn giản hơn</strong>: <strong>20,0%</strong> hỏi lại ⚠️</li>
              <li><strong class="text-red">Xin ví dụ cụ thể</strong>: <strong>13,8%</strong> hỏi lại ⚠️</li>
              <li><strong>So sánh khái niệm</strong>: 6,2% hỏi lại</li>
              <li><strong>Định nghĩa thuật ngữ</strong>: 5,5% hỏi lại</li>
              <li><strong>Tóm tắt bài học</strong>: 3,6% hỏi lại</li>
            </ul>
            <div class="action-badge-box">
              <span class="p0-badge">Hành Động P0</span>
              <p>Viết lại prompt cho <code>simplify</code> (bắt buộc dùng ẩn dụ đời thường) và <code>example</code> (ví dụ có số liệu thực tế).</p>
            </div>
          </div>
        </div>
      `,
      chartInit: "initSlideRetryChart",
      notes: "Dữ liệu retry chứng minh rõ nét: Học viên bấm 'Làm đơn giản hơn' nhưng vẫn phải hỏi lại vì prompt chưa đổi độ trừu tượng."
    },
    {
      id: 12,
      tag: "Lộ Trình & Cam Kết KPI",
      title: "10. Lộ Trình Thực Thi & Cam Kết KPI",
      subtitle: "5 Đầu việc P0 triển khai ngay trong Sprint tới",
      content: `
        <div class="backlog-mini-grid">
          <div class="backlog-card p0">
            <div class="p-tag">P0 - 1</div>
            <div class="p-title">Widget Feedback 👍/👎</div>
            <div class="p-desc">Thêm nút chấm điểm kèm 4 lý do nhanh sau mỗi câu trả lời.</div>
          </div>
          <div class="backlog-card p0">
            <div class="p-tag">P0 - 2</div>
            <div class="p-title">Sửa Lỗi Ngữ Cảnh</div>
            <div class="p-desc">Enum 3 trạng thái + chặn tự động lặp câu hỏi tại client.</div>
          </div>
          <div class="backlog-card p0">
            <div class="p-tag">P0 - 3</div>
            <div class="p-title">Khống Chế Độ Dài</div>
            <div class="p-desc">Siết độ dài define ≤80 từ, simplify ≤120 từ + nút mở rộng.</div>
          </div>
          <div class="backlog-card p0">
            <div class="p-tag">P0 - 4</div>
            <div class="p-title">Viết Lại Prompt Simplify</div>
            <div class="p-desc">Đưa phép ẩn dụ đời thường và số liệu thực tế vào prompt.</div>
          </div>
        </div>
        <div class="glass-box mt-3" style="border: 2px solid var(--emerald-green); background: var(--emerald-subtle);">
          <h4 class="text-emerald">🎯 Cam Kết KPI Sau Khi Tối Ưu:</h4>
          <div class="slide-grid-2 mt-2">
            <div>• Tỷ lệ hỏi lại nút Simplify: <strong class="text-red">20,0% $\to$ < 8,0%</strong></div>
            <div>• Tỷ lệ lỗi lặp ngữ cảnh: <strong class="text-red">48,1% $\to$ 0%</strong></div>
            <div>• Độ dài câu trả lời trung bình: <strong class="text-amber">243 từ $\to$ 110 từ</strong></div>
            <div>• Tỷ lệ hội thoại sâu (≥2 lượt): <strong class="text-emerald">52,2% $\to$ > 70%</strong></div>
          </div>
        </div>
      `,
      notes: "Slide chốt lộ trình hành động P0 và cam kết KPI rõ ràng cho ban lãnh đạo và tech lead."
    }
  ],

  // Mẫu Câu Hỏi Thực Tế Tra Cứu Trực Tiếp
  sampleQuestions: [
    { id: "ded994db", label: "3_reference_trang", intent: "Định nghĩa", page: 41, selection: "middleware", question: "Giải thích rõ đoạn này giúp mình.", answerWords: 218, citationCount: 6, similarity: 0.28, retry: false },
    { id: "6d9913db", label: "3_reference_trang", intent: "Đào sâu", page: 9, selection: "ReAct struggle với multi-hop reasoning", question: "Giải thích rõ đoạn này giúp mình.", answerWords: 195, citationCount: 5, similarity: 0.32, retry: false },
    { id: "634af2d1", label: "3_reference_trang", intent: "Định nghĩa", page: 9, selection: "Reflexion.", question: "Giải thích rõ đoạn này giúp mình.", answerWords: 165, citationCount: 4, similarity: 0.25, retry: false },
    { id: "aa02b273", label: "6_tim_slide", intent: "Tìm vị trí", page: 17, selection: "macos có tải slide xuống để ôn tập ko ạ", question: "macos có tải slide xuống để ôn tập ko ạ", answerWords: 68, citationCount: 0, similarity: 0.08, retry: false },
    { id: "9d518734", label: "6_tim_slide", intent: "Tóm tắt", page: 30, selection: "giải thích trang 30", question: "giải thích trang 30", answerWords: 242, citationCount: 8, similarity: 0.19, retry: false },
    { id: "41118a40", label: "6_tim_slide", intent: "Tóm tắt", page: 27, selection: "giải thichs slide 27", question: "giải thichs slide 27", answerWords: 256, citationCount: 9, similarity: 0.22, retry: false },
    { id: "1ea2b460", label: "3_reference_trang", intent: "Định nghĩa", page: 2, selection: "dedup", question: "Giải thích rõ đoạn này giúp mình.", answerWords: 184, citationCount: 5, similarity: 0.30, retry: false },
    { id: "62711a52", label: "3_reference_trang", intent: "Làm đơn giản", page: 7, selection: "overload", question: "Giải thích rõ đoạn này giúp mình.", answerWords: 178, citationCount: 4, similarity: 0.21, retry: true },
    { id: "6062ea9c", label: "3_reference_trang", intent: "Xin ví dụ", page: 6, selection: "Lookup(X)", question: "Giải thích rõ đoạn này giúp mình.", answerWords: 192, citationCount: 4, similarity: 0.24, retry: true },
    { id: "887d6cf0", label: "6_tim_slide", intent: "Tóm tắt", page: 22, selection: "Best Practices", question: "Giải thích rõ đoạn này giúp mình.", answerWords: 210, citationCount: 5, similarity: 0.26, retry: false }
  ]
};
