(function () {
  function money(value) {
    const n = Number(value || 0);
    return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }

  function pct(value) {
    if (value === null || value === undefined || value === "") return "No attendance";
    const n = Number(value);
    if (Number.isNaN(n)) return "No attendance";
    return `${Math.round(n * 100)}%`;
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, text) {
    const el = byId(id);
    if (el) el.textContent = text;
  }

  function statusClass(value) {
    const status = String(value || "").toLowerCase();
    if (status === "active") return "tag tag-green";
    if (status === "trial") return "tag tag-yellow";
    if (status === "hold") return "tag tag-muted";
    if (status === "dropped") return "tag tag-red";
    return "tag";
  }

  function emptyState(message) {
    return `<div class="empty-state">${escapeHtml(message)}</div>`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderError(targetId, error) {
    const target = byId(targetId);
    if (!target) return;
    target.innerHTML = `<div class="alert alert-error">${escapeHtml(error.message || error)}</div>`;
  }

  function renderSetup(targetId) {
    const target = byId(targetId);
    if (!target) return false;
    if (!window.Auth.isConfigured() || !window.Api.isConfigured()) {
      target.innerHTML =
        '<div class="alert alert-warning">Configure <code>GOOGLE_CLIENT_ID</code> and <code>BACKEND_URL</code> in <code>js/config.js</code>, then deploy the Apps Script Web App.</div>';
      return true;
    }
    return false;
  }

  window.UI = { byId, emptyState, escapeHtml, money, pct, renderError, renderSetup, setText, statusClass };
})();
