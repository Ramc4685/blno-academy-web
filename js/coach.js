(async function () {
  const path = window.location.pathname;
  const isPayslip = path.includes("/coach/payslip");
  const isToday = path.includes("/coach/today");
  const isSessionDetail = path.includes("/coach/session");
  let activeSession = 0;

  function monthValue() {
    const el = UI.byId("coachMonth");
    return (el && el.value) || window.BLNO_CONFIG.DEFAULT_MONTH;
  }

  function renderSessionTabs(sessions) {
    const tabs = UI.byId("coachTabs");
    if (!tabs) return;
    tabs.innerHTML = sessions.map((session, index) => `
      <button class="${index === activeSession ? "active" : ""}" data-session-index="${index}">
        ${UI.escapeHtml(shortSession(session.name))}
      </button>`).join("");
    tabs.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        activeSession = Number(button.dataset.sessionIndex);
        renderSessions({ sessions: sessions, payout: currentPayout });
      });
    });
  }

  function shortSession(name) {
    return String(name || "").replace("(Coach - ", "(");
  }

  function renderSessions(data) {
    const sessions = data.sessions || [];
    currentPayout = data.payout;
    UI.setText("coachPayout", formatPayoutTotal(data.payout));
    UI.setText("coachSessionCount", String(sessions.length));
    renderSessionTabs(sessions);

    const target = UI.byId("coachSessions");
    if (!target) return;
    if (!sessions.length) {
      target.innerHTML = UI.emptyState("No sessions found for this coach and month.");
      return;
    }
    const visible = sessions[activeSession] || sessions[0];
    const detailHref = `coach/session.html?session=${encodeURIComponent(visible.name)}&month=${encodeURIComponent(monthValue())}`;
    const enrolled = visible.enrolled || [];
    const util = Number(visible.utilization ?? visible.util ?? 0);
    target.innerHTML = `
      <article class="session-card">
        <div class="card-title-row">
          <div>
            <h2>${UI.escapeHtml(visible.name)}</h2>
            <span>${enrolled.length}/${visible.capacity || visible.cap || 15} kids</span>
          </div>
          <span class="tag">${Math.round(util * 100)}% full</span>
        </div>
        <div class="capacity-track"><div class="capacity-bar" style="width: ${Math.min(100, Math.round(util * 100))}%"></div></div>
        <a class="primary-action" href="${detailHref}">Open session detail</a>
        <ul class="roster-list">
          ${enrolled.length ? enrolled.map((kid) => `
            <li>
              <strong>${UI.escapeHtml(kid.name)}${kid.age ? ` · ${UI.escapeHtml(kid.age)}` : ""}</strong>
              <span>${UI.pct(kid.attendancePct)}</span>
              <span class="${kid.paid ? "tag tag-green" : "tag tag-red"}">${kid.paid ? "Paid" : "Unpaid"}</span>
            </li>`).join("") : `<li>${UI.emptyState("No enrolled kids in this session.")}</li>`}
        </ul>
      </article>`;
  }

  function renderPayslip(rows) {
    const target = UI.byId("coachPayslipRows");
    if (!target) return;
    target.innerHTML = rows && rows.length
      ? rows.map((row) => `
          <tr>
            <td>${UI.escapeHtml(row.month)}</td>
            <td>${UI.escapeHtml(row.kids)}</td>
            <td>${UI.money(row.revenue)}</td>
            <td>${formatPayoutPct(row.pct)}</td>
            <td>${formatPayout(row)}</td>
          </tr>`).join("")
      : `<tr><td colspan="5">${UI.emptyState("No payout history found.")}</td></tr>`;
  }

  function sessionCard(session, month) {
    const enrolled = session.enrolled || [];
    const util = Number(session.utilization ?? session.util ?? 0);
    return `
      <article class="session-card">
        <div class="card-title-row">
          <div>
            <h2>${UI.escapeHtml(session.name)}</h2>
            <span>${enrolled.length}/${session.capacity || session.cap || 15} kids</span>
          </div>
          <span class="tag">${Math.round(util * 100)}% full</span>
        </div>
        <div class="capacity-track"><div class="capacity-bar" style="width: ${Math.min(100, Math.round(util * 100))}%"></div></div>
        <div class="quick-links">
          <a href="session.html?session=${encodeURIComponent(session.name)}&month=${encodeURIComponent(month)}">View roster</a>
          <a href="../admin/attendance.html">Mark attendance</a>
        </div>
        <ul class="roster-list">
          ${enrolled.length ? enrolled.map((kid) => `
            <li>
              <strong>${UI.escapeHtml(kid.name)}${kid.age ? ` · ${UI.escapeHtml(kid.age)}` : ""}</strong>
              <span>${UI.pct(kid.attendancePct)}</span>
              <span class="${kid.paid ? "tag tag-green" : "tag tag-red"}">${kid.paid ? "Paid" : "Unpaid"}</span>
            </li>`).join("") : `<li>${UI.emptyState("No kids in this session.")}</li>`}
        </ul>
      </article>`;
  }

  function setToday() {
    const input = UI.byId("coachTodayDate");
    if (input && !input.value) input.value = new Date().toISOString().slice(0, 10);
  }

  function renderToday(data) {
    UI.setText("todaySessionCount", String((data.todaySessions || []).length));
    UI.setText("todayPayout", UI.money(data.payout));
    const target = UI.byId("coachTodaySessions");
    if (!target) return;
    const sessions = data.todaySessions && data.todaySessions.length ? data.todaySessions : data.sessions || [];
    target.innerHTML = sessions.length
      ? sessions.map((session) => sessionCard(session, data.month)).join("")
      : UI.emptyState("No sessions found for today.");
  }

  function renderSessionDetail(data) {
    const target = UI.byId("coachSessionDetail");
    if (!target) return;
    target.innerHTML = data.session ? sessionCard(data.session, data.month) : UI.emptyState("No session found.");
  }

  function formatPayoutPct(value) {
    if (value === null || value === undefined || value === "") return "Set %";
    return `${Math.round(Number(value) * 100)}%`;
  }

  function formatPayout(row) {
    return row.pct === null || row.pct === undefined || row.pct === "" ? "Set payout %" : UI.money(row.payout);
  }

  function formatPayoutTotal(value) {
    return value === null || value === undefined || value === "" ? "Set payout %" : UI.money(value);
  }

  async function loadSessions() {
    const targetId = isPayslip ? "coachPayslipRows" : isToday ? "coachTodaySessions" : isSessionDetail ? "coachSessionDetail" : "coachSessions";
    if (UI.renderSetup(targetId)) return;
    try {
      await Auth.bootstrapProtectedPage();
      if (isPayslip) {
        const rows = await Api.get("coach_roster", { month: "all" });
        renderPayslip(rows.payslip || []);
      } else if (isToday) {
        setToday();
        renderToday(await Api.get("coach_today", { date: UI.byId("coachTodayDate")?.value, month: window.BLNO_CONFIG.DEFAULT_MONTH }));
      } else if (isSessionDetail) {
        const params = new URLSearchParams(window.location.search);
        const month = UI.byId("coachSessionMonth")?.value || params.get("month") || window.BLNO_CONFIG.DEFAULT_MONTH;
        const monthInput = UI.byId("coachSessionMonth");
        if (monthInput && !monthInput.value) monthInput.value = month;
        renderSessionDetail(await Api.get("coach_session_detail", { session: params.get("session") || "", month }));
      } else {
        renderSessions(await Api.get("coach_roster", { month: monthValue() }));
      }
    } catch (err) {
      UI.renderError(targetId, err);
    }
  }

  const month = UI.byId("coachMonth");
  if (month) month.addEventListener("change", loadSessions);
  UI.byId("coachTodayDate")?.addEventListener("change", loadSessions);
  UI.byId("coachSessionMonth")?.addEventListener("change", loadSessions);
  let currentPayout = 0;
  loadSessions();
})();
