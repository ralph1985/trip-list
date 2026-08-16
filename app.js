const initialSections = [
  { name: "Otros", items: ["Lentillas", "Gafas de sol sin graduar", "Gafas secundarias", "Férula", "Cepillos interdentales", "Llaves de Palomares", "Llaves de Cuenca", "Mando garaje Cuenca", "Llaves de Getafe", "Llaves de Meco", "Dinero en efectivo", "Cartera DNI", "Pasaporte", "Bolsa de plástico", "Cinturón", "Botella agua Decathlon", "Saquito de semillas", "Nueva mochila Toledo"] },
  { name: "Casa", items: ["Activar cámara de seguridad", "Activar cámara 2", "Cerrar rejas", "Abrir rejas", "Preparativos lluvia", "Apagar y desenchufar regletas", "Cerrar velux", "Gotera velux", "Nevera para tuppers", "Semillas de lino", "¿Está el microondas vacío?", "¿Luces apagadas?", "Apagar aire acondicionado"] },
  { name: "Bici", items: ["Zapatillas con calas", "Calcetines", "Culot", "Separador de ropa para lavar el culot", "Casco", "Pantalón corto", "Guantes", "Mochila hidratación", "Botella", "Garmin", "Cargador Garmin", "Desengrasante", "Aparato azul desengrasante", "Cera cadena", "Limpiahorquillas", "Trapos", "Detergente"] },
  { name: "Trekking", items: ["Zapatillas Salomón", "Botas Salomón", "Palos", "Mochila", "Navaja", "Impermeable", "Crema rozaduras (culito bebé)", "Compeed (rozaduras)", "Malla fina caminatas", "Mochila hidratación deporte", "Cantimplora", "Vaselina", "Braga para correr"] },
  { name: "Tiempo", items: ["Paraguas", "Impermeable", "Chubasquero", "Gorro", "Guantes", "Botas"] },
  { name: "Drogas", items: ["Coligas", "Paracetamol", "Biodramina", "Omeprazol", "Mascarillas", "Termómetro", "Probióticos"] },
  { name: "Homeopatía", items: [] },
  { name: "Coche", items: ["Cargador y soportes móvil para el coche", "Inflador ruedas coche", "Telepeaje"] },
  { name: "Tecnología", items: ["Enchufes Costa Rica (en mochila mavic)", "Cargador móvil", "Cargador Garmin", "Batería portátil", "Cargador Android", "Airpods", "Cascos dormir", "Reloj Garmin", "Drone", "Mando drone", "Aspas drone", "Baterías drone", "Cargar baterías drone", "Cargar mando drone", "GoPro", "Cargar GoPro", "Liberar espacio GoPro", "Cámara Lumix", "Cargador baterías Lumix", "Macbook (curro)", "Cargador Macbook", "MSI (portátil personal)", "Cargador portátil MSI", "Maquinilla de afeitar", "Libro", "Descargar capítulos de series", "Descargar películas", "Descargar Netflix", "Descargar podcasts"] },
  { name: "Playa", items: ["Bañador", "Tapones oídos", "Toallas playa", "Toalla microfibra (por si no hay en el hostal/hotel)", "Chanclas", "Gafas buceo", "Crema sol", "Escarpines", "Bolso naranja impermeable"] },
  { name: "Picnic", items: ["Mesa y sillas", "Silla Decathlon", "Nevera", "Servilletas", "Cubiertos", "Refrescos", "Manta suelo", "Bolsas de basura", "Crema", "Gorros", "Palillos"] },
  { name: "Spa", items: ["Lentillas", "Bañador", "Gorro de baño"] },
  { name: "Juegos", items: ["Rumi", "Virus", "Sushi go", "Twister"] }
].map((section, sectionIndex) => ({
  ...section,
  id: `section-${sectionIndex}`,
  items: section.items.map((label, itemIndex) => ({ id: `${sectionIndex}-${itemIndex}`, label, done: false }))
}));

const storageKey = "trip-list-state-v1";
let sections = loadSections();
let activeSectionId = sections[0]?.id;

const sectionNav = document.querySelector("#section-nav");
const checklist = document.querySelector("#checklist");
const sectionTitle = document.querySelector("#section-title");
const progressLabel = document.querySelector("#progress-label");
const progressPercent = document.querySelector("#progress-percent");
const progressBar = document.querySelector("#progress-bar");
const addForm = document.querySelector("#add-form");
const newItemInput = document.querySelector("#new-item");

function loadSections() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return Array.isArray(saved) ? saved : structuredClone(initialSections);
  } catch { return structuredClone(initialSections); }
}

function save() { localStorage.setItem(storageKey, JSON.stringify(sections)); }
function activeSection() { return sections.find((section) => section.id === activeSectionId) ?? sections[0]; }

function render() {
  const section = activeSection();
  activeSectionId = section?.id;
  sectionNav.innerHTML = sections.map((item) => `<button class="section-tab" type="button" data-section="${item.id}" aria-current="${item.id === activeSectionId}">${item.name}</button>`).join("");
  sectionTitle.textContent = section?.name ?? "Lista";
  checklist.innerHTML = section?.items.length ? section.items.map((item) => `<li class="check-item"><input type="checkbox" id="item-${item.id}" data-item="${item.id}" ${item.done ? "checked" : ""} /><label for="item-${item.id}">${escapeHtml(item.label)}</label></li>`).join("") : `<li class="empty">Esta sección está vacía por ahora.</li>`;
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
  save();
  render();
});

document.querySelector("#add-button").addEventListener("click", () => {
  addForm.hidden = !addForm.hidden;
  if (!addForm.hidden) newItemInput.focus();
});

addForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const label = newItemInput.value.trim();
  if (!label) return;
  const section = activeSection();
  section.items.push({ id: `${section.id}-${Date.now()}`, label, done: false });
  newItemInput.value = "";
  addForm.hidden = true;
  save();
  render();
});

document.querySelector("#reset-button").addEventListener("click", () => {
  if (!window.confirm("¿Restaurar la lista inicial? Se perderán los cambios guardados en este dispositivo.")) return;
  sections = structuredClone(initialSections);
  save();
  render();
});

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
render();
