import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { getLanguages, translate } from "../lib/translate.js";

let nextKey = 1;
const row = (front = "", back = "") => ({ key: nextKey++, front, back, initial: front });

// Modèles de colonnes libres (le modèle « Langues » est à part)
const PRESETS = [
  ["Question", "Réponse"],
  ["Mot", "Définition"],
  ["Date", "Événement"],
  ["Pays", "Capitale"],
];

export default function Editor() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isLang, setIsLang] = useState(false);
  const [frontLang, setFrontLang] = useState("");
  const [backLang, setBackLang] = useState("");
  const [languages, setLanguages] = useState([]);
  const [frontLabel, setFrontLabel] = useState("Question");
  const [backLabel, setBackLabel] = useState("Réponse");
  const [items, setItems] = useState(() => (id ? [] : [row(), row(), row()]));
  const [bulk, setBulk] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!!id);
  const focusKey = useRef(null);
  const listRef = useRef(null);

  useEffect(() => { getLanguages().then(setLanguages).catch(() => {}); }, []);

  useEffect(() => {
    if (!id) return;
    api(`/lists/${id}`).then(({ list }) => {
      if (list.owner_id !== user.id) return navigate(`/listes/${id}`, { replace: true });
      setTitle(list.title);
      setDescription(list.description);
      setFrontLabel(list.front_label);
      setBackLabel(list.back_label);
      setIsLang(!!list.front_lang);
      setFrontLang(list.front_lang || "");
      setBackLang(list.back_lang || "");
      setItems(list.items.map((it) => row(it.front, it.back)));
      setLoading(false);
    }).catch((e) => setError(e.message));
  }, [id, user.id, navigate]);

  // Donne le focus à une ligne qu'on vient d'ajouter
  useEffect(() => {
    if (focusKey.current == null) return;
    listRef.current?.querySelector(`[data-key="${focusKey.current}"] input`)?.focus();
    focusKey.current = null;
  }, [items]);

  const langName = (code) => languages.find((l) => l.code === code)?.name;
  // En mode langues, les colonnes portent le nom des langues choisies
  const shownFront = isLang ? langName(frontLang) || "Langue 1" : frontLabel;
  const shownBack = isLang ? langName(backLang) || "Langue 2" : backLabel;
  const langs = isLang && frontLang && backLang && frontLang !== backLang ? { from: frontLang, to: backLang } : null;

  const update = (key, field, value) =>
    setItems((xs) => xs.map((x) => (x.key === key ? { ...x, [field]: value } : x)));

  const addRow = () => {
    const r = row();
    focusKey.current = r.key;
    setItems((xs) => [...xs, r]);
  };

  const removeRow = (key) => setItems((xs) => (xs.length > 1 ? xs.filter((x) => x.key !== key) : [row()]));

  function importBulk() {
    const imported = bulk.split("\n")
      .map((line) => line.split(/\s*[;=\t]\s*/))
      .filter(([f, b]) => f?.trim() && b?.trim())
      .map(([f, b]) => row(f.trim(), b.trim()));
    if (!imported.length) return;
    setItems((xs) => [...xs.filter((x) => x.front.trim() || x.back.trim()), ...imported]);
    setBulk("");
  }

  function chooseLanguages() {
    setIsLang(true);
    if (!frontLang) setFrontLang("fr");
  }

  function choosePreset(f, b) {
    setIsLang(false);
    setFrontLabel(f);
    setBackLabel(b);
  }

  async function save(e) {
    e.preventDefault();
    setError("");
    if (isLang && !langs) return setError("Choisis deux langues différentes.");
    const payload = {
      title,
      description,
      front_label: shownFront,
      back_label: shownBack,
      front_lang: isLang ? frontLang : null,
      back_lang: isLang ? backLang : null,
      items: items
        .filter((x) => x.front.trim() && x.back.trim())
        .map(({ front, back }) => ({ front, back })),
    };
    try {
      const res = id
        ? await api(`/lists/${id}`, { method: "PUT", body: payload })
        : await api("/lists", { method: "POST", body: payload });
      navigate(`/listes/${res.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return error ? <p className="ink-error center">{error}</p> : <div className="loading">…</div>;

  return (
    <form className="manuscript" onSubmit={save}>
      <Link to={id ? `/listes/${id}` : "/"} className="back-link">← Annuler</Link>
      <div className="manuscript-paper">
        <p className="eyebrow">{id ? "Modifier la liste" : "Nouvelle liste"}</p>
        <input
          className="manuscript-title"
          placeholder="Titre de la liste"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          required
          autoFocus={!id}
        />
        <textarea
          className="manuscript-desc"
          placeholder="Description (facultatif)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={2}
        />

        <div className="columns-setup">
          <p className="setup-title">Type de liste</p>
          <div className="presets">
            <button type="button" className={`chip chip-lang ${isLang ? "on" : ""}`} onClick={chooseLanguages}>
              🌍 Langues
            </button>
            {PRESETS.map(([f, b]) => (
              <button
                type="button"
                key={f}
                className={`chip ${!isLang && frontLabel === f && backLabel === b ? "on" : ""}`}
                onClick={() => choosePreset(f, b)}
              >
                {f} / {b}
              </button>
            ))}
          </div>

          {isLang && (
            <div className="lang-picker">
              <p className="setup-title">Quelles langues ?</p>
              <div className="lang-row">
                <LangSelect label="Je connais" value={frontLang} onChange={setFrontLang} languages={languages} />
                <button
                  type="button"
                  className="swap"
                  title="Inverser les langues"
                  aria-label="Inverser les langues"
                  onClick={() => { setFrontLang(backLang); setBackLang(frontLang); }}
                >
                  ⇄
                </button>
                <LangSelect label="J'apprends" value={backLang} onChange={setBackLang} languages={languages} />
              </div>
              <p className="hint">
                {langs
                  ? "Écris un mot dans la première colonne : des traductions te seront proposées."
                  : frontLang && frontLang === backLang
                    ? "Choisis deux langues différentes."
                    : "Choisis la langue que tu apprends."}
              </p>
            </div>
          )}
        </div>

        <div className="word-head">
          {isLang ? (
            <>
              <span>{shownFront}</span>
              <span>{shownBack}</span>
            </>
          ) : (
            <>
              <input value={frontLabel} onChange={(e) => setFrontLabel(e.target.value)} maxLength={30}
                aria-label="Nom de la première colonne" required />
              <input value={backLabel} onChange={(e) => setBackLabel(e.target.value)} maxLength={30}
                aria-label="Nom de la seconde colonne" required />
            </>
          )}
        </div>
        <ol className="word-rows" ref={listRef}>
          {items.map((x, i) => (
            <ItemRow
              key={x.key}
              item={x}
              index={i}
              langs={langs}
              frontLabel={shownFront}
              backLabel={shownBack}
              onChange={update}
              onRemove={removeRow}
              onEnter={() => {
                if (i === items.length - 1) addRow();
                else listRef.current.querySelector(`[data-key="${items[i + 1].key}"] input`).focus();
              }}
            />
          ))}
        </ol>
        <button type="button" className="add-line" onClick={addRow}>+ Ajouter une ligne</button>
        <p className="hint">Plusieurs réponses acceptées ? Sépare-les par « / » — ex. <em>car / automobile</em>.</p>

        <details className="bulk">
          <summary>Importer plusieurs lignes d'un coup</summary>
          <textarea
            rows={4}
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={"Une ligne par élément, séparée par ; ou =\nFrance ; Paris\n1789 = Révolution française"}
          />
          <button type="button" className="pill pill-ink" onClick={importBulk}>Importer</button>
        </details>

        {error && <p className="ink-error">{error}</p>}
        <div className="manuscript-foot">
          <button className="seal">{id ? "Enregistrer" : "Créer la liste"}</button>
        </div>
      </div>
    </form>
  );
}

function LangSelect({ label, value, onChange, languages }) {
  return (
    <label className="lang-select">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="" disabled>Choisir…</option>
        {languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
      </select>
    </label>
  );
}

// Une ligne de la liste. En mode langues, propose des traductions du mot de la 1re colonne.
function ItemRow({ item, index, langs, frontLabel, backLabel, onChange, onRemove, onEnter }) {
  const [suggest, setSuggest] = useState({ list: [], status: "idle" });
  const text = item.front.trim();
  // On ne traduit que ce que l'utilisateur vient de taper (pas les lignes déjà enregistrées)
  const touched = item.front !== item.initial;

  useEffect(() => {
    if (!langs || !text || !touched) {
      setSuggest({ list: [], status: "idle" });
      return;
    }
    let cancelled = false;
    setSuggest((s) => ({ ...s, status: "loading" }));
    const t = setTimeout(() => {
      translate(text, langs.from, langs.to)
        .then((list) => !cancelled && setSuggest({ list, status: "done" }))
        .catch(() => !cancelled && setSuggest({ list: [], status: "error" }));
    }, 450);
    return () => { cancelled = true; clearTimeout(t); };
  }, [text, touched, langs?.from, langs?.to]); // eslint-disable-line react-hooks/exhaustive-deps

  const showSuggestions = langs && text && touched && suggest.status !== "idle";

  return (
    <li data-key={item.key} className={showSuggestions ? "has-suggest" : ""}>
      <span className="num">{index + 1}</span>
      <input
        value={item.front}
        onChange={(e) => onChange(item.key, "front", e.target.value)}
        aria-label={`${frontLabel} ${index + 1}`}
      />
      <input
        value={item.back}
        placeholder={!item.back && suggest.list[0] ? suggest.list[0] : ""}
        onChange={(e) => onChange(item.key, "back", e.target.value)}
        aria-label={`${backLabel} ${index + 1}`}
        onKeyDown={(e) => {
          // Tab ou Entrée sur un champ vide : accepte la première proposition
          if ((e.key === "Tab" || e.key === "Enter") && !item.back && suggest.list[0] && !e.shiftKey) {
            onChange(item.key, "back", suggest.list[0]);
            if (e.key === "Enter") e.preventDefault();
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter();
          }
        }}
      />
      <button type="button" className="erase" onClick={() => onRemove(item.key)} aria-label="Retirer la ligne">×</button>

      {showSuggestions && (
        <div className="suggestions" aria-live="polite">
          {suggest.status === "loading" && <span className="suggest-note">Traduction…</span>}
          {suggest.status === "error" && <span className="suggest-note">Traduction indisponible — écris la tienne.</span>}
          {suggest.status === "done" && !suggest.list.length && <span className="suggest-note">Aucune proposition.</span>}
          {suggest.status === "done" && suggest.list.map((s) => (
            <button
              type="button"
              key={s}
              className={`suggest ${item.back === s ? "on" : ""}`}
              onClick={() => onChange(item.key, "back", s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
