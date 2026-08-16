const storageKey = "trip-list-checked-v2";
const listDefinition = JSON.parse(document.querySelector("#list-definition").textContent);
const checkedIds = loadCheckedIds();
let sections = listDefinition.map((section) => ({
  ...section,
  id: slugify(section.name),
  items: section.items.map((label) => ({
    id: `${slugify(section.name)}-${slugify(label)}`,
    label,
    done: checkedIds.has(`${sectionIndex}-${itemIndex}`)
  }))
}));
let activeSectionId = sections[0]?.id;

const sectionNav = document.querySelector("#section-nav");
const checklist = document.querySelector("#checklist");
const sectionTitle = document.querySelector("#section-title");
const progressLabel = document.querySelector("#progress-label");
const progressPercent = document.querySelector("#progress-percent");
const progressBar = document.querySelector("#progress-bar");

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
  const section = activeSection();
  activeSectionId = section?.id;
  sectionNav.innerHTML = sections.map((item) => `<button class="section-tab" type="button" data-section="${item.id}" aria-current="${item.id === activeSectionId}">${item.name}</button>`).join("");
  sectionTitle.textContent = section?.name ?? "Lista";
  checklist.innerHTML = section?.items.length
    ? section.items.map((item) => `<li class="check-item"><input type="checkbox" id="item-${item.id}" data-item="${item.id}" ${item.done ? "checked" : ""} /><label for="item-${item.id}">${escapeHtml(item.label)}</label></li>`).join("")
    : `<li class="empty">Esta sección está vacía por ahora.</li>`;
  updateProgress();
}

function updateProgress() {
  const items = sections.flatMap((section) => section.items);
  const done = items.filter((item) => item.done).length;
  const percent = items.length ? Math.round((done / items.length) * 100) : 0;
  progressLabel.textContent = `${done} de ${items.length} listos`;
  progressPercent.textContent = `${percent}%`;
  progressBar.style.width = `${percent}%`;
}

function escapeHtml(value) { return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }

sectionNav.addEventListener("click", (event) => {
  const button = event.target.closest("[data-section]");
  if (!button) return;
  activeSectionId = button.dataset.section;
  render();
});

checklist.addEventListener("change", (event) => {
  const input = event.target.closest("[data-item]");
  if (!input) return;
  const item = activeSection().items.find((entry) => entry.id === input.dataset.item);
  if (item) item.done = input.checked;
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
