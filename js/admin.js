(async function () {
  const path = window.location.pathname;
  let adminContext = null;

  function defaultMonth(id) {
    const el = UI.byId(id);
    return (el && el.value) || window.BLNO_CONFIG.DEFAULT_MONTH;
  }

  function defaultMonthFromInput(id) {
    const el = UI.byId(id);
    if (el && !el.value) el.value = window.BLNO_CONFIG.DEFAULT_MONTH;
    return defaultMonth(id);
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

    const trend = (data.trend && data.trend.length)
      ? data.trend
      : [{ month: defaultMonth("adminMonth"), kids: data.kids, collected: data.collected }];
    const canvas = UI.byId("trendChart");
    if (!canvas || !window.Chart) return;
    if (window.blnoTrendChart) window.blnoTrendChart.destroy();
    window.blnoTrendChart = new Chart(canvas, {
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
                <a class="copy-button" target="_blank" rel="noopener" data-whatsapp-message="${index}" href="${whatsAppLink(row.phone, row.message)}">Open WhatsApp</a>
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
    target.querySelectorAll("[data-whatsapp-message]").forEach((link) => {
      link.addEventListener("click", () => {
        const row = rows[Number(link.dataset.whatsappMessage)];
        Api.post("send_due_reminder", { kid: row.kid, phone: row.phone, message: row.message }).catch(() => {});
      });
    });
  }

  function whatsAppLink(phone, message) {
    const digits = String(phone || "").replace(/\D/g, "");
    const normalized = digits.length === 10 ? `1${digits}` : digits;
    return `https://wa.me/${normalized}?text=${encodeURIComponent(message || "")}`;
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
            <td>${formatPayoutPct(row.pct)}</td>
            <td>${formatPayout(row)}</td>
          </tr>`).join("")
      : `<tr><td colspan="6">${UI.emptyState("No coach payout rows found.")}</td></tr>`;
  }

  function formatPayoutPct(value) {
    if (value === null || value === undefined || value === "") return "Set %";
    return `${Math.round(Number(value) * 100)}%`;
  }

  function formatPayout(row) {
    return row.pct === null || row.pct === undefined || row.pct === "" ? "Set payout %" : UI.money(row.payout);
  }

  async function loadAdminContext() {
    if (adminContext) return adminContext;
    adminContext = await Api.get("admin_kids");
    return adminContext;
  }

  function populateSelect(select, items, labelFn, valueFn) {
    if (!select) return;
    select.innerHTML = items.map((item) => {
      const label = labelFn ? labelFn(item) : item;
      const value = valueFn ? valueFn(item) : item;
      return `<option value="${UI.escapeHtml(value)}">${UI.escapeHtml(label)}</option>`;
    }).join("");
  }

  function setSelectValue(select, preferred) {
    if (!select || !preferred) return;
    const found = [...select.options].find((option) => option.value === preferred);
    if (found) select.value = preferred;
  }

  function currentMonthFromContext(ctx) {
    const configured = window.BLNO_CONFIG.DEFAULT_MONTH;
    if ((ctx.months || []).includes(configured)) return configured;
    return (ctx.months || [configured])[ctx.months.length - 1] || configured;
  }

  function currentKidMonth(kidName, month) {
    const kid = (adminContext?.kids || []).find((row) => row.name === kidName);
    if (!kid) return null;
    const monthly = (kid.monthly || []).find((row) => row.month === month);
    return { kid, monthly };
  }

  function updatePaymentCurrent() {
    const kidName = UI.byId("paymentKid")?.value;
    const month = UI.byId("paymentMonth")?.value;
    const current = currentKidMonth(kidName, month);
    const target = UI.byId("paymentCurrent");
    const selected = UI.byId("paymentSelected");
    if (!current) {
      if (target) target.innerHTML = "<span>Select a kid and month.</span><strong>$0</strong>";
      if (selected) selected.innerHTML = "<span>No student selected.</span>";
      return;
    }
    if (selected) {
      selected.innerHTML = `
        <span class="avatar">${UI.escapeHtml(UI.initials(current.kid.name))}</span>
        <div>
          <strong>${UI.escapeHtml(current.kid.name)}</strong>
          <span>Parent: ${UI.escapeHtml(current.kid.parent || "Not listed")}</span>
        </div>
        <span class="${Number(current.monthly?.due || 0) > 0 ? "tag tag-red" : "tag tag-green"}">${Number(current.monthly?.due || 0) > 0 ? "Due" : "Clear"}</span>`;
    }
    if (target) {
      const due = Number(current.monthly?.due || 0);
      target.innerHTML = `
        <span>Confirming payment for ${UI.escapeHtml(current.kid.name)}<br><small>Paid ${UI.money(current.monthly?.paid || 0)} · Due ${UI.money(due)}</small></span>
        <strong>${UI.money(Number(UI.byId("paymentAmount")?.value || due || current.monthly?.paid || 0))}</strong>`;
    }
    const amount = UI.byId("paymentAmount");
    if (amount && !amount.value) amount.value = Number(current.monthly?.due || current.monthly?.paid || 0);
  }

  async function initPayments() {
    const status = UI.byId("paymentStatus");
    const ctx = await loadAdminContext();
    let visibleKids = ctx.kids || [];
    function refreshKidOptions() {
      populateSelect(UI.byId("paymentKid"), visibleKids, (kid) => `${kid.name} · ${kid.parent || ""}`, (kid) => kid.name);
      updatePaymentCurrent();
    }
    refreshKidOptions();
    populateSelect(UI.byId("paymentMonth"), ctx.months);
    setSelectValue(UI.byId("paymentMonth"), currentMonthFromContext(ctx));
    updatePaymentCurrent();
    ["paymentKid", "paymentMonth"].forEach((id) => UI.byId(id)?.addEventListener("change", updatePaymentCurrent));
    UI.byId("paymentSearch")?.addEventListener("input", (event) => {
      const q = event.target.value.trim().toLowerCase();
      visibleKids = q
        ? ctx.kids.filter((kid) => `${kid.name} ${kid.parent || ""} ${kid.phone || ""}`.toLowerCase().includes(q))
        : ctx.kids;
      refreshKidOptions();
    });
    UI.byId("paymentAmount")?.addEventListener("input", updatePaymentCurrent);
    document.querySelectorAll("[data-payment-method]").forEach((button) => {
      button.addEventListener("click", () => {
        UI.byId("paymentMethod").value = button.dataset.paymentMethod;
        document.querySelectorAll("[data-payment-method]").forEach((btn) => {
          btn.classList.toggle("active", btn === button);
        });
      });
    });
    UI.byId("paymentForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      status.textContent = "Saving payment...";
      try {
        const result = await Api.post("mark_payment", {
          kid: UI.byId("paymentKid").value,
          month: UI.byId("paymentMonth").value,
          amount: UI.byId("paymentAmount").value,
          method: UI.byId("paymentMethod").value,
          note: UI.byId("paymentNote").value
        });
        adminContext = null;
        status.textContent = `Saved ${UI.money(result.paid)} for ${result.kid} (${result.month}).`;
      } catch (err) {
        status.textContent = err.message;
      }
    });
  }

  function setToday() {
    const input = UI.byId("attendanceDate");
    if (input && !input.value) input.value = new Date().toISOString().slice(0, 10);
  }

  function renderAttendanceRows() {
    const session = UI.byId("attendanceSession")?.value;
    const month = UI.byId("attendanceMonth")?.value;
    const target = UI.byId("attendanceRows");
    if (!target) return;
    const kids = (adminContext?.kids || []).filter((kid) => {
      const monthly = (kid.monthly || []).find((row) => row.month === month);
      return kid.session === session && monthly && monthly.enrolled && String(kid.status || "").toLowerCase() !== "dropped";
    });
    const progress = UI.byId("attendanceProgress");
    if (progress) progress.textContent = kids.length ? `${kids.length}/${kids.length} marked` : "0 marked";
    target.innerHTML = kids.length ? kids.map((kid) => `
      <article class="attendance-row" data-attendance-kid="${UI.escapeHtml(kid.name)}" data-attendance-value="Present">
        <div class="attendance-kid">
          <span class="avatar">${UI.escapeHtml(UI.initials(kid.name))}</span>
          <div>
            <strong>${UI.escapeHtml(kid.name)}</strong>
            <span>${UI.escapeHtml(kid.skill || kid.status || "Enrolled")}</span>
          </div>
        </div>
        <div class="attendance-actions">
          <div class="attendance-toggle" role="group" aria-label="Attendance for ${UI.escapeHtml(kid.name)}">
            <button type="button" class="active" data-attendance-set="Present">Present</button>
            <button type="button" data-attendance-set="Absent">Absent</button>
          </div>
        </div>
        <input data-attendance-note type="text" placeholder="Optional note">
      </article>`).join("") : UI.emptyState("No enrolled kids found for this session/month.");
    target.querySelectorAll("[data-attendance-set]").forEach((button) => {
      button.addEventListener("click", () => {
        const row = button.closest("[data-attendance-kid]");
        row.dataset.attendanceValue = button.dataset.attendanceSet;
        row.querySelectorAll("[data-attendance-set]").forEach((btn) => btn.classList.toggle("active", btn === button));
      });
    });
  }

  async function initAttendance() {
    const status = UI.byId("attendanceStatus");
    const me = await Api.get("me");
    let ctx;
    if (me.role === "coach") {
      const month = window.BLNO_CONFIG.DEFAULT_MONTH;
      const roster = await Api.get("coach_roster", { month });
      ctx = {
        months: [month],
        sessions: (roster.sessions || []).map((session) => session.name),
        kids: (roster.sessions || []).flatMap((session) => (session.enrolled || []).map((kid) => ({
          name: kid.name,
          session: session.name,
          skill: "",
          status: "Active",
          monthly: [{ month: month, enrolled: true, paid: kid.paid ? 1 : 0, due: kid.paid ? 0 : 1 }]
        })))
      };
      adminContext = ctx;
    } else {
      ctx = await loadAdminContext();
    }
    populateSelect(UI.byId("attendanceMonth"), ctx.months);
    populateSelect(UI.byId("attendanceSession"), ctx.sessions);
    setSelectValue(UI.byId("attendanceMonth"), currentMonthFromContext(ctx));
    setToday();
    renderAttendanceRows();
    ["attendanceMonth", "attendanceSession"].forEach((id) => UI.byId(id)?.addEventListener("change", renderAttendanceRows));
    UI.byId("attendanceForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const rows = [...document.querySelectorAll("[data-attendance-kid]")];
      const entries = rows.map((row) => ({
        kid: row.dataset.attendanceKid,
        status: row.dataset.attendanceValue || "Present",
        note: row.querySelector("[data-attendance-note]").value
      }));
      status.textContent = "Saving attendance...";
      try {
        const result = await Api.post("mark_attendance", {
          date: UI.byId("attendanceDate").value,
          session: UI.byId("attendanceSession").value,
          entries
        });
        status.textContent = `Saved ${result.count} attendance row${result.count === 1 ? "" : "s"}.`;
      } catch (err) {
        status.textContent = err.message;
      }
    });
  }

  function renderSettings(data) {
    const month = UI.byId("settingsDefaultMonth");
    if (month) {
      month.innerHTML = (data.months || []).map((m) => `<option value="${UI.escapeHtml(m)}">${UI.escapeHtml(m)}</option>`).join("");
      month.value = data.defaultMonth || window.BLNO_CONFIG.DEFAULT_MONTH;
    }
    const zelle = UI.byId("settingsZellePhone");
    if (zelle) zelle.value = data.zellePhone || "2488859243";
    const install = UI.byId("installInstructions");
    if (install) {
      install.innerHTML = (data.installInstructions || []).map((step, index) => `
        <div><span>Step ${index + 1}</span><strong>${UI.escapeHtml(step)}</strong></div>`).join("");
    }
  }

  async function initSettings() {
    const status = UI.byId("settingsStatus");
    renderSettings(await Api.get("admin_settings"));
    UI.byId("settingsForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      status.textContent = "Saving settings...";
      try {
        const data = await Api.post("save_admin_settings", {
          defaultMonth: UI.byId("settingsDefaultMonth").value,
          zellePhone: UI.byId("settingsZellePhone").value
        });
        renderSettings(data);
        status.textContent = "Settings saved. New API calls will use this default month when no month is selected.";
      } catch (err) {
        status.textContent = err.message;
      }
    });
  }

  async function load() {
    const target = path.includes("dues") ? "duesRows"
      : path.includes("sessions") ? "adminSessions"
      : path.includes("coaches") ? "coachPayoutRows"
      : path.includes("payments") ? "paymentStatus"
      : path.includes("attendance") ? "attendanceStatus"
      : path.includes("settings") ? "settingsStatus"
      : "adminStats";
    if (UI.renderSetup(target)) return;
    try {
      await Auth.bootstrapProtectedPage();
      if (path.includes("dues")) {
        renderDues(await Api.get("admin_dues", { filter: UI.byId("duesFilter")?.value || "all" }));
      } else if (path.includes("sessions")) {
        renderSessions(await Api.get("admin_sessions", { month: defaultMonthFromInput("sessionsMonth") }));
      } else if (path.includes("coaches")) {
        renderCoaches(await Api.get("admin_coaches", { month: defaultMonthFromInput("coachesMonth") }));
      } else if (path.includes("payments")) {
        await initPayments();
      } else if (path.includes("attendance")) {
        await initAttendance();
      } else if (path.includes("settings")) {
        await initSettings();
      } else {
        renderDashboard(await Api.get("admin_dashboard", { month: defaultMonthFromInput("adminMonth") }));
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
