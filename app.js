import "@awesome.me/webawesome/dist/styles/layers.css";
import "@awesome.me/webawesome/dist/styles/themes/default.css";
import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/checkbox/checkbox.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import "@awesome.me/webawesome/dist/components/progress-bar/progress-bar.js";
import "@awesome.me/webawesome/dist/components/select/select.js";

const storageKey = "trip-list-checked-v2";
const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");

function syncColorScheme() {
  document.documentElement.classList.toggle("wa-dark", colorScheme.matches);
  document.documentElement.classList.toggle("wa-light", !colorScheme.matches);
}

syncColorScheme();
colorScheme.addEventListener("change", syncColorScheme);
const listDefinition = JSON.parse(document.querySelector("#list-definition").textContent);
const checkedIds = loadCheckedIds();
let sections = listDefinition.map((section) => ({
  ...section,
  id: slugify(section.name),
  items: section.items.map((label) => ({
    id: `${slugify(section.name)}-${slugify(label)}`,
    label,
    done: checkedIds.has(`${slugify(section.name)}-${slugify(label)}`)
  }))
}));
let activeSectionId = sections[0]?.id;
let showCompleted = true;

const sectionSelect = document.querySelector("#section-select");
const checklist = document.querySelector("#checklist");
const sectionTitle = document.querySelector("#section-title");
const progressLabel = document.querySelector("#progress-label");
const progressPercent = document.querySelector("#progress-percent");
const progressBar = document.querySelector("#progress-bar");
const completedToggle = document.querySelector("#completed-toggle");
const sectionToggle = document.querySelector("#section-toggle");

function loadCheckedIds() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return new Set(Array.isArray(saved) ? saved : []);
  } catch {
    return new Set();
  }
}

function saveCheckedIds() {
  const checked = sections.flatMap((section) => section.items).filter((item) => item.done).map((item) => item.id);
  localStorage.setItem(storageKey, JSON.stringify(checked));
}

function activeSection() { return sections.find((section) => section.id === activeSectionId) ?? sections[0]; }

function slugify(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function render() {
  const visibleSections = showCompleted ? sections : sections.filter((entry) => entry.items.some((item) => !item.done));
  const section = visibleSections.find((entry) => entry.id === activeSectionId) ?? visibleSections[0];
  activeSectionId = section?.id;
  sectionSelect.innerHTML = visibleSections.map((entry) => `<wa-option value="${entry.id}">${escapeHtml(entry.name)}</wa-option>`).join("");
  sectionSelect.value = activeSectionId ?? "";
  sectionSelect.disabled = visibleSections.length === 0;
  sectionTitle.textContent = section?.name ?? "Todo listo";
  sectionToggle.hidden = !section;
  if (section) {
    const allDone = section.items.length > 0 && section.items.every((item) => item.done);
    sectionToggle.textContent = allDone ? "Desmarcar todo" : "Marcar todo";
    sectionToggle.setAttribute("aria-label", `${allDone ? "Desmarcar" : "Marcar"} todos los elementos de ${section.name}`);
  }
  const visibleItems = section?.items.filter((item) => showCompleted || !item.done) ?? [];
  checklist.innerHTML = visibleItems.length
    ? visibleItems.map((item) => `<li class="check-item ${item.done ? "is-done" : ""}"><wa-checkbox data-item="${item.id}" ${item.done ? "checked" : ""}>${escapeHtml(item.label)}</wa-checkbox></li>`).join("")
    : `<li class="empty">${section ? (section.items.length ? "No hay elementos pendientes en esta sección." : "Esta sección está vacía por ahora.") : "No quedan elementos pendientes."}</li>`;
  completedToggle.textContent = showCompleted ? "Ocultar completados" : "Mostrar completados";
  completedToggle.setAttribute("aria-pressed", String(!showCompleted));
  updateProgress();
}

function updateProgress() {
  const items = sections.flatMap((section) => section.items);
  const done = items.filter((item) => item.done).length;
  const percent = items.length ? Math.round((done / items.length) * 100) : 0;
  progressLabel.textContent = `${done} de ${items.length} listos`;
  progressPercent.textContent = `${percent}%`;
  progressBar.value = percent;
  progressBar.label = `Progreso: ${percent}%`;
}

function escapeHtml(value) { return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }

sectionSelect.addEventListener("change", (event) => {
  activeSectionId = event.target.value;
  render();
});

checklist.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-item]");
  if (!checkbox) return;
  const item = activeSection().items.find((entry) => entry.id === checkbox.dataset.item);
  if (item) item.done = checkbox.checked;
  saveCheckedIds();
  render();
});

completedToggle.addEventListener("click", () => {
  showCompleted = !showCompleted;
  render();
});

sectionToggle.addEventListener("click", () => {
  const section = activeSection();
  if (!section) return;
  const allDone = section.items.length > 0 && section.items.every((item) => item.done);
  section.items.forEach((item) => { item.done = !allDone; });
  saveCheckedIds();
  render();
});

document.querySelector("#reset-button").addEventListener("click", () => {
  if (!window.confirm("¿Desmarcar toda la lista?")) return;
  sections.forEach((section) => section.items.forEach((item) => { item.done = false; }));
  saveCheckedIds();
  render();
});

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
render();
