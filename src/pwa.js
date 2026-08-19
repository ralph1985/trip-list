import { storageKeys } from "./storage.js";

function isInstalledApp() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function canUseBadge() {
  return isInstalledApp() && "setAppBadge" in navigator && "Notification" in window;
}

export function initPwa({ refs, getBadgeState, reducedMotion }) {
  let deferredInstallPrompt = null;
  let activeServiceWorkerRegistration = null;
  let isReloadingForUpdate = false;

  function updateConnectionStatus() {
    const online = navigator.onLine;
    refs.connectionStatus.classList.toggle("is-offline", !online);
    refs.connectionStatus.querySelector("span:last-child").textContent = online ? "Con conexión" : "Sin conexión · guardado local";
  }

  function updateAppBadge({ done, pending }) {
    if (!canUseBadge() || Notification.permission !== "granted") return;
    const update = done > 0 && pending > 0 ? navigator.setAppBadge?.(pending) : navigator.clearAppBadge?.();
    update?.catch(() => {});
  }

  function updateBadgeDialog() {
    const denied = "Notification" in window && Notification.permission === "denied";
    refs.badgeDialogMessage.textContent = denied
      ? "Las notificaciones están bloqueadas. Actívalas en Ajustes > Notificaciones > TripList para mostrar los globos."
      : "TripList puede mostrar en su icono cuántas cosas quedan pendientes.";
    refs.requestBadge.hidden = denied;
  }

  function showInstallButton(label = "Instalar") {
    refs.installButton.textContent = label;
    refs.installButton.hidden = false;
  }

  function showUpdateBanner(registration) {
    activeServiceWorkerRegistration = registration;
    refs.updateBanner.hidden = false;
  }

  refs.closeBadge.addEventListener("click", () => {
    refs.badgeDialog.open = false;
  });

  refs.requestBadge.addEventListener("click", async () => {
    const permission = await Notification.requestPermission();
    updateBadgeDialog();
    if (permission === "granted") {
      updateAppBadge(getBadgeState());
      refs.badgeDialog.open = false;
    }
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showInstallButton();
  });

  refs.installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      refs.installDialog.open = true;
      return;
    }
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    refs.installButton.hidden = true;
  });

  refs.closeInstall.addEventListener("click", () => {
    refs.installDialog.open = false;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    refs.installButton.hidden = true;
  });

  if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone) showInstallButton("Cómo instalar");

  refs.reloadButton.addEventListener("click", () => {
    const waitingWorker = activeServiceWorkerRegistration?.waiting;
    if (!waitingWorker) return window.location.reload();
    isReloadingForUpdate = true;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (isReloadingForUpdate) window.location.reload();
    });
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) showUpdateBanner(registration);
        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;
          installingWorker?.addEventListener("statechange", () => {
            if (installingWorker.state === "installed" && navigator.serviceWorker.controller) showUpdateBanner(registration);
          });
        });
      });
    });
  }

  window.addEventListener("online", updateConnectionStatus);
  window.addEventListener("offline", updateConnectionStatus);
  updateConnectionStatus();

  if (canUseBadge() && Notification.permission !== "granted" && !sessionStorage.getItem(storageKeys.badgePrompt)) {
    sessionStorage.setItem(storageKeys.badgePrompt, "shown");
    window.setTimeout(() => {
      updateBadgeDialog();
      refs.badgeDialog.open = true;
    }, 500);
  }

  return {
    updateAppBadge,
    tactileFeedback(duration = 8) {
      if (!reducedMotion.matches && typeof navigator.vibrate === "function") navigator.vibrate(duration);
    }
  };
}
