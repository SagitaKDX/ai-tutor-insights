// AI Tutor Slide Presentation Controller
let currentSlideIndex = 0;
let slideCharts = {};

window.initSlideDeck = function() {
  const data = window.AI_TUTOR_DATA;
  if (!data || !data.slides) return;

  renderCurrentSlide();
  initSlideKeyboardListeners();
};

function renderCurrentSlide() {
  const data = window.AI_TUTOR_DATA;
  const slide = data.slides[currentSlideIndex];
  if (!slide) return;

  const stage = document.getElementById("slideStage");
  const counter = document.getElementById("slideCounter");
  const progressBar = document.getElementById("slideProgressBar");
  const notesText = document.getElementById("speakerNotesText");
  const prevBtn = document.getElementById("btnPrevSlide");
  const nextBtn = document.getElementById("btnNextSlide");

  if (!stage) return;

  // Render Slide Content
  stage.innerHTML = `
    <div class="slide-header">
      <div class="slide-tag">${slide.tag}</div>
      <h2>${slide.title}</h2>
      <p>${slide.subtitle}</p>
    </div>
    <div class="slide-content-area">
      ${slide.content}
    </div>
    <div class="slide-footer-bar">
      <span>AI Tutor EDA Executive Report</span>
      <span>Slide ${slide.id} / ${data.slides.length}</span>
    </div>
  `;

  // Update Controls
  if (counter) counter.innerText = `${currentSlideIndex + 1} / ${data.slides.length}`;
  if (progressBar) {
    const pct = ((currentSlideIndex + 1) / data.slides.length) * 100;
    progressBar.style.width = `${pct}%`;
  }
  if (notesText) notesText.innerText = slide.notes || "Không có ghi chú.";

  if (prevBtn) prevBtn.disabled = currentSlideIndex === 0;
  if (nextBtn) nextBtn.disabled = currentSlideIndex === data.slides.length - 1;

  if (window.lucide) lucide.createIcons();

  // Trigger Slide Chart if specified
  setTimeout(() => {
    if (slide.chartInit && window[slide.chartInit]) {
      window[slide.chartInit]();
    }
  }, 50);
}

window.nextSlide = function() {
  const data = window.AI_TUTOR_DATA;
  if (currentSlideIndex < data.slides.length - 1) {
    currentSlideIndex++;
    renderCurrentSlide();
  }
};

window.prevSlide = function() {
  if (currentSlideIndex > 0) {
    currentSlideIndex--;
    renderCurrentSlide();
  }
};

window.toggleSpeakerNotes = function() {
  const drawer = document.getElementById("speakerNotesDrawer");
  if (drawer) drawer.classList.toggle("open");
};

window.toggleFullscreen = function() {
  const wrapper = document.getElementById("slideDeckWrapper");
  if (!document.fullscreenElement) {
    if (wrapper.requestFullscreen) wrapper.requestFullscreen();
    else if (wrapper.webkitRequestFullscreen) wrapper.webkitRequestFullscreen();
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
  }
};

function initSlideKeyboardListeners() {
  if (window._slideKeyAttached) return;
  window._slideKeyAttached = true;

  document.addEventListener("keydown", (e) => {
    // Only handle if in slides view
    const slidePanel = document.getElementById("slidesView");
    if (!slidePanel || !slidePanel.classList.contains("active")) return;

    if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
      e.preventDefault();
      window.nextSlide();
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      window.prevSlide();
    } else if (e.key.toLowerCase() === "f") {
      e.preventDefault();
      window.toggleFullscreen();
    } else if (e.key === "Home") {
      e.preventDefault();
      currentSlideIndex = 0;
      renderCurrentSlide();
    } else if (e.key === "End") {
      e.preventDefault();
      currentSlideIndex = window.AI_TUTOR_DATA.slides.length - 1;
      renderCurrentSlide();
    }
  });
}

// Slide-specific Chart Initializers
window.initSlideContextChart = function() {
  const ctx = document.getElementById("slideChartContext");
  if (!ctx) return;
  if (slideCharts.context) slideCharts.context.destroy();

  slideCharts.context = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Echo (48,1%)", "Bôi đen thật (40,5%)", "Không ngữ cảnh (10,9%)"],
      datasets: [{
        data: [481, 405, 109],
        backgroundColor: ["#f43f5e", "#10b981", "#64748b"]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { color: "#9ca3af", font: { size: 10 } } }
      }
    }
  });
};

window.initSlideRuleChart = function() {
  const ctx = document.getElementById("slideChartRuleWinRate");
  if (!ctx) return;
  if (slideCharts.rule) slideCharts.rule.destroy();

  slideCharts.rule = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Rule 6", "Rule 4", "Rule 1", "Rule 3", "Rule 7 ⚠️"],
      datasets: [{
        label: "Win Rate (%)",
        data: [97.0, 94.0, 94.0, 60.0, 0.5],
        backgroundColor: ["#10b981", "#10b981", "#10b981", "#3b82f6", "#f43f5e"]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { ticks: { color: "#9ca3af", callback: v => v + "%" }, max: 100 },
        x: { ticks: { color: "#9ca3af" } }
      },
      plugins: { legend: { display: false } }
    }
  });
};

window.initSlideRetryChart = function() {
  const ctx = document.getElementById("slideChartRetry");
  if (!ctx) return;
  if (slideCharts.retry) slideCharts.retry.destroy();

  slideCharts.retry = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Đơn giản hóa ⚠️", "Xin ví dụ ⚠️", "So sánh", "Định nghĩa", "Tóm tắt"],
      datasets: [{
        label: "Retry Rate (%)",
        data: [20.0, 13.8, 6.2, 5.5, 3.6],
        backgroundColor: ["#f43f5e", "#f59e0b", "#3b82f6", "#3b82f6", "#10b981"],
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      scales: {
        x: { ticks: { color: "#9ca3af", callback: v => v + "%" }, max: 25 },
        y: { ticks: { color: "#9ca3af" } }
      },
      plugins: { legend: { display: false } }
    }
  });
};
