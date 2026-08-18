import "@awesome.me/webawesome/dist/styles/layers.css";
import "@awesome.me/webawesome/dist/styles/themes/default.css";
import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/checkbox/checkbox.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import "@awesome.me/webawesome/dist/components/progress-bar/progress-bar.js";
import "@awesome.me/webawesome/dist/components/animation/animation.js";
import "@awesome.me/webawesome/dist/components/dialog/dialog.js";
import { loadCheckedIds, loadCurrentSection, loadCurrentView, loadShowCompleted, saveCheckedIds, saveNavigation, saveShowCompleted } from "./src/storage.js";
import { checklistItem, escapeHtml, slugify, undoItem } from "./src/ui.js";
import { initPwa } from "./src/pwa.js";
import { createPeerSync } from "./src/peer-sync.js";
const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
const listDefinition = JSON.parse(document.querySelector("#list-definition").textContent);
const initialCheckedIds = loadCheckedIds();

function syncColorScheme() {
  document.documentElement.classList.toggle("wa-dark", colorScheme.matches);
  document.documentElement.classList.toggle("wa-light", !colorScheme.matches);
}

syncColorScheme();
colorScheme.addEventListener("change", syncColorScheme);

let sections = listDefinition.map((section) => ({
  ...section,
  id: slugify(section.name),
  items: section.items.map((label) => ({
    id: `${slugify(section.name)}-${slugify(label)}`,
    label,
    done: initialCheckedIds.has(`${slugify(section.name)}-${slugify(label)}`)
  }))
}));

let currentView = loadCurrentView();
let activeSectionId = loadCurrentSection(sections);
let showCompleted = loadShowCompleted();
let searchTerm = "";
const undoTargets = new Map();
const undoTimers = new Map();
const scrollPositions = new Map();
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const refs = {
  checklist: document.querySelector("#checklist"),
  sectionTitle: document.querySelector("#section-title"),
  progressLabel: document.querySelector("#progress-label"),
  progressPercent: document.querySelector("#progress-percent"),
  progressBar: document.querySelector("#progress-bar"),
  progressMessage: document.querySelector("#progress-message"),
  completedToggle: document.querySelector("#completed-toggle"),
  sectionToggle: document.querySelector("#section-toggle"),
  overviewGrid: document.querySelector("#overview-grid"),
  categoriesList: document.querySelector("#categories-list"),
  pendingList: document.querySelector("#pending-list"),
  pendingCount: document.querySelector("#pending-count"),
  mobilePendingCount: document.querySelector("#mobile-pending-count"),
  overviewStatus: document.querySelector("#overview-status"),
  pendingStatus: document.querySelector("#pending-status"),
  searchInput: document.querySelector("#search-input"),
  clearSearch: document.querySelector("#clear-search"),
  resetDialog: document.querySelector("#reset-dialog"),
  cancelReset: document.querySelector("#cancel-reset"),
  confirmReset: document.querySelector("#confirm-reset"),
  connectionStatus: document.querySelector("#connection-status"),
  storageWarning: document.querySelector("#storage-warning"),
  installButton: document.querySelector("#install-button"),
  installDialog: document.querySelector("#install-dialog"),
  closeInstall: document.querySelector("#close-install"),
  badgeDialog: document.querySelector("#badge-dialog"),
  badgeDialogMessage: document.querySelector("#badge-dialog-message"),
  closeBadge: document.querySelector("#close-badge"),
  requestBadge: document.querySelector("#request-badge"),
  updateBanner: document.querySelector("#update-banner"),
  reloadButton: document.querySelector("#reload-button"),
  quickActions: document.querySelector("#quick-actions"),
  quickSectionToggle: document.querySelector("#quick-section-toggle"),
  syncButton: document.querySelector("#sync-button"),
  syncDialog: document.querySelector("#sync-dialog"),
  closeSync: document.querySelector("#close-sync"),
  syncStatus: document.querySelector("#sync-status"),
  syncStart: document.querySelector("#sync-start"),
  syncCreateOffer: document.querySelector("#sync-create-offer"),
  syncUseOffer: document.querySelector("#sync-use-offer"),
  syncOfferStep: document.querySelector("#sync-offer-step"),
  syncOfferOutput: document.querySelector("#sync-offer-output"),
  syncCopyOffer: document.querySelector("#sync-copy-offer"),
  syncAnswerInput: document.querySelector("#sync-answer-input"),
  syncAcceptAnswer: document.querySelector("#sync-accept-answer"),
  syncAnswerStep: document.querySelector("#sync-answer-step"),
  syncOfferInput: document.querySelector("#sync-offer-input"),
  syncAcceptOffer: document.querySelector("#sync-accept-offer"),
  syncAnswerOutputWrap: document.querySelector("#sync-answer-output-wrap"),
  syncAnswerOutput: document.querySelector("#sync-answer-output"),
  syncCopyAnswer: document.querySelector("#sync-copy-answer")
};

window.addEventListener("trip-list-storage-unavailable", () => {
  refs.storageWarning.hidden = false;
});

window.addEventListener("trip-list-storage-available", () => {
  refs.storageWarning.hidden = true;
});

function activeSection() {
  return sections.find((section) => section.id === activeSectionId) ?? sections[0];
}

function totals() {
  const items = sections.flatMap((section) => section.items);
  const done = items.filter((item) => item.done).length;
  return { total: items.length, done, pending: items.length - done };
}

function currentCheckedIds() {
  return sections.flatMap((section) => section.items).filter((item) => item.done).map((item) => item.id);
}

function applySyncedIds(receivedIds) {
  const mergedIds = new Set([...currentCheckedIds(), ...receivedIds]);
  sections.forEach((section) => section.items.forEach((item) => { item.done = mergedIds.has(item.id); }));
  clearUndoTargets();
  saveCheckedIds(sections);
  render();
}

function sectionProgress(section) {
  const done = section.items.filter((item) => item.done).length;
  return { done, total: section.items.length, pending: section.items.length - done };
}

function setUndoTarget(sectionId, itemId) {
  removeUndoTarget(itemId, false);
  undoTargets.set(itemId, { sectionId, itemId });
  undoTimers.set(itemId, window.setTimeout(() => {
    removeUndoTarget(itemId);
  }, 6000));
}

function removeUndoTarget(itemId, shouldRender = true) {
  const timer = undoTimers.get(itemId);
  if (timer) window.clearTimeout(timer);
  undoTimers.delete(itemId);
  undoTargets.delete(itemId);
  if (shouldRender) render();
}

function clearUndoTargets() {
  undoTimers.forEach((timer) => window.clearTimeout(timer));
  undoTimers.clear();
  undoTargets.clear();
}

function navigationKey() {
  return currentView === "category" ? `category:${activeSectionId}` : currentView;
}

function saveScrollPosition() {
  scrollPositions.set(navigationKey(), window.scrollY);
}

function restoreScrollPosition() {
  const position = scrollPositions.get(navigationKey()) ?? 0;
  window.requestAnimationFrame(() => window.scrollTo({ top: position, behavior: "auto" }));
}

function setView(view) {
  saveScrollPosition();
  currentView = view;
  saveNavigation(currentView, activeSectionId);
  const updateView = () => {
    document.querySelectorAll(".view-tab").forEach((tab) => {
      const active = tab.dataset.view === view || (view === "category" && tab.dataset.view === "categories");
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-current", active ? "page" : "false");
    });
    document.querySelectorAll(".view-panel").forEach((panel) => {
      panel.hidden = panel.id !== `${view}-view` && !(view === "category" && panel.id === "category-view");
    });
    const activePanel = document.querySelector(`#${view}-view`) ?? document.querySelector("#category-view");
    if (activePanel) {
      activePanel.classList.remove("is-entering");
      void activePanel.offsetWidth;
      activePanel.classList.add("is-entering");
      window.setTimeout(() => activePanel.classList.remove("is-entering"), 240);
    }
    render();
    restoreScrollPosition();
  };
  if (document.startViewTransition && !reducedMotion.matches) document.startViewTransition(updateView);
  else updateView();
}

function updateProgress() {
  const { total, done, pending } = totals();
  const percent = total ? Math.round((done / total) * 100) : 0;
  refs.progressLabel.textContent = `${done} de ${total} listos`;
  refs.progressPercent.textContent = `${percent}%`;
  refs.progressBar.value = percent;
  refs.progressBar.label = `Progreso: ${percent}%`;
  refs.pendingCount.textContent = pending;
  refs.mobilePendingCount.textContent = pending;
  refs.progressMessage.textContent = pending === 0 ? "Todo preparado para salir." : `${pending} ${pending === 1 ? "cosa pendiente" : "cosas pendientes"} para revisar.`;
  refs.overviewStatus.textContent = pending === 0 ? "Lista completa" : `${pending} pendientes`;
  refs.pendingStatus.textContent = searchTerm ? "Filtrando resultados" : `${pending} por revisar`;
  updateAppBadge(pending);
}

function updateQuickActions() {
  refs.quickActions.hidden = currentView !== "category";
  refs.quickSectionToggle.hidden = currentView !== "category";
  if (currentView === "category") {
    const section = activeSection();
    const allDone = section && section.items.length > 0 && section.items.every((item) => item.done);
    refs.quickSectionToggle.querySelector("span").textContent = allDone ? "Desmarcar categoría" : "Marcar categoría";
  }
}

function renderOverview() {
  const visibleSections = showCompleted ? sections : sections.filter((section) => section.items.some((item) => !item.done));
  refs.overviewGrid.innerHTML = visibleSections.length ? visibleSections.map((section) => {
    const progress = sectionProgress(section);
    const state = progress.pending === 0 ? "complete" : progress.done > 0 ? "started" : "fresh";
    const originalIndex = sections.indexOf(section);
    return `<button class="category-card ${state} ${originalIndex % 5 === 0 ? "is-featured" : ""}" type="button" data-open-section="${section.id}" data-section-summary="${section.id}">
      <span class="category-index">${String(originalIndex + 1).padStart(2, "0")}</span>
      <span class="category-card-copy"><strong>${escapeHtml(section.name)}</strong><small data-section-pending>${progress.pending === 0 ? "Completado" : `${progress.pending} ${progress.pending === 1 ? "pendiente" : "pendientes"}`}</small></span>
      <span class="category-arrow" aria-hidden="true">↗</span>
      <span class="mini-progress" aria-hidden="true"><span data-section-progress style="width: ${section.items.length ? (progress.done / section.items.length) * 100 : 0}%"></span></span>
    </button>`;
  }).join("") : `<div class="empty-state compact overview-empty"><span class="empty-symbol">✓</span><strong>No quedan categorías pendientes</strong><p>La lista está completa.</p></div>`;
}

function renderCategories() {
  const visibleSections = showCompleted ? sections : sections.filter((section) => section.items.some((item) => !item.done));
  refs.categoriesList.innerHTML = visibleSections.length ? visibleSections.map((section) => {
    const progress = sectionProgress(section);
    return `<button class="category-row" type="button" data-open-section="${section.id}" data-section-summary="${section.id}">
      <span class="category-row-name">${escapeHtml(section.name)}</span>
      <span class="category-row-progress"><span data-section-count>${progress.done}/${progress.total}</span><span class="row-bar"><i data-section-progress style="width: ${progress.total ? (progress.done / progress.total) * 100 : 0}%"></i></span></span>
      <span class="category-arrow" aria-hidden="true">→</span>
    </button>`;
  }).join("") : `<div class="empty-state compact"><span class="empty-symbol">✓</span><strong>No quedan categorías pendientes</strong><p>La lista está completa.</p></div>`;
}

function renderPending() {
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase();
  const groups = sections.map((section) => ({
    section,
    items: section.items.filter((item) => {
      const isUndoTarget = undoTargets.has(item.id);
      return ((!item.done || showCompleted) || (!showCompleted && isUndoTarget)) && (!normalizedSearch || item.label.toLocaleLowerCase().includes(normalizedSearch) || section.name.toLocaleLowerCase().includes(normalizedSearch));
    })
  })).filter(({ items }) => items.length);

  refs.clearSearch.hidden = !searchTerm;
  refs.pendingList.innerHTML = groups.length
    ? groups.map(({ section, items }) => `<section class="pending-group"><div class="pending-group-heading"><h3>${escapeHtml(section.name)}</h3><button type="button" data-open-section="${section.id}">Ver sección →</button></div><ul class="checklist">${items.map((item) => undoTargets.has(item.id) ? undoItem(item.id) : checklistItem(item)).join("")}</ul></section>`).join("")
    : `<div class="empty-state"><span class="empty-symbol">✓</span><strong>${searchTerm ? "No hemos encontrado nada" : "No quedan pendientes"}</strong><p>${searchTerm ? "Prueba con otra palabra." : "La lista está completa. Buen viaje."}</p></div>`;
}


function renderCategory() {
  const section = activeSection();
  if (!section) return;
  const progress = sectionProgress(section);
  refs.sectionTitle.textContent = section.name;
  const allDone = progress.total > 0 && progress.pending === 0;
  refs.sectionToggle.textContent = allDone ? "Desmarcar todo" : "Marcar todo";
  refs.sectionToggle.setAttribute("aria-label", `${allDone ? "Desmarcar" : "Marcar"} todos los elementos de ${section.name}`);
  const items = section.items.filter((item) => {
    const isUndoTarget = undoTargets.has(item.id);
    return showCompleted || !item.done || isUndoTarget;
  });
  refs.checklist.innerHTML = items.length ? items.map((item) => undoTargets.has(item.id) ? undoItem(item.id) : checklistItem(item)).join("") : `<li class="empty-state compact"><strong>${section.items.length ? "No hay elementos pendientes" : "Esta sección está vacía"}</strong><p>${section.items.length ? "Puedes volver a mostrar los completados." : ""}</p></li>`;
}

function render() {
  updateProgress();
  refs.completedToggle.textContent = showCompleted ? "Ocultar completados" : "Mostrar completados";
  refs.completedToggle.setAttribute("aria-pressed", String(!showCompleted));
  updateQuickActions();
  renderOverview();
  renderCategories();
  renderPending();
  if (currentView === "category") renderCategory();
}

function updateSectionSummary(section) {
  const progress = sectionProgress(section);
  document.querySelectorAll(`[data-section-summary="${section.id}"]`).forEach((summary) => {
    const pending = summary.querySelector("[data-section-pending]");
    const count = summary.querySelector("[data-section-count]");
    const bar = summary.querySelector("[data-section-progress]");
    if (pending) pending.textContent = progress.pending === 0 ? "Completado" : `${progress.pending} ${progress.pending === 1 ? "pendiente" : "pendientes"}`;
    if (count) count.textContent = `${progress.done}/${progress.total}`;
    if (bar) bar.style.width = `${progress.total ? (progress.done / progress.total) * 100 : 0}%`;
    summary.classList.toggle("complete", progress.pending === 0);
    summary.classList.toggle("started", progress.done > 0 && progress.pending > 0);
  });
}

function updateVisibleItem(item, section) {
  updateSectionSummary(section);
  updateProgress();
  const containers = [];
  if (currentView === "pending") containers.push(refs.pendingList);
  if (currentView === "category" && activeSectionId === section.id) containers.push(refs.checklist);
  containers.forEach((container) => {
    const checkbox = container.querySelector(`[data-item="${item.id}"]`);
    const undoButton = container.querySelector(`[data-undo="${item.id}"]`);
    const row = checkbox?.closest("li") ?? undoButton?.closest("li");
    if (!row) return;
    if (item.done && !showCompleted) {
      row.outerHTML = undoItem(item.id);
      return;
    }
    if (item.done) {
      row.classList.add("is-done", "was-just-completed");
      const rowCheckbox = row.querySelector("wa-checkbox");
      if (rowCheckbox) rowCheckbox.checked = true;
      return;
    }
    row.outerHTML = checklistItem(item);
    container.querySelector(`[data-item="${item.id}"]`)?.closest("li")?.classList.add("was-just-restored");
  });
}

document.querySelectorAll(".view-tab").forEach((tab) => tab.addEventListener("click", () => setView(tab.dataset.view)));

document.addEventListener("click", (event) => {
  const undoButton = event.target.closest("[data-undo]");
  if (undoButton && undoTargets.has(undoButton.dataset.undo)) {
    const item = sections.flatMap((section) => section.items).find((entry) => entry.id === undoButton.dataset.undo);
    const section = sections.find((entry) => entry.items.some((entryItem) => entryItem.id === undoButton.dataset.undo));
    if (item) {
      item.done = false;
      saveCheckedIds(sections);
    }
    removeUndoTarget(undoButton.dataset.undo, false);
    if (item && section) updateVisibleItem(item, section);
    return;
  }
  const openButton = event.target.closest("[data-open-section]");
  if (openButton) {
    activeSectionId = openButton.dataset.openSection;
    setView("category");
  }
});

refs.checklist.addEventListener("change", (event) => toggleItem(event.target.closest("[data-item]")));
refs.pendingList.addEventListener("change", (event) => toggleItem(event.target.closest("[data-item]")));

function toggleItem(checkbox) {
  if (!checkbox) return;
  const item = sections.flatMap((section) => section.items).find((entry) => entry.id === checkbox.dataset.item);
  if (!item) return;
  const section = sections.find((entry) => entry.items.some((entryItem) => entryItem.id === item.id));
  item.done = checkbox.checked;
  if (item.done && !showCompleted && section) setUndoTarget(section.id, item.id);
  if (!item.done) removeUndoTarget(item.id, false);
  saveCheckedIds(sections);
  tactileFeedback(item.done ? 8 : 5);
  updateVisibleItem(item, section);
}

function toggleCompletedVisibility() {
  showCompleted = !showCompleted;
  clearUndoTargets();
  saveShowCompleted(showCompleted);
  render();
}

refs.completedToggle.addEventListener("click", toggleCompletedVisibility);
refs.quickSectionToggle.addEventListener("click", () => refs.sectionToggle.click());

refs.sectionToggle.addEventListener("click", () => {
  const section = activeSection();
  if (!section) return;
  const allDone = section.items.length > 0 && section.items.every((item) => item.done);
  section.items.forEach((item) => { item.done = !allDone; });
  saveCheckedIds(sections);
  tactileFeedback(12);
  render();
});

document.querySelector("#back-to-categories").addEventListener("click", () => setView("categories"));
refs.searchInput.addEventListener("input", (event) => {
  searchTerm = event.target.value;
  render();
});
refs.clearSearch.addEventListener("click", () => {
  searchTerm = "";
  refs.searchInput.value = "";
  refs.searchInput.focus();
  render();
});

document.querySelector("#reset-button").addEventListener("click", () => {
  refs.resetDialog.open = true;
});

refs.cancelReset.addEventListener("click", () => {
  refs.resetDialog.open = false;
});

refs.confirmReset.addEventListener("click", () => {
  refs.resetDialog.open = false;
  sections.forEach((section) => section.items.forEach((item) => { item.done = false; }));
  saveCheckedIds(sections);
  render();
});

const peerSync = createPeerSync({
  onStatus: (status) => {
    const messages = {
      gathering: "Preparando el código…",
      waiting: "Código listo. Completa el intercambio.",
      connecting: "Conectando directamente…",
      connected: "Conexión directa establecida. Sincronizando…",
      closed: "Conexión cerrada.",
      error: "No se ha podido conectar. Prueba con ambos dispositivos en la misma Wi‑Fi."
    };
    refs.syncStatus.textContent = messages[status] ?? "";
    refs.syncStatus.classList.toggle("is-error", status === "error");
    if (status === "connected") {
      try {
        peerSync.send(currentCheckedIds());
        refs.syncStatus.textContent = "Sincronización completada. Puedes cerrar esta ventana.";
      } catch {
        refs.syncStatus.textContent = "La conexión se abrió, pero no se pudo enviar el estado.";
      }
    }
  },
  onMessage: (receivedIds) => {
    applySyncedIds(receivedIds);
    refs.syncStatus.textContent = "Sincronización completada. Se han conservado las marcas de ambos dispositivos.";
  }
});

function resetSyncDialog() {
  peerSync.close();
  refs.syncStart.hidden = false;
  refs.syncOfferStep.hidden = true;
  refs.syncAnswerStep.hidden = true;
  refs.syncAnswerOutputWrap.hidden = true;
  refs.syncStatus.textContent = "";
  refs.syncStatus.classList.remove("is-error");
  refs.syncOfferOutput.value = "";
  refs.syncAnswerInput.value = "";
  refs.syncOfferInput.value = "";
  refs.syncAnswerOutput.value = "";
}

async function copySyncCode(textarea, button) {
  try {
    await navigator.clipboard.writeText(textarea.value);
    const original = button.textContent;
    button.textContent = "Copiado";
    window.setTimeout(() => { button.textContent = original; }, 1400);
  } catch {
    textarea.focus();
    textarea.select();
  }
}

refs.syncButton.addEventListener("click", () => {
  resetSyncDialog();
  refs.syncDialog.open = true;
});
refs.closeSync.addEventListener("click", () => {
  refs.syncDialog.open = false;
  peerSync.close();
});
refs.syncDialog.addEventListener("wa-hide", () => peerSync.close());
refs.syncCreateOffer.addEventListener("click", async () => {
  try {
    refs.syncStart.hidden = true;
    refs.syncOfferStep.hidden = false;
    refs.syncOfferOutput.value = await peerSync.createOffer();
    refs.syncOfferOutput.focus();
  } catch (error) {
    refs.syncStatus.textContent = error.message;
    refs.syncStatus.classList.add("is-error");
  }
});
refs.syncUseOffer.addEventListener("click", () => {
  refs.syncStart.hidden = true;
  refs.syncAnswerStep.hidden = false;
  refs.syncOfferInput.focus();
});
refs.syncCopyOffer.addEventListener("click", () => copySyncCode(refs.syncOfferOutput, refs.syncCopyOffer));
refs.syncCopyAnswer.addEventListener("click", () => copySyncCode(refs.syncAnswerOutput, refs.syncCopyAnswer));
refs.syncAcceptAnswer.addEventListener("click", async () => {
  try {
    await peerSync.acceptAnswer(refs.syncAnswerInput.value.trim());
  } catch (error) {
    refs.syncStatus.textContent = error.message;
    refs.syncStatus.classList.add("is-error");
  }
});
refs.syncAcceptOffer.addEventListener("click", async () => {
  try {
    refs.syncAnswerOutput.value = await peerSync.acceptOffer(refs.syncOfferInput.value.trim());
    refs.syncAnswerOutputWrap.hidden = false;
    refs.syncAnswerOutput.focus();
  } catch (error) {
    refs.syncStatus.textContent = error.message;
    refs.syncStatus.classList.add("is-error");
  }
});

const { updateAppBadge, tactileFeedback } = initPwa({
  refs,
  getPending: () => totals().pending,
  reducedMotion
});

setView(currentView);
