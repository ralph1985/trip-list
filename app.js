import "@awesome.me/webawesome/dist/styles/layers.css";
import "@awesome.me/webawesome/dist/styles/themes/default.css";
import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/checkbox/checkbox.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import "@awesome.me/webawesome/dist/components/progress-bar/progress-bar.js";
import "@awesome.me/webawesome/dist/components/animation/animation.js";

const storageKey = "trip-list-checked-v2";
const completedVisibilityKey = "trip-list-show-completed-v1";
const viewStorageKey = "trip-list-current-view-v1";
const sectionStorageKey = "trip-list-current-section-v1";
const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
const listDefinition = JSON.parse(document.querySelector("#list-definition").textContent);
const checkedIds = loadCheckedIds();

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
    done: checkedIds.has(`${slugify(section.name)}-${slugify(label)}`)
  }))
}));

let currentView = loadCurrentView();
let activeSectionId = loadCurrentSection();
let showCompleted = loadShowCompleted();
let searchTerm = "";
const undoTargets = new Map();
const undoTimers = new Map();

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
  overviewStatus: document.querySelector("#overview-status"),
  pendingStatus: document.querySelector("#pending-status"),
  searchInput: document.querySelector("#search-input"),
  clearSearch: document.querySelector("#clear-search")
};

function loadCheckedIds() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return new Set(Array.isArray(saved) ? saved : []);
  } catch {
    return new Set();
  }
}

function loadShowCompleted() {
  try {
    const saved = localStorage.getItem(completedVisibilityKey);
    return saved === null ? true : saved === "true";
  } catch {
    return true;
  }
}

function saveShowCompleted() {
  localStorage.setItem(completedVisibilityKey, String(showCompleted));
}

function loadCurrentView() {
  try {
    const saved = localStorage.getItem(viewStorageKey);
    return ["overview", "pending", "categories", "category"].includes(saved) ? saved : "overview";
  } catch {
    return "overview";
  }
}

function loadCurrentSection() {
  try {
    const saved = localStorage.getItem(sectionStorageKey);
    return sections.some((section) => section.id === saved) ? saved : sections[0]?.id;
  } catch {
    return sections[0]?.id;
  }
}

function saveNavigation() {
  localStorage.setItem(viewStorageKey, currentView);
  if (activeSectionId) localStorage.setItem(sectionStorageKey, activeSectionId);
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

function saveCheckedIds() {
  const checked = sections.flatMap((section) => section.items).filter((item) => item.done).map((item) => item.id);
  localStorage.setItem(storageKey, JSON.stringify(checked));
}

function activeSection() {
  return sections.find((section) => section.id === activeSectionId) ?? sections[0];
}

function slugify(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function totals() {
  const items = sections.flatMap((section) => section.items);
  const done = items.filter((item) => item.done).length;
  return { total: items.length, done, pending: items.length - done };
}

function sectionProgress(section) {
  const done = section.items.filter((item) => item.done).length;
  return { done, total: section.items.length, pending: section.items.length - done };
}

function setView(view) {
  currentView = view;
  saveNavigation();
  document.querySelectorAll(".view-tab").forEach((tab) => {
    const active = tab.dataset.view === view;
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
}

function updateProgress() {
  const { total, done, pending } = totals();
  const percent = total ? Math.round((done / total) * 100) : 0;
  refs.progressLabel.textContent = `${done} de ${total} listos`;
  refs.progressPercent.textContent = `${percent}%`;
  refs.progressBar.value = percent;
  refs.progressBar.label = `Progreso: ${percent}%`;
  refs.pendingCount.textContent = pending;
  refs.progressMessage.textContent = pending === 0 ? "Todo preparado para salir." : `${pending} ${pending === 1 ? "cosa pendiente" : "cosas pendientes"} para revisar.`;
  refs.overviewStatus.textContent = pending === 0 ? "Lista completa" : `${pending} pendientes`;
  refs.pendingStatus.textContent = searchTerm ? "Filtrando resultados" : `${pending} por revisar`;
}

function renderOverview() {
  refs.overviewGrid.innerHTML = sections.map((section, index) => {
    const progress = sectionProgress(section);
    const state = progress.pending === 0 ? "complete" : progress.done > 0 ? "started" : "fresh";
    return `<button class="category-card ${state} ${index % 5 === 0 ? "is-featured" : ""}" type="button" data-open-section="${section.id}">
      <span class="category-index">${String(index + 1).padStart(2, "0")}</span>
      <span class="category-card-copy"><strong>${escapeHtml(section.name)}</strong><small>${progress.pending === 0 ? "Completado" : `${progress.pending} ${progress.pending === 1 ? "pendiente" : "pendientes"}`}</small></span>
      <span class="category-arrow" aria-hidden="true">↗</span>
      <span class="mini-progress" aria-hidden="true"><span style="width: ${section.items.length ? (progress.done / section.items.length) * 100 : 0}%"></span></span>
    </button>`;
  }).join("");
}

function renderCategories() {
  refs.categoriesList.innerHTML = sections.map((section) => {
    const progress = sectionProgress(section);
    return `<button class="category-row" type="button" data-open-section="${section.id}">
      <span class="category-row-name">${escapeHtml(section.name)}</span>
      <span class="category-row-progress"><span>${progress.done}/${progress.total}</span><span class="row-bar"><i style="width: ${progress.total ? (progress.done / progress.total) * 100 : 0}%"></i></span></span>
      <span class="category-arrow" aria-hidden="true">→</span>
    </button>`;
  }).join("");
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

function checklistItem(item) {
  return `<li class="check-item ${item.done ? "is-done" : ""}"><wa-checkbox data-item="${item.id}" ${item.done ? "checked" : ""}>${escapeHtml(item.label)}</wa-checkbox></li>`;
}

function undoItem(itemId) {
  return `<li class="undo-item"><wa-animation name="fadeIn" duration="220" easing="cubic-bezier(.16, 1, .3, 1)" fill="both" play><span class="undo-symbol" aria-hidden="true">✓</span></wa-animation><span class="undo-copy"><strong>Producto marcado</strong><small>Se ha ocultado de la lista</small></span><button type="button" data-undo="${itemId}">Deshacer</button></li>`;
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
  renderOverview();
  renderCategories();
  renderPending();
  if (currentView === "category") renderCategory();
}

document.querySelectorAll(".view-tab").forEach((tab) => tab.addEventListener("click", () => setView(tab.dataset.view)));

document.addEventListener("click", (event) => {
  const undoButton = event.target.closest("[data-undo]");
  if (undoButton && undoTargets.has(undoButton.dataset.undo)) {
    const item = sections.flatMap((section) => section.items).find((entry) => entry.id === undoButton.dataset.undo);
    if (item) {
      item.done = false;
      saveCheckedIds();
    }
    removeUndoTarget(undoButton.dataset.undo);
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
  saveCheckedIds();
  render();
}

refs.completedToggle.addEventListener("click", () => {
  showCompleted = !showCompleted;
  clearUndoTargets();
  saveShowCompleted();
  render();
});

refs.sectionToggle.addEventListener("click", () => {
  const section = activeSection();
  if (!section) return;
  const allDone = section.items.length > 0 && section.items.every((item) => item.done);
  section.items.forEach((item) => { item.done = !allDone; });
  saveCheckedIds();
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
  if (!window.confirm("¿Desmarcar toda la lista?")) return;
  sections.forEach((section) => section.items.forEach((item) => { item.done = false; }));
  saveCheckedIds();
  render();
});

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
setView(currentView);
