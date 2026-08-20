// AI Tutor Dashboard - Interactive Controller (Theme: Crisp White, Royal Blue, Crimson Red)

function getAppData() {
  return window.AI_TUTOR_DATA || { overview: { metrics: [] }, chapters: [], backlog: [], sampleQuestions: [] };
}

document.addEventListener("DOMContentLoaded", () => {
  initDashboardKPIs();
  initDashboardCharts();
  renderVocabGrid();
  renderChaptersAccordion();
  renderBacklogTable();
  initSimulators();
  renderSampleTable();
  initModeSwitcher();
  if (window.lucide) lucide.createIcons();
});

// 1. Render Dashboard KPIs
function initDashboardKPIs() {
  const data = getAppData();
  const grid = document.getElementById("kpiGrid");
  if (!grid || !data.overview || !data.overview.metrics) return;

  grid.innerHTML = data.overview.metrics.map(m => {
    const isAlert = m.id === "echo_rate" || m.id === "retry_simplify";
    return `
      <div class="kpi-card ${isAlert ? 'alert-card' : ''}">
        <div class="kpi-header">
          <span class="kpi-title">${m.label}</span>
          <div class="kpi-icon ${isAlert ? 'red' : m.color}">
            <i data-lucide="${m.icon}"></i>
          </div>
        </div>
        <div class="kpi-value">${m.value}</div>
        <div class="kpi-change">
          <i data-lucide="${isAlert ? 'alert-circle' : 'trending-up'}" style="width: 14px; color: ${isAlert ? 'var(--crimson-red)' : 'var(--royal-blue)'};"></i>
          ${m.change}
        </div>
      </div>
    `;
  }).join("");

  if (window.lucide) lucide.createIcons();
}

// 2. Initialize Chart.js Dashboard Visualizations
function initDashboardCharts() {
  if (typeof Chart === "undefined") return;

  // Chart 0: Radar Chart (Architecture Health Index)
  const ctxRadar = document.getElementById("chartRadarHealth");
  if (ctxRadar) {
    new Chart(ctxRadar, {
      type: "radar",
      data: {
        labels: [
          "Độ sạch Ngữ cảnh (Context)",
          "Độ tinh gọn (Độ dài câu)",
          "Độ tin cậy (Hạ tỷ lệ Retry)",
          "Chuẩn hóa Ý định (Intent)",
          "Độ chính xác Quy tắc (Rule)",
          "Tỷ lệ giữ chân Học viên"
        ],
        datasets: [
          {
            label: "Baseline Hiện Tại",
            data: [35, 25, 40, 30, 45, 38],
            backgroundColor: "rgba(220, 38, 38, 0.2)",
            borderColor: "#dc2626",
            borderWidth: 2,
            pointBackgroundColor: "#dc2626",
            pointRadius: 4
          },
          {
            label: "Mục Tiêu Sau Tối Ưu (P0)",
            data: [95, 90, 88, 92, 90, 85],
            backgroundColor: "rgba(30, 64, 175, 0.2)",
            borderColor: "#1e40af",
            borderWidth: 2.5,
            pointBackgroundColor: "#1e40af",
            pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            angleLines: { color: "#e2e8f0" },
            grid: { color: "#e2e8f0" },
            pointLabels: {
              font: { family: "Inter", size: 11, weight: "bold" },
              color: "#334155"
            },
            ticks: { display: false, max: 100, min: 0 }
          }
        },
        plugins: {
          legend: {
            position: "bottom",
            labels: { font: { family: "Inter", size: 12, weight: "bold" }, color: "#1e293b", padding: 15 }
          }
        }
      }
    });
  }

  // Chart 1: Context Capture Breakdown
  const ctxContext = document.getElementById("chartContextCapture");
  if (ctxContext) {
    new Chart(ctxContext, {
      type: "doughnut",
      data: {
        labels: ["Echo câu hỏi (Lỗi P0)", "Bôi đen thật (Slide)", "Không ngữ cảnh", "Nhúng thẳng UI"],
        datasets: [{
          data: [481, 405, 109, 5],
          backgroundColor: ["#dc2626", "#059669", "#64748b", "#3b82f6"],
          borderColor: "#ffffff",
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { color: "#334155", font: { family: "Inter", size: 11, weight: "600" } } },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.raw} lượt (${((ctx.raw / 1000) * 100).toFixed(1)}%)`
            }
          }
        },
        cutout: "65%"
      }
    });
  }

  // Chart 2: Rule Win Rates
  const ctxRule = document.getElementById("chartRuleWinRate");
  if (ctxRule) {
    new Chart(ctxRule, {
      type: "bar",
      data: {
        labels: ["6_tim_slide", "4_tu_kiem_tra", "1_xa_giao", "3_reference_trang", "7_ngu_canh_dai_tu ⚠️"],
        datasets: [
          {
            label: "Số lần khớp rule",
            data: [304, 35, 17, 501, 377],
            backgroundColor: "rgba(59, 130, 246, 0.3)",
            borderColor: "#2563eb",
            borderWidth: 1.5,
            borderRadius: 4
          },
          {
            label: "Số lần thắng (Win)",
            data: [295, 33, 16, 299, 2],
            backgroundColor: ["#059669", "#059669", "#059669", "#1e40af", "#dc2626"],
            borderWidth: 0,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { grid: { color: "#f1f5f9" }, ticks: { color: "#64748b", font: { weight: "600" } } },
          x: { grid: { display: false }, ticks: { color: "#334155", font: { weight: "700" } } }
        },
        plugins: {
          legend: { position: "top", labels: { color: "#334155", font: { family: "Inter", weight: "600" } } }
        }
      }
    });
  }

  // Chart 3: Intent vs Retry Rate
  const ctxRetry = document.getElementById("chartRetryIntent");
  if (ctxRetry) {
    new Chart(ctxRetry, {
      type: "bar",
      data: {
        labels: ["Đơn giản hóa ⚠️", "Xin ví dụ ⚠️", "So sánh", "Định nghĩa", "Giải thích đoạn", "Tóm tắt", "Quiz"],
        datasets: [{
          label: "Retry Rate (%)",
          data: [20.0, 13.8, 6.2, 5.5, 4.9, 3.6, 0.0],
          backgroundColor: ["#dc2626", "#ea580c", "#2563eb", "#2563eb", "#3b82f6", "#059669", "#059669"],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        scales: {
          x: {
            grid: { color: "#f1f5f9" },
            ticks: { color: "#64748b", callback: (v) => v + "%", font: { weight: "600" } },
            max: 25
          },
          y: { grid: { display: false }, ticks: { color: "#1e293b", font: { weight: "700" } } }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  // Chart 4: Hourly Traffic
  const ctxHourly = document.getElementById("chartHourlyTraffic");
  if (ctxHourly) {
    new Chart(ctxHourly, {
      type: "bar",
      data: {
        labels: ["8h - 11h (Sáng)", "11h - 14h (Nghỉ)", "14h - 16h (Chiều)", "16h - 19h (Tan)", "19h - 22h (Tối)", "22h - 6h (Đêm)"],
        datasets: [{
          label: "Tỷ lệ lưu lượng (%)",
          data: [42.5, 5.8, 36.6, 3.7, 5.4, 6.0],
          backgroundColor: ["#1e40af", "#cbd5e1", "#2563eb", "#cbd5e1", "#3b82f6", "#ef4444"],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            grid: { color: "#f1f5f9" },
            ticks: { color: "#64748b", callback: (v) => v + "%", font: { weight: "600" } }
          },
          x: { grid: { display: false }, ticks: { color: "#1e293b", font: { weight: "600" } } }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }
}

// 3. Render Vocabulary Grid
function renderVocabGrid() {
  const container = document.getElementById("vocabGrid");
  if (!container) return;

  const terms = [
    { word: "agent", count: 44, desc: "Kiến trúc Multi-Agent, Tool Use, khả năng suy luận Reasoning" },
    { word: "model", count: 31, desc: "Lựa chọn mô hình LLM, Tokenizer, kích thước tham số" },
    { word: "gpu", count: 31, desc: "Dung lượng VRAM, CUDA Cores, tối ưu tính toán song song" },
    { word: "llm", count: 23, desc: "Mô hình ngôn ngữ lớn & Kỹ thuật Prompt Engineering" },
    { word: "context", count: 22, desc: "Cửa sổ ngữ cảnh Context Window, bộ nhớ hội thoại" },
    { word: "latency", count: 17, desc: "Thời gian phản hồi TTFT, độ trễ suy luận mô hình" },
    { word: "cost", count: 17, desc: "Chi phí token API, tối ưu hóa bộ nhớ đệm Caching" },
    { word: "serving", count: 16, desc: "Triển khai hạ tầng phục vụ suy luận (vLLM, Triton Server)" },
    { word: "reflexion", count: 15, desc: "Cơ chế tự phản tư và vòng lặp tự sửa lỗi Self-Reflection" },
    { word: "vllm", count: 14, desc: "Thư viện tối ưu thông lượng bộ nhớ PagedAttention" }
  ];

  container.innerHTML = terms.map(t => `
    <div class="vocab-chip" onclick="alert('Thuật ngữ: ${t.word}\\nTần suất học viên bôi đen: ${t.count} lần\\nÝ nghĩa chuyên ngành: ${t.desc}\\n\\n👉 Đề xuất cải tiến: Tích hợp Tooltip giải nghĩa tức thì ngay trên slide PDF (Không tốn chi phí gọi LLM).')">
      <div class="vocab-term">${t.word}</div>
      <div class="vocab-count">${t.count} lần</div>
    </div>
  `).join("");
}

// 4. Render 11 Chapters Accordion
function renderChaptersAccordion() {
  const data = getAppData();
  const container = document.getElementById("chaptersAccordion");
  if (!container || !data.chapters) return;

  container.innerHTML = data.chapters.map((ch, idx) => {
    const isCritical = ch.id === 1 || ch.id === 9;
    return `
      <div class="chapter-item ${isCritical ? 'critical-item' : ''} ${idx === 1 ? 'active' : ''}" id="chapter-${ch.id}">
        <div class="chapter-header" onclick="toggleChapter(${ch.id})">
          <div class="chapter-title-group">
            <span class="chapter-num">CH.${ch.id}</span>
            <div>
              <div class="chapter-name">${ch.title}</div>
              <div style="font-size: 0.85rem; color: var(--text-muted);">${ch.subtitle}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.85rem;">
            <span class="chapter-badge badge-${ch.badgeColor}">${ch.badge}</span>
            <i data-lucide="chevron-down" class="chapter-toggle-icon" style="color: var(--royal-blue);"></i>
          </div>
        </div>
        <div class="chapter-body">
          <p class="chapter-summary">${ch.summary}</p>
          
          <div class="chapter-grid">
            <div class="takeaway-box">
              <div class="takeaway-title"><i data-lucide="lightbulb" style="color: var(--amber-gold); width:18px;"></i> Phát hiện cốt lõi</div>
              <ul class="clean-list">
                ${ch.keyTakeaways.map(t => `<li>${t}</li>`).join("")}
              </ul>
            </div>
            <div class="takeaway-box">
              <div class="takeaway-title"><i data-lucide="check-circle" style="color: var(--emerald-green); width:18px;"></i> Đề xuất Hành động</div>
              <ul class="clean-list action-list">
                ${ch.actions.map(a => `<li>${a}</li>`).join("")}
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  if (window.lucide) lucide.createIcons();
}

window.toggleChapter = function(id) {
  const item = document.getElementById(`chapter-${id}`);
  if (item) {
    item.classList.toggle("active");
  }
};

// 5. Render Backlog Table with Priority Filter
function renderBacklogTable(filter = "ALL") {
  const data = getAppData();
  const tbody = document.getElementById("backlogTableBody");
  if (!tbody || !data.backlog) return;

  const filtered = filter === "ALL" 
    ? data.backlog 
    : data.backlog.filter(b => b.priority === filter);

  tbody.innerHTML = filtered.map(b => `
    <tr>
      <td><span class="${b.priority.toLowerCase()}-badge">${b.priority}</span></td>
      <td><strong>${b.task}</strong></td>
      <td style="color: var(--text-secondary);">${b.reason}</td>
      <td><span class="p2-badge">${b.section}</span></td>
      <td><span style="font-size: 0.8rem; font-weight:700; color: ${b.impact === 'Critical' ? 'var(--crimson-red)' : 'var(--royal-blue)'};">${b.impact}</span></td>
      <td><span style="font-size: 0.8rem; color: var(--text-muted); font-weight:600;">${b.effort}</span></td>
      <td><span class="p1-badge" style="color: ${b.status === 'Ready' || b.status === 'In Progress' ? 'var(--emerald-green)' : 'var(--text-muted)'};">${b.status}</span></td>
    </tr>
  `).join("");
}

window.filterBacklog = function(priority) {
  document.querySelectorAll(".filter-btn").forEach(btn => btn.classList.remove("active"));
  if (window.event && window.event.target) {
    window.event.target.classList.add("active");
  }
  renderBacklogTable(priority);
};

// 6. Interactive Simulators
function initSimulators() {
  const intentSelect = document.getElementById("simIntentSelect");
  const resultWords = document.getElementById("simResultWords");
  const resultTime = document.getElementById("simResultTime");
  const resultStatus = document.getElementById("simResultStatus");

  if (intentSelect && resultWords && resultTime && resultStatus) {
    intentSelect.addEventListener("change", (e) => {
      const val = e.target.value;
      if (val === "define" || val === "locate") {
        resultWords.innerText = "≤ 80 từ";
        resultTime.innerText = "~15 giây đọc trong lớp";
        resultStatus.innerHTML = '<span class="chapter-badge badge-emerald">Tối ưu trong giờ học</span>';
      } else if (val === "simplify") {
        resultWords.innerText = "≤ 120 từ";
        resultTime.innerText = "~25 giây đọc (kèm Analogy)";
        resultStatus.innerHTML = '<span class="chapter-badge badge-blue">Dễ hiểu tức thời</span>';
      } else if (val === "deepen" || val === "summarize") {
        resultWords.innerText = "≤ 220 từ";
        resultTime.innerText = "~45 giây (Chỉ khi user bấm nút 'Xem chi tiết')";
        resultStatus.innerHTML = '<span class="chapter-badge badge-purple">Đào sâu có chủ đích</span>';
      }
    });
  }

  // Rule Tester Simulator
  const ruleInput = document.getElementById("simRuleInput");
  const ruleResult = document.getElementById("simRuleResult");
  if (ruleInput && ruleResult) {
    ruleInput.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase();
      if (!q.trim()) {
        ruleResult.innerHTML = `<span style="color: var(--text-muted); font-size: 0.9rem;">Hãy nhập câu hỏi mẫu để test...</span>`;
        return;
      }

      let matches = [];
      let primary = "2_noi_dung_bai_hoc (Fallback)";

      if (q.includes("trang") || q.includes("slide") || q.includes("ở đâu")) {
        matches.push("6_tim_slide");
        primary = "6_tim_slide";
      }
      if (q.includes("giải thích") || q.includes("đoạn này") || q.includes("bôi đen")) {
        matches.push("3_reference_trang");
        if (primary === "2_noi_dung_bai_hoc (Fallback)") primary = "3_reference_trang";
      }
      if (q.includes("nó") || q.includes("cái đó") || q.includes("chỗ này")) {
        matches.push("7_ngu_canh_dai_tu");
      }
      if (q.includes("hỏi") && (q.includes("test") || q.includes("random") || q.includes("quiz"))) {
        matches.push("4_tu_kiem_tra");
        primary = "4_tu_kiem_tra";
      }
      if (q.includes("chào") || q.includes("hi") || q.includes("cảm ơn")) {
        matches.push("1_xa_giao");
        primary = "1_xa_giao";
      }

      ruleResult.innerHTML = `
        <div style="font-size: 0.9rem; text-align: left;">
          <div><strong>Rule Khớp:</strong> ${matches.length ? matches.join(" | ") : "<span class='text-rose'>Không khớp (Fallback rỗng 30,2%)</span>"}</div>
          <div style="margin-top: 0.4rem;"><strong>Nhãn Resolve cuối:</strong> <span class="text-blue font-bold">${primary}</span></div>
        </div>
      `;
    });
  }
}

// 7. Live Q&A Sample Table
function renderSampleTable() {
  const data = getAppData();
  const tbody = document.getElementById("sampleTableBody");
  if (!tbody || !data.sampleQuestions) return;

  tbody.innerHTML = data.sampleQuestions.map(q => `
    <tr>
      <td><code>${q.id}</code></td>
      <td><span class="p2-badge">${q.label}</span></td>
      <td><strong>${q.intent}</strong></td>
      <td>Trang ${q.page}</td>
      <td style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${q.question}</td>
      <td><strong>${q.answerWords}</strong> từ</td>
      <td>${q.citationCount}</td>
      <td>${q.retry ? '<span class="p0-badge">Retry ⚠️</span>' : '<span style="color:var(--emerald-green); font-weight:700;">OK</span>'}</td>
    </tr>
  `).join("");
}

// 8. Mode Switcher (Dashboard vs Slide Presentation)
function initModeSwitcher() {
  const dashBtn = document.getElementById("btnModeDashboard");
  const slideBtn = document.getElementById("btnModeSlides");
  const dashPanel = document.getElementById("dashboardView");
  const slidePanel = document.getElementById("slidesView");

  if (!dashBtn || !slideBtn) return;

  dashBtn.addEventListener("click", () => {
    dashBtn.classList.add("active");
    slideBtn.classList.remove("active");
    dashPanel.classList.add("active");
    slidePanel.classList.remove("active");
  });

  slideBtn.addEventListener("click", () => {
    slideBtn.classList.add("active");
    dashBtn.classList.remove("active");
    slidePanel.classList.add("active");
    dashPanel.classList.remove("active");
    if (window.initSlideDeck) window.initSlideDeck();
  });
}
