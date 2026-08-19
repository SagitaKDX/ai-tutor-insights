// AI Tutor Dashboard - Interactive Controller
document.addEventListener("DOMContentLoaded", () => {
  const data = window.AI_TUTOR_DATA;
  if (!data) return;

  initDashboardKPIs();
  initDashboardCharts();
  renderChaptersAccordion();
  renderBacklogTable();
  initSimulators();
  renderSampleTable();
  initThemeToggle();
  initModeSwitcher();
});

// 1. Render Dashboard KPIs
function initDashboardKPIs() {
  const grid = document.getElementById("kpiGrid");
  if (!grid) return;

  grid.innerHTML = data.overview.metrics.map(m => `
    <div class="kpi-card">
      <div class="kpi-header">
        <span class="kpi-title">${m.label}</span>
        <div class="kpi-icon ${m.color}">
          <i data-lucide="${m.icon}"></i>
        </div>
      </div>
      <div class="kpi-value">${m.value}</div>
      <div class="kpi-change">${m.change}</div>
    </div>
  `).join("");

  if (window.lucide) lucide.createIcons();
}

// 2. Initialize Chart.js Dashboard Visualizations
function initDashboardCharts() {
  // Chart 1: Context Capture Breakdown
  const ctxContext = document.getElementById("chartContextCapture");
  if (ctxContext) {
    new Chart(ctxContext, {
      type: "doughnut",
      data: {
        labels: ["Echo câu hỏi (Lỗi)", "Bôi đen thật (Slide)", "Không ngữ cảnh", "Nhúng thẳng UI"],
        datasets: [{
          data: [481, 405, 109, 5],
          backgroundColor: ["#f43f5e", "#10b981", "#64748b", "#06b6d4"],
          borderColor: "rgba(11, 15, 25, 0.8)",
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { color: "#9ca3af", font: { family: "Inter", size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.raw} dòng (${((ctx.raw / 1000) * 100).toFixed(1)}%)`
            }
          }
        },
        cutout: "68%"
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
            backgroundColor: "rgba(99, 102, 241, 0.4)",
            borderColor: "#6366f1",
            borderWidth: 1
          },
          {
            label: "Số lần thắng (Win)",
            data: [295, 33, 16, 299, 2],
            backgroundColor: ["#10b981", "#10b981", "#10b981", "#3b82f6", "#f43f5e"],
            borderColor: "transparent",
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { grid: { color: "rgba(255, 255, 255, 0.05)" }, ticks: { color: "#9ca3af" } },
          x: { grid: { display: false }, ticks: { color: "#9ca3af" } }
        },
        plugins: {
          legend: { position: "top", labels: { color: "#9ca3af" } }
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
          backgroundColor: ["#f43f5e", "#f59e0b", "#3b82f6", "#3b82f6", "#06b6d4", "#10b981", "#10b981"],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        scales: {
          x: {
            grid: { color: "rgba(255, 255, 255, 0.05)" },
            ticks: { color: "#9ca3af", callback: (v) => v + "%" },
            max: 25
          },
          y: { grid: { display: false }, ticks: { color: "#9ca3af" } }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  // Chart 4: Daily Volume
  const ctxDaily = document.getElementById("chartDailyVolume");
  if (ctxDaily) {
    new Chart(ctxDaily, {
      type: "line",
      data: {
        labels: ["10/08", "11/08", "12/08", "13/08", "14/08 (Peak)", "15/08"],
        datasets: [{
          label: "Số câu hỏi log",
          data: [62, 158, 152, 106, 466, 56],
          borderColor: "#06b6d4",
          backgroundColor: "rgba(6, 182, 212, 0.1)",
          fill: true,
          tension: 0.3,
          pointBackgroundColor: "#06b6d4",
          pointRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { grid: { color: "rgba(255, 255, 255, 0.05)" }, ticks: { color: "#9ca3af" } },
          x: { grid: { display: false }, ticks: { color: "#9ca3af" } }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }
}

// 3. Render 11 Chapters Accordion
function renderChaptersAccordion() {
  const container = document.getElementById("chaptersAccordion");
  if (!container) return;

  container.innerHTML = data.chapters.map((ch, idx) => `
    <div class="chapter-item ${idx === 1 ? 'active' : ''}" id="chapter-${ch.id}">
      <div class="chapter-header" onclick="toggleChapter(${ch.id})">
        <div class="chapter-title-group">
          <span class="chapter-num">CH.${ch.id}</span>
          <div>
            <div class="chapter-name">${ch.title}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${ch.subtitle}</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span class="chapter-badge badge-${ch.badgeColor}">${ch.badge}</span>
          <i data-lucide="chevron-down" class="chapter-toggle-icon"></i>
        </div>
      </div>
      <div class="chapter-body">
        <p class="chapter-summary">${ch.summary}</p>
        
        <div class="chapter-grid">
          <div class="takeaway-box">
            <div class="takeaway-title"><i data-lucide="lightbulb" style="color: var(--accent-amber); width:16px;"></i> Phát hiện cốt lõi</div>
            <ul class="clean-list">
              ${ch.keyTakeaways.map(t => `<li>${t}</li>`).join("")}
            </ul>
          </div>
          <div class="takeaway-box">
            <div class="takeaway-title"><i data-lucide="check-circle" style="color: var(--accent-emerald); width:16px;"></i> Đề xuất Hành động</div>
            <ul class="clean-list action-list">
              ${ch.actions.map(a => `<li>${a}</li>`).join("")}
            </ul>
          </div>
        </div>
      </div>
    </div>
  `).join("");

  if (window.lucide) lucide.createIcons();
}

window.toggleChapter = function(id) {
  const item = document.getElementById(`chapter-${id}`);
  if (item) {
    item.classList.toggle("active");
  }
};

// 4. Render Backlog Table with Priority Filter
function renderBacklogTable(filter = "ALL") {
  const tbody = document.getElementById("backlogTableBody");
  if (!tbody) return;

  const filtered = filter === "ALL" 
    ? data.backlog 
    : data.backlog.filter(b => b.priority === filter);

  tbody.innerHTML = filtered.map(b => `
    <tr>
      <td><span class="${b.priority.toLowerCase()}-badge">${b.priority}</span></td>
      <td><strong>${b.task}</strong></td>
      <td style="color: var(--text-secondary);">${b.reason}</td>
      <td><span class="tag-badge sm">${b.section}</span></td>
      <td><span style="font-size: 0.75rem; font-weight:600; color: ${b.impact === 'Critical' ? 'var(--accent-rose)' : 'var(--accent-cyan)'};">${b.impact}</span></td>
      <td><span style="font-size: 0.75rem; color: var(--text-muted);">${b.effort}</span></td>
      <td><span class="tag-badge sm" style="color: ${b.status === 'Ready' || b.status === 'In Progress' ? 'var(--accent-emerald)' : 'var(--text-muted)'};">${b.status}</span></td>
    </tr>
  `).join("");
}

window.filterBacklog = function(priority) {
  document.querySelectorAll(".filter-btn").forEach(btn => btn.classList.remove("active"));
  event.target.classList.add("active");
  renderBacklogTable(priority);
};

// 5. Interactive Simulators
function initSimulators() {
  const intentSelect = document.getElementById("simIntentSelect");
  const resultWords = document.getElementById("simResultWords");
  const resultTime = document.getElementById("simResultTime");
  const resultStatus = document.getElementById("simResultStatus");

  if (intentSelect) {
    intentSelect.addEventListener("change", (e) => {
      const val = e.target.value;
      if (val === "define" || val === "locate") {
        resultWords.innerText = "≤ 80 từ";
        resultTime.innerText = "~15 giây đọc trong lớp";
        resultStatus.innerHTML = '<span class="badge badge-emerald">Tối ưu trong giờ học</span>';
      } else if (val === "simplify") {
        resultWords.innerText = "≤ 120 từ";
        resultTime.innerText = "~25 giây đọc (kèm Analogy)";
        resultStatus.innerHTML = '<span class="badge badge-cyan">Dễ hiểu tức thời</span>';
      } else if (val === "deepen" || val === "summarize") {
        resultWords.innerText = "≤ 220 từ";
        resultTime.innerText = "~45 giây (Chỉ khi user bấm nút 'Xem chi tiết')";
        resultStatus.innerHTML = '<span class="badge badge-purple">Đào sâu có chủ đích</span>';
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
        ruleResult.innerHTML = `<span style="color: var(--text-muted);">Hãy nhập câu hỏi mẫu...</span>`;
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
        <div style="font-size: 0.85rem; text-align: left;">
          <div><strong>Rule Khớp:</strong> ${matches.length ? matches.join(" | ") : "Không khớp (Fallback rỗng 30,2%)"}</div>
          <div style="margin-top: 0.3rem;"><strong>Nhãn Resolve cuối:</strong> <span class="text-emerald font-bold">${primary}</span></div>
        </div>
      `;
    });
  }
}

// 6. Live Q&A Sample Table
function renderSampleTable() {
  const tbody = document.getElementById("sampleTableBody");
  if (!tbody) return;

  tbody.innerHTML = data.sampleQuestions.map(q => `
    <tr>
      <td><code>${q.id}</code></td>
      <td><span class="tag-badge sm">${q.label}</span></td>
      <td><strong>${q.intent}</strong></td>
      <td>Trang ${q.page}</td>
      <td style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${q.question}</td>
      <td>${q.answerWords} từ</td>
      <td>${q.citationCount}</td>
      <td>${q.retry ? '<span class="p0-badge">Retry ⚠️</span>' : '<span style="color:var(--accent-emerald);">OK</span>'}</td>
    </tr>
  `).join("");
}

// 7. Theme Toggle
function initThemeToggle() {
  const btn = document.getElementById("themeToggleBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const target = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", target);
    btn.innerHTML = target === "dark" ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
    if (window.lucide) lucide.createIcons();
  });
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
