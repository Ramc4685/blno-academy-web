(async function () {
  const path = window.location.pathname;

  function defaultMonth(id) {
    const el = UI.byId(id);
    return (el && el.value) || window.BLNO_CONFIG.DEFAULT_MONTH;
  }

  function renderDashboard(data) {
    const stats = [
      ["Enrolled kids", data.kids],
      ["Expected income", UI.money(data.expected)],
      ["Collected", UI.money(data.collected)],
      ["Outstanding", UI.money(data.dues)],
      ["Profit", UI.money(data.profit)]
    ];
    UI.byId("adminStats").innerHTML = stats.map(([label, value]) => `
      <article class="stat-card"><span>${label}</span><strong>${value}</strong></article>`).join("");

    const trend = data.trend || [];
    const canvas = UI.byId("trendChart");
    if (!canvas || !window.Chart) return;
    new Chart(canvas, {
      type: "line",
      data: {
        labels: trend.map((row) => row.month),
        datasets: [
          { label: "Enrollment", data: trend.map((row) => row.kids), borderColor: "#1f4e78", backgroundColor: "rgba(31,78,120,.1)", tension: 0.3 },
          { label: "Revenue", data: trend.map((row) => row.collected ?? row.revenue), borderColor: "#1b9e5a", backgroundColor: "rgba(27,158,90,.1)", tension: 0.3, yAxisID: "y1" }
        ]
      },
      options: {
        responsive: true,
        interaction: { mode: "index", intersect: false },
        scales: { y: { beginAtZero: true }, y1: { beginAtZero: true, position: "right", grid: { drawOnChartArea: false } } }
      }
    });
  }

  function renderDues(rows) {
    const target = UI.byId("duesRows");
    if (!target) return;
    target.innerHTML = rows && rows.length
      ? rows.map((row, index) => `
          <tr class="clickable" data-due-index="${index}">
            <td>${UI.escapeHtml(row.kid)}</td>
            <td>${UI.escapeHtml(row.parent)}</td>
            <td>${UI.escapeHtml(row.phone)}</td>
            <td class="text-danger">${UI.money(row.totalDue)}</td>
            <td>${UI.escapeHtml(row.status || "")}</td>
          </tr>
          <tr class="detail-row" hidden data-due-detail="${index}">
            <td colspan="5">
              <div class="whatsapp-message">
                <strong>WhatsApp reminder</strong>
                <span>${UI.escapeHtml(row.message || "")}</span>
                <button class="copy-button" data-copy-message="${index}">Copy text</button>
              </div>
            </td>
          </tr>`).join("")
      : `<tr><td colspan="5">${UI.emptyState("No outstanding dues found.")}</td></tr>`;

    target.querySelectorAll("[data-due-index]").forEach((row) => {
      row.addEventListener("click", () => {
        const detail = target.querySelector(`[data-due-detail="${row.dataset.dueIndex}"]`);
        if (detail) detail.hidden = !detail.hidden;
      });
    });
    target.querySelectorAll("[data-copy-message]").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.stopPropagation();
        const row = rows[Number(button.dataset.copyMessage)];
        await navigator.clipboard.writeText(row.message || "");
        button.textContent = "Copied";
      });
    });
  }

  function renderSessions(rows) {
    const target = UI.byId("adminSessions");
    if (!target) return;
    target.innerHTML = rows && rows.length
      ? rows.map((session) => {
          const enrolled = session.enrolled || [];
          const cap = session.cap || session.capacity || 15;
          const util = Number(session.util ?? session.utilization ?? enrolled.length / cap);
          return `
            <article class="session-card">
              <div class="card-title-row">
                <div>
                  <h2>${UI.escapeHtml(session.name)}</h2>
                  <span>${enrolled.length}/${cap} enrolled</span>
                </div>
                <span class="tag">${Math.round(util * 100)}%</span>
              </div>
              <div class="capacity-track"><div class="capacity-bar" style="width: ${Math.min(100, Math.round(util * 100))}%"></div></div>
              <ul class="roster-list">
                ${enrolled.length ? enrolled.map((kid) => `
                  <li><strong>${UI.escapeHtml(kid.name)}</strong><span></span><span class="${kid.paid ? "tag tag-green" : "tag tag-red"}">${kid.paid ? "Paid" : "Unpaid"}</span></li>`).join("") : `<li>${UI.emptyState("No kids enrolled.")}</li>`}
              </ul>
            </article>`;
        }).join("")
      : UI.emptyState("No sessions found.");
  }

  function renderCoaches(rows) {
    const target = UI.byId("coachPayoutRows");
    if (!target) return;
    target.innerHTML = rows && rows.length
      ? rows.map((row) => `
          <tr>
            <td>${UI.escapeHtml(row.coach)}</td>
            <td>${UI.escapeHtml(row.month)}</td>
            <td>${UI.escapeHtml(row.kids)}</td>
            <td>${UI.money(row.revenue)}</td>
            <td>${row.pct !== undefined ? `${Math.round(Number(row.pct) * 100)}%` : ""}</td>
            <td>${UI.money(row.payout)}</td>
          </tr>`).join("")
      : `<tr><td colspan="6">${UI.emptyState("No coach payout rows found.")}</td></tr>`;
  }

  async function load() {
    const target = path.includes("dues") ? "duesRows"
      : path.includes("sessions") ? "adminSessions"
      : path.includes("coaches") ? "coachPayoutRows"
      : "adminStats";
    if (UI.renderSetup(target)) return;
    try {
      await Auth.bootstrapProtectedPage();
      if (path.includes("dues")) {
        renderDues(await Api.get("admin_dues", { filter: UI.byId("duesFilter")?.value || "all" }));
      } else if (path.includes("sessions")) {
        renderSessions(await Api.get("admin_sessions", { month: defaultMonth("sessionsMonth") }));
      } else if (path.includes("coaches")) {
        renderCoaches(await Api.get("admin_coaches", { month: defaultMonth("coachesMonth") }));
      } else {
        renderDashboard(await Api.get("admin_dashboard", { month: defaultMonth("adminMonth") }));
      }
    } catch (err) {
      UI.renderError(target, err);
    }
  }

  ["adminMonth", "sessionsMonth", "coachesMonth", "duesFilter"].forEach((id) => {
    const el = UI.byId(id);
    if (el) el.addEventListener("change", load);
  });
  load();
})();
