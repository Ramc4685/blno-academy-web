(function () {
  const TOKEN_KEY = "blno.idToken";
  const PROFILE_KEY = "blno.profile";

  function getConfig() {
    return window.BLNO_CONFIG || {};
  }

  function isConfigured() {
    const id = getConfig().GOOGLE_CLIENT_ID || "";
    return id && !id.includes("PASTE_");
  }

  function decodeJwt(token) {
    try {
      const payload = token.split(".")[1];
      const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(
        atob(normalized)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(json);
    } catch (err) {
      return null;
    }
  }

  function saveToken(token) {
    const profile = decodeJwt(token);
    sessionStorage.setItem(TOKEN_KEY, token);
    if (profile) sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return profile;
  }

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function getProfile() {
    const raw = sessionStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  function clearSession() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(PROFILE_KEY);
  }

  function renderGoogleButton(targetId, onReady) {
    const target = document.getElementById(targetId);
    if (!target) return;

    if (!isConfigured()) {
      target.innerHTML =
        '<div class="setup-note">Add your Google OAuth Client ID in <code>js/config.js</code> to enable sign-in.</div>';
      if (onReady) onReady(false);
      return;
    }

    function init() {
      if (!window.google || !google.accounts || !google.accounts.id) return;
      google.accounts.id.initialize({
        client_id: getConfig().GOOGLE_CLIENT_ID,
        callback: (response) => {
          saveToken(response.credential);
          document.dispatchEvent(new CustomEvent("blno:signed-in"));
        }
      });
      google.accounts.id.renderButton(target, {
        theme: "outline",
        size: "large",
        type: "standard",
        shape: "rectangular",
        text: "signin_with",
        width: Math.min(320, target.clientWidth || 320)
      });
      if (onReady) onReady(true);
    }

    if (window.google) init();
    else window.addEventListener("load", init, { once: true });
  }

  async function requireToken() {
    const token = getToken();
    if (token) return token;
    throw new Error("Please sign in with Google first.");
  }

  async function bootstrapProtectedPage() {
    const profile = getProfile();
    const emailNodes = document.querySelectorAll("[data-user-email]");
    emailNodes.forEach((node) => {
      node.textContent = profile && profile.email ? profile.email : "Not signed in";
    });
    const signOutButtons = document.querySelectorAll("[data-sign-out]");
    signOutButtons.forEach((button) => {
      button.addEventListener("click", () => {
        clearSession();
        const home = document.querySelector(".brand-link");
        window.location.href = home ? home.getAttribute("href") : "index.html";
      });
    });
    return requireToken();
  }

  window.Auth = {
    clearSession,
    decodeJwt,
    getProfile,
    getToken,
    isConfigured,
    renderGoogleButton,
    requireToken,
    saveToken,
    bootstrapProtectedPage
  };
})();
