"use strict";

// ---------- Utilitaires ----------

const $app = document.getElementById("app");
let currentUser = null;

// Construit un élément DOM. Le texte passe par textContent : pas d'injection HTML.
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k === "style") el.style.cssText = v;
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

function render(...nodes) {
  $app.replaceChildren(...nodes);
  window.scrollTo(0, 0);
}

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch("/api" + path, {
    method,
    headers: { "Content-Type": "application/json", "X-Requested-With": "fetch" },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "/login") {
    currentUser = null;
    location.hash = "#/login";
  }
  if (!res.ok) throw new Error(data.error || "Erreur " + res.status);
  return data;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatDate(sqlDate) {
  // SQLite stocke en UTC "YYYY-MM-DD HH:MM:SS"
  const d = new Date(sqlDate.replace(" ", "T") + "Z");
  return d.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return m ? `${m} min ${String(s).padStart(2, "0")} s` : `${s} s`;
}

const MODES = { cards: "Cartes", typing: "Écriture" };
const DIRECTIONS = { fr_en: "FR → EN", en_fr: "EN → FR", mixed: "Mélangé" };

function errorBox() {
  const el = h("div", { class: "error", hidden: true });
  el.show = (msg) => { el.textContent = msg; el.hidden = false; };
  return el;
}

// ---------- Correction (mode écriture) ----------

function normalize(s) {
  return s.trim().replace(/\s+/g, " ").replace(/[’‘`´]/g, "'").toLowerCase();
}

// Plusieurs réponses acceptées si séparées par "/" ou ";" (ex. "car / automobile").
function alternatives(expected) {
  return expected.split(/\s*[\/;]\s*/).map((s) => s.trim()).filter(Boolean);
}

// Alignement de Levenshtein entre la saisie et la réponse attendue.
// Renvoie la distance et une liste d'opérations pour colorer chaque lettre :
//  c = correcte, w = mauvaise lettre, x = lettre en trop, m = lettre manquante.
function diff(typed, expected) {
  const a = [...typed], b = [...expected];
  const n = a.length, m = b.length;
  const d = Array.from({ length: n + 1 }, (_, i) => [i, ...Array(m).fill(0)]);
  for (let j = 1; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
  const ops = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      ops.push({ t: a[i - 1] === b[j - 1] ? "c" : "w", ch: a[i - 1] });
      i--; j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      ops.push({ t: "x", ch: a[i - 1] }); i--;
    } else {
      ops.push({ t: "m", ch: b[j - 1] }); j--;
    }
  }
  return { distance: d[n][m], ops: ops.reverse() };
}

function checkAnswer(typed, expected) {
  const t = normalize(typed);
  let best = null;
  for (const alt of alternatives(expected)) {
    const r = diff(t, normalize(alt));
    if (!best || r.distance < best.distance) best = { ...r, target: alt };
  }
  return { correct: best.distance === 0, ...best };
}

function renderDiff(ops) {
  return h("div", { class: "diff" },
    ops.map((o) => h("span", { class: o.t === "c" ? "c" : o.t === "m" ? "m" : "w" },
      o.t === "m" ? o.ch : (o.ch === " " ? " " : o.ch))));
}

// ---------- Routeur ----------

const routes = [
  [/^#\/login$/, viewLogin, false],
  [/^#\/register$/, viewRegister, false],
  [/^#\/lists$/, () => viewLists(false), true],
  [/^#\/my-lists$/, () => viewLists(true), true],
  [/^#\/lists\/new$/, () => viewEditor(null), true],
  [/^#\/lists\/(\d+)$/, (id) => viewList(+id), true],
  [/^#\/lists\/(\d+)\/edit$/, (id) => viewEditor(+id), true],
  [/^#\/train\/(\d+)\/(cards|typing)\/(fr_en|en_fr|mixed)$/, (id, mode, dir) => viewTrain(+id, mode, dir), true],
  [/^#\/profile$/, viewProfile, true],
];

async function router() {
  const hash = location.hash || "#/lists";
  for (const [re, view, needsAuth] of routes) {
    const m = hash.match(re);
    if (!m) continue;
    if (needsAuth && !currentUser) return (location.hash = "#/login");
    if (!needsAuth && currentUser) return (location.hash = "#/lists");
    updateNav(hash);
    try {
      await view(...m.slice(1));
    } catch (e) {
      render(h("div", { class: "panel error" }, e.message));
    }
    return;
  }
  location.hash = currentUser ? "#/lists" : "#/login";
}

function updateNav(hash) {
  document.getElementById("topbar").hidden = !currentUser;
  if (!currentUser) return;
  document.getElementById("nav-user").textContent = "👤 " + currentUser.username;
  const key = hash.startsWith("#/my-lists") ? "my-lists"
    : hash === "#/lists/new" ? "new"
    : hash.startsWith("#/profile") ? "profile" : "lists";
  document.querySelectorAll("[data-nav]").forEach((a) =>
    a.classList.toggle("active", a.dataset.nav === key));
}

document.getElementById("logout").addEventListener("click", async () => {
  await api("/logout", { method: "POST", body: {} });
  currentUser = null;
  location.hash = "#/login";
});

window.addEventListener("hashchange", router);

// ---------- Auth ----------

function authForm({ title, submitLabel, endpoint, footer }) {
  const err = errorBox();
  const username = h("input", { name: "username", autocomplete: "username", required: true });
  const password = h("input", {
    name: "password", type: "password", required: true,
    autocomplete: endpoint === "/register" ? "new-password" : "current-password",
  });
  const form = h("form", {
    class: "panel auth",
    onsubmit: async (e) => {
      e.preventDefault();
      try {
        const { user } = await api(endpoint, {
          method: "POST", body: { username: username.value, password: password.value },
        });
        currentUser = user;
        location.hash = "#/lists";
      } catch (ex) { err.show(ex.message); }
    },
  },
    h("h1", {}, title),
    h("label", {}, "Nom d'utilisateur"), username,
    h("label", {}, "Mot de passe"), password,
    err,
    h("button", { class: "btn", type: "submit" }, submitLabel),
    h("p", { class: "muted", style: "text-align:center" }, footer),
  );
  render(form);
  username.focus();
}

function viewLogin() {
  authForm({
    title: "Connexion", submitLabel: "Se connecter", endpoint: "/login",
    footer: ["Pas encore de compte ? ", h("a", { href: "#/register" }, "Créer un compte")],
  });
}

function viewRegister() {
  authForm({
    title: "Créer un compte", submitLabel: "Créer mon compte", endpoint: "/register",
    footer: ["Déjà inscrit ? ", h("a", { href: "#/login" }, "Se connecter")],
  });
}

// ---------- Listes ----------

async function viewLists(mine) {
  const search = h("input", { placeholder: "Rechercher une liste, un auteur…", type: "search" });
  const grid = h("div", { class: "grid" });
  let timer;

  async function load() {
    const params = new URLSearchParams({ q: search.value });
    if (mine) params.set("mine", "1");
    const { lists } = await api("/lists?" + params);
    if (!lists.length) {
      grid.replaceChildren(h("div", { class: "empty", style: "grid-column:1/-1" },
        mine ? ["Tu n'as encore créé aucune liste. ", h("a", { href: "#/lists/new" }, "Créer ma première liste")]
             : "Aucune liste trouvée."));
      return;
    }
    grid.replaceChildren(...lists.map((l) =>
      h("a", { class: "panel list-card", href: `#/lists/${l.id}` },
        h("h3", {}, l.title),
        h("p", {}, l.description || "—"),
        h("div", { class: "row spread" },
          h("span", { class: "tag" }, `${l.word_count} mot${l.word_count > 1 ? "s" : ""}`),
          h("span", { class: "muted", style: "font-size:.85rem" },
            l.owner_id === currentUser.id ? "par toi" : "par " + l.owner)))));
  }

  search.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(load, 250); });
  render(
    h("div", { class: "row spread" },
      h("h1", {}, mine ? "Mes listes" : "Explorer les listes"),
      h("a", { class: "btn", href: "#/lists/new" }, "+ Nouvelle liste")),
    h("p", { class: "muted" }, mine
      ? "Les listes que tu as créées."
      : "Toutes les listes de vocabulaire créées par la communauté."),
    h("div", { style: "margin:1rem 0" }, search),
    grid,
  );
  await load();
}

async function viewList(id) {
  const { list } = await api(`/lists/${id}`);
  const isOwner = list.owner_id === currentUser.id;
  const direction = h("select", {},
    Object.entries(DIRECTIONS).map(([v, label]) =>
      h("option", { value: v }, label === "Mélangé" ? "Mélangé (FR ↔ EN)" : label)));

  const start = (mode) => { location.hash = `#/train/${id}/${mode}/${direction.value}`; };

  render(
    h("a", { href: "#/lists", class: "muted" }, "← Retour"),
    h("div", { class: "row spread", style: "margin-top:.5rem" },
      h("h1", {}, list.title),
      isOwner && h("div", { class: "row" },
        h("a", { class: "btn btn-ghost btn-small", href: `#/lists/${id}/edit` }, "Modifier"),
        h("button", {
          class: "btn-ko btn-small",
          onclick: async (e) => {
            const btn = e.currentTarget;
            if (btn.dataset.confirm !== "1") {
              btn.dataset.confirm = "1";
              btn.textContent = "Confirmer la suppression ?";
              return;
            }
            await api(`/lists/${id}`, { method: "DELETE" });
            location.hash = "#/my-lists";
          },
        }, "Supprimer"))),
    list.description && h("p", {}, list.description),
    h("p", { class: "muted" }, `par ${isOwner ? "toi" : list.owner} · ${list.words.length} mots`),

    h("div", { class: "panel" },
      h("h2", { style: "margin-top:0" }, "S'entraîner"),
      h("label", {}, "Sens de traduction"), direction,
      h("div", { class: "train-options", style: "margin-top:1rem" },
        h("button", { class: "mode-btn", onclick: () => start("cards") },
          "🃏 Cartes", h("small", {}, "Retourne la carte et dis si tu connaissais le mot.")),
        h("button", { class: "mode-btn", onclick: () => start("typing") },
          "⌨️ Écriture", h("small", {}, "Écris la traduction, elle est corrigée lettre par lettre.")))),

    h("h2", {}, "Vocabulaire"),
    h("div", { class: "panel table-wrap", style: "padding:0" },
      h("table", {},
        h("thead", {}, h("tr", {}, h("th", {}, "Français"), h("th", {}, "Anglais"))),
        h("tbody", {}, list.words.map((w) =>
          h("tr", {}, h("td", {}, w.french), h("td", {}, w.english)))))),
  );
}

async function viewEditor(id) {
  const existing = id ? (await api(`/lists/${id}`)).list : null;
  if (existing && existing.owner_id !== currentUser.id) {
    location.hash = `#/lists/${id}`;
    return;
  }
  const err = errorBox();
  const title = h("input", { maxlength: 100, value: existing?.title || "", required: true,
    placeholder: "Ex. Les animaux" });
  const description = h("textarea", { rows: 2, maxlength: 500, placeholder: "Optionnel" },
    existing?.description || "");
  const rows = h("div");

  function addRow(fr = "", en = "", focus = false) {
    const frIn = h("input", { placeholder: "Français", value: fr, "data-fr": true });
    const enIn = h("input", { placeholder: "Anglais", value: en, "data-en": true });
    // Entrée sur le champ anglais de la dernière ligne → nouvelle ligne
    enIn.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (row === rows.lastElementChild) addRow("", "", true);
        else row.nextElementSibling.querySelector("input").focus();
      }
    });
    const row = h("div", { class: "word-row" }, frIn, enIn,
      h("button", { type: "button", class: "btn-ghost", title: "Retirer",
        onclick: () => { row.remove(); if (!rows.children.length) addRow(); } }, "✕"));
    rows.append(row);
    if (focus) frIn.focus();
  }

  (existing?.words.length ? existing.words : [{}, {}, {}]).forEach((w) => addRow(w.french, w.english));

  const bulk = h("textarea", { rows: 4,
    placeholder: "chat ; cat\nchien ; dog\nmaison = house" });

  const form = h("form", {
    class: "panel",
    onsubmit: async (e) => {
      e.preventDefault();
      const words = [...rows.children].map((r) => ({
        french: r.querySelector("[data-fr]").value,
        english: r.querySelector("[data-en]").value,
      })).filter((w) => w.french.trim() && w.english.trim());
      const payload = { title: title.value, description: description.value, words };
      try {
        const res = existing
          ? await api(`/lists/${id}`, { method: "PUT", body: payload })
          : await api("/lists", { method: "POST", body: payload });
        location.hash = `#/lists/${res.id}`;
      } catch (ex) { err.show(ex.message); }
    },
  },
    h("label", {}, "Titre"), title,
    h("label", {}, "Description"), description,
    h("label", {}, "Mots"),
    h("p", { class: "muted", style: "margin:0 0 .5rem;font-size:.9rem" },
      "Pour accepter plusieurs traductions, sépare-les par « / » (ex. car / automobile)."),
    rows,
    h("button", { type: "button", class: "btn-ghost btn-small", onclick: () => addRow("", "", true) },
      "+ Ajouter un mot"),
    h("details", { style: "margin-top:1rem" },
      h("summary", { class: "muted", style: "cursor:pointer" }, "Importer en masse (un mot par ligne)"),
      h("div", { style: "margin-top:.5rem" },
        bulk,
        h("button", { type: "button", class: "btn-ghost btn-small", style: "margin-top:.5rem",
          onclick: () => {
            // Retire les lignes vides puis ajoute les lignes importées
            [...rows.children].forEach((r) => {
              if (![...r.querySelectorAll("input")].some((i) => i.value.trim())) r.remove();
            });
            for (const line of bulk.value.split("\n")) {
              const [fr, en] = line.split(/\s*[;=\t]\s*/);
              if (fr?.trim() && en?.trim()) addRow(fr.trim(), en.trim());
            }
            if (!rows.children.length) addRow();
            bulk.value = "";
          } }, "Importer"))),
    err,
    h("div", { class: "row", style: "margin-top:1.5rem" },
      h("button", { type: "submit", class: "btn" }, existing ? "Enregistrer" : "Créer la liste"),
      h("a", { class: "btn btn-ghost", href: existing ? `#/lists/${id}` : "#/my-lists" }, "Annuler")),
  );

  render(h("h1", {}, existing ? "Modifier la liste" : "Nouvelle liste"), form);
  title.focus();
}

// ---------- Entraînement ----------

async function viewTrain(listId, mode, direction) {
  const { list } = await api(`/lists/${listId}`);
  const startedAt = Date.now();
  const total = list.words.length;
  const attemptsByWord = new Map();
  let attempts = 0;

  // Chaque carte a une question et une réponse selon le sens choisi
  let queue = shuffle(list.words).map((w) => {
    const frToEn = direction === "fr_en" || (direction === "mixed" && Math.random() < .5);
    return frToEn
      ? { id: w.id, q: w.french, a: w.english, qLang: "Français", aLang: "Anglais" }
      : { id: w.id, q: w.english, a: w.french, qLang: "Anglais", aLang: "Français" };
  });
  let learned = 0;

  const bar = h("div");
  const counter = h("span", { class: "muted" });
  const stage = h("div");
  const updateProgress = () => {
    bar.style.width = `${(learned / total) * 100}%`;
    counter.textContent = `${learned} / ${total}`;
  };

  // Réponse donnée pour la carte en tête de file
  function answer(known) {
    const card = queue.shift();
    attempts++;
    attemptsByWord.set(card.id, (attemptsByWord.get(card.id) || 0) + 1);
    if (known) learned++;
    else queue.push(card); // la carte reviendra plus tard
    updateProgress();
    next();
  }

  function next() {
    if (!queue.length) return finish();
    (mode === "cards" ? showCard : showTyping)(queue[0]);
  }

  function showCard(card) {
    const knowBtn = h("button", { class: "btn-ok", disabled: true, onclick: () => answer(true) }, "✓ Je le connais");
    const dontBtn = h("button", { class: "btn-ko", disabled: true, onclick: () => answer(false) }, "✗ Je ne le connais pas");
    const flip = () => {
      fc.classList.add("flipped");
      knowBtn.disabled = dontBtn.disabled = false;
      hint.hidden = true;
    };
    const fc = h("div", { class: "flashcard",
      onclick: () => fc.classList.contains("flipped") ? fc.classList.remove("flipped") : flip() },
      h("div", { class: "flashcard-inner" },
        h("div", { class: "face" },
          h("div", { class: "lang" }, card.qLang), h("div", { class: "word" }, card.q)),
        h("div", { class: "face back" },
          h("div", { class: "lang" }, card.aLang), h("div", { class: "word" }, card.a))));
    const hint = h("p", { class: "muted", style: "text-align:center" },
      "Clique sur la carte (ou Espace) pour la retourner");
    stage.replaceChildren(fc, hint, h("div", { class: "actions" }, dontBtn, knowBtn));
    keyHandler = (e) => {
      if (e.key === " ") { e.preventDefault(); fc.classList.contains("flipped") ? fc.classList.remove("flipped") : flip(); }
      else if (!knowBtn.disabled && (e.key === "ArrowRight" || e.key === "1")) answer(true);
      else if (!knowBtn.disabled && (e.key === "ArrowLeft" || e.key === "2")) answer(false);
    };
  }

  function showTyping(card) {
    const input = h("input", { class: "answer-input", autocomplete: "off", autocapitalize: "off",
      spellcheck: "false", placeholder: `Traduction en ${card.aLang.toLowerCase()}…` });
    const feedback = h("div");
    const submit = h("button", { type: "submit", class: "btn" }, "Vérifier");
    const skip = h("button", { type: "button", class: "btn-ghost", onclick: () => reveal(null) }, "Je ne sais pas");
    const form = h("form", { onsubmit: (e) => { e.preventDefault(); if (input.value.trim()) reveal(input.value); } },
      input, h("div", { class: "actions", style: "margin-top:1rem" }, skip, submit));

    function reveal(typed) {
      input.disabled = true;
      submit.hidden = skip.hidden = true;
      const result = typed == null ? null : checkAnswer(typed, card.a);
      if (result?.correct) {
        const nextBtn = h("button", { class: "btn-ok", onclick: () => answer(true) }, "Suivant →");
        feedback.replaceChildren(h("div", { class: "feedback ok" },
          h("strong", {}, "✓ Correct !"),
          alternatives(card.a).length > 1 && h("div", {}, `Réponses acceptées : ${card.a}`),
          h("div", { class: "actions", style: "margin-top:.75rem" }, nextBtn)));
        nextBtn.focus();
        return;
      }
      const okBtn = h("button", { class: "btn-ghost", onclick: () => answer(true) }, "Oui, valider quand même");
      const koBtn = h("button", { class: "btn-ko", onclick: () => answer(false) }, "Non, c'était faux");
      feedback.replaceChildren(h("div", { class: "feedback ko" },
        result
          ? [h("div", { class: "muted" }, "Ta réponse :"), renderDiff(result.ops)]
          : h("div", { class: "muted" }, "Pas de souci, voici la réponse :"),
        h("div", { class: "expected" }, "Réponse attendue : ", h("strong", {}, card.a)),
        result && h("p", { class: "muted", style: "margin:.75rem 0 .5rem" },
          "Faute de frappe ? Tu peux quand même valider ta réponse."),
        h("div", { class: "actions", style: "margin-top:.75rem" },
          result ? [koBtn, okBtn] : h("button", { class: "btn", onclick: () => answer(false) }, "Continuer"))));
      (result ? koBtn : feedback.querySelector("button")).focus();
    }

    stage.replaceChildren(
      h("div", { class: "panel prompt" },
        h("div", { class: "muted", style: "font-size:.8rem;text-transform:uppercase;letter-spacing:.08em" }, card.qLang),
        h("div", { class: "word" }, card.q)),
      form, feedback);
    keyHandler = null;
    input.focus();
  }

  async function finish() {
    keyHandler = null;
    const firstTry = [...attemptsByWord.values()].filter((n) => n === 1).length;
    const duration = Math.round((Date.now() - startedAt) / 1000);
    let saveMsg = "Session enregistrée dans ton historique.";
    try {
      await api("/trainings", { method: "POST", body: {
        list_id: listId, mode, direction, word_count: total,
        first_try: firstTry, attempts, duration_sec: duration,
      } });
    } catch (e) { saveMsg = "Impossible d'enregistrer la session : " + e.message; }
    stage.replaceChildren(h("div", { class: "panel summary" },
      h("div", { style: "font-size:2.5rem" }, "🎉"),
      h("h2", {}, "Liste terminée !"),
      h("div", { class: "big" }, `${firstTry} / ${total}`),
      h("p", { class: "muted" }, "mots trouvés du premier coup"),
      h("p", {}, `${attempts} réponses · ${formatDuration(duration)}`),
      h("p", { class: "muted", style: "font-size:.9rem" }, saveMsg),
      h("div", { class: "actions" },
        h("a", { class: "btn btn-ghost", href: `#/lists/${listId}` }, "Retour à la liste"),
        h("button", { onclick: () => viewTrain(listId, mode, direction) }, "Recommencer"))));
  }

  render(h("div", { class: "trainer" },
    h("a", { href: `#/lists/${listId}`, class: "muted" }, "← Quitter"),
    h("div", { class: "row spread", style: "margin-top:.5rem" },
      h("strong", {}, `${list.title} · ${MODES[mode]} · ${DIRECTIONS[direction]}`), counter),
    h("div", { class: "progress" }, bar),
    stage));
  updateProgress();
  next();
}

// Raccourcis clavier du mode cartes (un seul handler global, remplacé par vue)
let keyHandler = null;
document.addEventListener("keydown", (e) => {
  if (keyHandler && !["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) keyHandler(e);
});
window.addEventListener("hashchange", () => { keyHandler = null; });

// ---------- Profil ----------

async function viewProfile() {
  const [{ user }, { history, stats }] = await Promise.all([api("/me"), api("/me/history")]);
  const stat = (value, label) => h("div", { class: "panel stat" },
    h("div", { class: "value" }, value), h("div", { class: "label" }, label));

  const historyPane = history.length
    ? h("div", { class: "panel table-wrap", style: "padding:0" },
        h("table", {},
          h("thead", {}, h("tr", {},
            ["Date", "Liste", "Mode", "Sens", "Du 1er coup", "Durée"].map((t) => h("th", {}, t)))),
          h("tbody", {}, history.map((t) => h("tr", {},
            h("td", {}, formatDate(t.created_at)),
            h("td", {}, t.list_id ? h("a", { href: `#/lists/${t.list_id}` }, t.list_title)
                                 : h("span", { class: "muted" }, t.list_title + " (supprimée)")),
            h("td", {}, MODES[t.mode]),
            h("td", {}, DIRECTIONS[t.direction]),
            h("td", { class: t.first_try === t.word_count ? "score-ok" : "" },
              `${t.first_try} / ${t.word_count}`),
            h("td", {}, formatDuration(t.duration_sec)))))))
    : h("div", { class: "panel empty" }, "Aucun entraînement pour l'instant. ",
        h("a", { href: "#/lists" }, "Choisis une liste pour commencer !"));

  render(
    h("h1", {}, "👤 " + user.username),
    h("p", { class: "muted" }, "Membre depuis le " +
      new Date(user.created_at.replace(" ", "T") + "Z").toLocaleDateString("fr-FR", { dateStyle: "long" })),
    h("div", { class: "stats" },
      stat(stats.sessions, "entraînements"),
      stat(stats.words, "mots révisés"),
      stat(formatDuration(stats.seconds), "temps total"),
      stat(stats.lists_created, "listes créées")),
    h("div", { class: "tabs" },
      h("button", { class: "active" }, "Historique d'entraînement"),
      h("button", { disabled: true, title: "Bientôt disponible" }, "Évaluation 🔒")),
    historyPane,
  );
}

// ---------- Démarrage ----------

(async () => {
  try { currentUser = (await api("/me")).user; } catch { currentUser = null; }
  router();
})();
