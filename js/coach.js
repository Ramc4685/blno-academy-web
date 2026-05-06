(async function () {
  const path = window.location.pathname;
  const isPayslip = path.includes("/coach/payslip");
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
    UI.setText("coachPayout", UI.money(data.payout));
    UI.setText("coachSessionCount", String(sessions.length));
    renderSessionTabs(sessions);

    const target = UI.byId("coachSessions");
    if (!target) return;
    if (!sessions.length) {
      target.innerHTML = UI.emptyState("No sessions found for this coach and month.");
      return;
    }
    const visible = sessions[activeSession] || sessions[0];
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
            <td>${row.pct !== undefined ? `${Math.round(Number(row.pct) * 100)}%` : ""}</td>
            <td>${UI.money(row.payout)}</td>
          </tr>`).join("")
      : `<tr><td colspan="5">${UI.emptyState("No payout history found.")}</td></tr>`;
  }

  async function loadSessions() {
    const targetId = isPayslip ? "coachPayslipRows" : "coachSessions";
    if (UI.renderSetup(targetId)) return;
    try {
      await Auth.bootstrapProtectedPage();
      if (isPayslip) {
        const rows = await Api.get("coach_roster", { month: "all" });
        renderPayslip(rows.payslip || []);
      } else {
        renderSessions(await Api.get("coach_roster", { month: monthValue() }));
      }
    } catch (err) {
      UI.renderError(targetId, err);
    }
  }

  const month = UI.byId("coachMonth");
  if (month) month.addEventListener("change", loadSessions);
  let currentPayout = 0;
  loadSessions();
})();
