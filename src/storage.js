export const storageKeys = {
  checked: "trip-list-checked-v2",
  completedVisibility: "trip-list-show-completed-v1",
  currentView: "trip-list-current-view-v1",
  currentSection: "trip-list-current-section-v1",
  badgePrompt: "trip-list-badge-prompt-v1"
};

function saveValue(key, value) {
  try {
    localStorage.setItem(key, value);
    window.dispatchEvent(new CustomEvent("trip-list-storage-available"));
  } catch {
    window.dispatchEvent(new CustomEvent("trip-list-storage-unavailable"));
  }
}

export function loadCheckedIds() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKeys.checked));
    return new Set(Array.isArray(saved) ? saved : []);
  } catch {
    return new Set();
  }
}

export function saveCheckedIds(sections) {
  const checked = sections.flatMap((section) => section.items).filter((item) => item.done).map((item) => item.id);
  saveValue(storageKeys.checked, JSON.stringify(checked));
}

export function loadShowCompleted() {
  try {
    const saved = localStorage.getItem(storageKeys.completedVisibility);
    return saved === null ? true : saved === "true";
  } catch {
    return true;
  }
}

export function saveShowCompleted(value) {
  saveValue(storageKeys.completedVisibility, String(value));
}

export function loadCurrentView() {
  try {
    const saved = localStorage.getItem(storageKeys.currentView);
    return ["overview", "pending", "categories", "category"].includes(saved) ? saved : "overview";
  } catch {
    return "overview";
  }
}

export function loadCurrentSection(sections) {
  try {
    const saved = localStorage.getItem(storageKeys.currentSection);
    return sections.some((section) => section.id === saved) ? saved : sections[0]?.id;
  } catch {
    return sections[0]?.id;
  }
}

export function saveNavigation(view, sectionId) {
  saveValue(storageKeys.currentView, view);
  if (sectionId) saveValue(storageKeys.currentSection, sectionId);
}
