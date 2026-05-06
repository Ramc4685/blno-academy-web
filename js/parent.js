(async function () {
  const path = window.location.pathname;
  const isHistory = path.includes("/parent/history");

  function monthlyRows(kids) {
    return kids.flatMap((kid) => {
      const months = kid.monthly || [];
      return months.map((m) => {
        const bill = Number(m.paid || 0) + Number(m.due || 0);
        return `
          <tr>
            <td>${UI.escapeHtml(kid.name)}</td>
            <td>${UI.escapeHtml(m.month)}</td>
            <td>${m.enrolled ? "Yes" : "No"}</td>
            <td>${UI.money(bill)}</td>
            <td>${UI.money(m.paid)}</td>
            <td class="${Number(m.due) > 0 ? "text-danger" : ""}">${UI.money(m.due)}</td>
            <td>${UI.pct(m.attendancePct ?? kid.attendancePct)}</td>
          </tr>`;
      });
    });
  }

  function renderHistory(kids) {
    const rows = monthlyRows(kids);
    const target = UI.byId("historyRows");
    if (!target) return;
    target.innerHTML = rows.length
      ? rows.join("")
      : `<tr><td colspan="7">${UI.emptyState("No monthly history found.")}</td></tr>`;
  }

  function renderSummary(kids) {
    const totalDue = kids.reduce((sum, kid) => sum + Number(kid.totalDue || 0), 0);
    const target = UI.byId("parentSummary");
    if (!target) return;
    target.innerHTML = totalDue > 0
      ? `<div class="due-banner">Outstanding dues: ${UI.money(totalDue)}. Please use Zelle and include your kid's name in the memo.</div>`
      : "";
  }

  function renderKids(kids) {
    const target = UI.byId("kidsGrid");
    if (!target) return;
    if (!kids.length) {
      target.innerHTML = UI.emptyState("No kids found for this Google account.");
      return;
    }

    target.innerHTML = kids.map((kid) => {
      const months = kid.monthly || [];
      const current = kid.currentMonth || months[months.length - 1] || {};
      return `
        <article class="kid-card">
          <div class="card-title-row">
            <div>
              <h2>${UI.escapeHtml(kid.name)}</h2>
              <span>${kid.age ? `${UI.escapeHtml(kid.age)} years old` : "Age not listed"}</span>
            </div>
            <span class="${UI.statusClass(kid.status)}">${UI.escapeHtml(kid.status || "Unknown")}</span>
          </div>
          <div class="meta-list">
            <div><span>Session</span><strong>${UI.escapeHtml(kid.session || "Not assigned")}</strong></div>
            <div><span>Coach</span><strong>${UI.escapeHtml(kid.coach || "Not assigned")}</strong></div>
            <div><span>Skill / Price</span><strong>${UI.escapeHtml(kid.skill || "-")} · ${UI.money(kid.price)}</strong></div>
            <div><span>Current month</span><strong>${current.enrolled ? "Enrolled" : "Not enrolled"}</strong></div>
            <div><span>Paid</span><strong>${UI.money(current.paid)}</strong></div>
            <div><span>Due</span><strong class="${Number(current.due) > 0 ? "text-danger" : ""}">${UI.money(current.due)}</strong></div>
            <div><span>Attendance</span><strong>${UI.pct(kid.attendancePct)}</strong></div>
            <div><span>Total dues</span><strong class="${Number(kid.totalDue) > 0 ? "text-danger" : ""}">${UI.money(kid.totalDue)}</strong></div>
          </div>
        </article>`;
    }).join("");
  }

  function renderMoves(kids) {
    const target = UI.byId("moveHistory");
    if (!target) return;
    const moves = kids.flatMap((kid) => (kid.moves || []).map((move) => ({ kid: kid.name, ...move })));
    if (!moves.length) {
      target.innerHTML = UI.emptyState("No moves found.");
      return;
    }
    target.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Kid</th><th>Month</th><th>From</th><th>To</th><th>Type</th></tr></thead>
          <tbody>
            ${moves.map((move) => `
              <tr>
                <td>${UI.escapeHtml(move.kid)}</td>
                <td>${UI.escapeHtml(move.month || move.effectiveMonth || "")}</td>
                <td>${UI.escapeHtml(move.from || "")}</td>
                <td>${UI.escapeHtml(move.to || "")}</td>
                <td>${UI.escapeHtml(move.type || "")}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }

  async function load() {
    const targetId = isHistory ? "historyRows" : "kidsGrid";
    if (UI.renderSetup(targetId)) return;
    try {
      await Auth.bootstrapProtectedPage();
      const kids = await Api.get("parent_kids");
      if (isHistory) renderHistory(kids || []);
      else {
        renderSummary(kids || []);
        renderKids(kids || []);
        renderMoves(kids || []);
      }
    } catch (err) {
      UI.renderError(targetId, err);
    }
  }

  load();
})();
