export function slugify(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

export function checklistItem(item) {
  return `<li class="check-item ${item.done ? "is-done" : ""}"><wa-checkbox data-item="${item.id}" ${item.done ? "checked" : ""}>${escapeHtml(item.label)}</wa-checkbox></li>`;
}

export function undoItem(itemId) {
  return `<li class="undo-item"><wa-animation name="fadeIn" duration="220" easing="cubic-bezier(.16, 1, .3, 1)" fill="both" play><span class="undo-symbol" aria-hidden="true">✓</span></wa-animation><span class="undo-copy"><strong>Producto marcado</strong><small>Se ha ocultado de la lista</small></span><button type="button" data-undo="${itemId}">Deshacer</button></li>`;
}
