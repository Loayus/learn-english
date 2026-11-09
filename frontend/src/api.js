export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Appelé quand le serveur répond 401 (session expirée) — branché par AuthProvider
let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export async function api(path, { method = "GET", body } = {}) {
  const res = await fetch("/api" + path, {
    method,
    headers: { "Content-Type": "application/json", "X-Requested-With": "fetch" },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "/login") onUnauthorized();
  if (!res.ok) throw new ApiError(data.error || `Erreur ${res.status}`, res.status);
  return data;
}

export const MODES = { cards: "Cartes", typing: "Écriture" };
export const DIRECTIONS = ["front_back", "back_front", "mixed"];

// Libellé d'un sens de révision à partir des noms de colonnes de la liste
export function directionLabel(dir, front = "Recto", back = "Verso") {
  if (dir === "front_back") return `${front} → ${back}`;
  if (dir === "back_front") return `${back} → ${front}`;
  return "Mélangé";
}

export function plural(n, word) {
  return `${n} ${word}${n > 1 ? "s" : ""}`;
}

export function parseDate(sqlDate) {
  // SQLite stocke en UTC "YYYY-MM-DD HH:MM:SS"
  return new Date(sqlDate.replace(" ", "T") + "Z");
}

export function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m} min ${String(s).padStart(2, "0")}` : `${s} s`;
}
