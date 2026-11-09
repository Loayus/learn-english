import { api } from "../api.js";

// Cache des requêtes (promesses) pour ne jamais redemander la même traduction
const cache = new Map();

export function translate(text, from, to) {
  const key = `${from}|${to}|${text.trim().toLowerCase()}`;
  if (!cache.has(key)) {
    const p = api(`/translate?${new URLSearchParams({ q: text.trim(), from, to })}`)
      .then((d) => d.suggestions);
    p.catch(() => cache.delete(key)); // en cas d'erreur, on pourra réessayer
    cache.set(key, p);
  }
  return cache.get(key);
}

let languagesPromise = null;
export function getLanguages() {
  languagesPromise ??= api("/languages").then((d) => d.languages);
  languagesPromise.catch(() => { languagesPromise = null; });
  return languagesPromise;
}
