(function () {
  const thisScript = document.currentScript || document.querySelector('script[src$="js/pwa.js"]');
  const appRoot = thisScript ? new URL("../", thisScript.src) : new URL("./", window.location.href);
  const manifestUrl = new URL("manifest.webmanifest", appRoot);
  const swUrl = new URL("sw.js", appRoot);
  let deferredPrompt = null;

  function ensureManifest() {
    if (document.querySelector('link[rel="manifest"]')) return;
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = manifestUrl.href;
    document.head.appendChild(link);
  }

  function updateInstallButton(button, message) {
    if (!button) return;
    if (message) button.textContent = message;
    button.hidden = false;
  }

  function initInstallButton() {
    const button = document.querySelector("[data-install-app]");
    const note = document.querySelector("[data-install-note]");
    if (!button) return;

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredPrompt = event;
      updateInstallButton(button, "Install app");
      if (note) note.textContent = "Install this portal on your phone for faster access.";
    });

    button.addEventListener("click", async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        button.hidden = true;
        return;
      }
      button.hidden = false;
      button.textContent = "Add to Home Screen";
      if (note) {
        note.textContent = /iphone|ipad|ipod/i.test(navigator.userAgent)
          ? "On iPhone: tap Share, then Add to Home Screen."
          : "Use your browser menu and choose Install app or Add to Home screen.";
      }
    });

    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
      updateInstallButton(button, "Add to Home Screen");
      if (note) note.textContent = "On iPhone: tap Share, then Add to Home Screen.";
    }
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    try {
      await navigator.serviceWorker.register(swUrl.href, { scope: appRoot.pathname });
    } catch (err) {
      console.warn("Service worker registration failed", err);
    }
  }

  ensureManifest();
  initInstallButton();
  window.addEventListener("load", registerServiceWorker);
})();
