(function () {
  function getConfig() {
    return window.BLNO_CONFIG || {};
  }

  function isConfigured() {
    const url = getConfig().BACKEND_URL || "";
    return url && !url.includes("PASTE_");
  }

  async function get(action, params) {
    if (!isConfigured()) {
      throw new Error("Add your Apps Script Web App URL in js/config.js.");
    }
    const token = await window.Auth.requireToken();
    const url = new URL(getConfig().BACKEND_URL);
    url.searchParams.set("action", action);
    url.searchParams.set("id_token", token);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    });

    const response = await fetch(url.toString(), { method: "GET" });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Request failed.");
    }
    return payload.data;
  }

  window.Api = { get, isConfigured };
})();
