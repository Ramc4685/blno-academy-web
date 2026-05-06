(function () {
  function getConfig() {
    return window.BLNO_CONFIG || {};
  }

  function isConfigured() {
    const url = getConfig().BACKEND_URL || "";
    return url && !url.includes("PASTE_");
  }

  function buildUrl(action, params, token) {
    const url = new URL(getConfig().BACKEND_URL);
    url.searchParams.set("action", action);
    url.searchParams.set("id_token", token);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    });
    return url;
  }

  async function jsonp(action, params, token) {
    return new Promise((resolve, reject) => {
      const callback = `__blnoJsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const url = buildUrl(action, params, token);
      url.searchParams.set("callback", callback);

      const script = document.createElement("script");
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error("Apps Script request timed out."));
      }, 20000);

      function cleanup() {
        window.clearTimeout(timer);
        delete window[callback];
        script.remove();
      }

      window[callback] = (payload) => {
        cleanup();
        if (!payload || !payload.ok) reject(new Error((payload && payload.error) || "Request failed."));
        else resolve(payload.data);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error("Could not reach Apps Script. Check Web App access and deployment version."));
      };
      script.src = url.toString();
      document.head.appendChild(script);
    });
  }

  async function get(action, params) {
    if (!isConfigured()) {
      throw new Error("Add your Apps Script Web App URL in js/config.js.");
    }
    const token = await window.Auth.requireToken();
    const url = buildUrl(action, params, token);

    try {
      const response = await fetch(url.toString(), { method: "GET" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Request failed.");
      }
      return payload.data;
    } catch (err) {
      if (err instanceof TypeError || String(err.message || "").includes("fetch")) {
        return jsonp(action, params, token);
      }
      throw err;
    }
  }

  window.Api = { get, isConfigured };
})();
