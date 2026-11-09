import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";

let nextKey = 1;
const row = (front = "", back = "") => ({ key: nextKey++, front, back });

// Modèles de colonnes proposés en un clic
const PRESETS = [
  ["Question", "Réponse"],
  ["Français", "Anglais"],
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
  const [frontLabel, setFrontLabel] = useState("Question");
  const [backLabel, setBackLabel] = useState("Réponse");
  const [items, setItems] = useState(() => (id ? [] : [row(), row(), row()]));
  const [bulk, setBulk] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!!id);
  const focusKey = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!id) return;
    api(`/lists/${id}`).then(({ list }) => {
      if (list.owner_id !== user.id) return navigate(`/listes/${id}`, { replace: true });
      setTitle(list.title);
      setDescription(list.description);
      setFrontLabel(list.front_label);
      setBackLabel(list.back_label);
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

  async function save(e) {
    e.preventDefault();
    setError("");
    const payload = {
      title,
      description,
      front_label: frontLabel,
      back_label: backLabel,
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
          <p className="setup-title">Colonnes</p>
          <div className="presets">
            {PRESETS.map(([f, b]) => (
              <button
                type="button"
                key={f}
                className={`chip ${frontLabel === f && backLabel === b ? "on" : ""}`}
                onClick={() => { setFrontLabel(f); setBackLabel(b); }}
              >
                {f} / {b}
              </button>
            ))}
          </div>
        </div>

        <div className="word-head">
          <input value={frontLabel} onChange={(e) => setFrontLabel(e.target.value)} maxLength={30}
            aria-label="Nom de la première colonne" required />
          <input value={backLabel} onChange={(e) => setBackLabel(e.target.value)} maxLength={30}
            aria-label="Nom de la seconde colonne" required />
        </div>
        <ol className="word-rows" ref={listRef}>
          {items.map((x, i) => (
            <li key={x.key} data-key={x.key}>
              <span className="num">{i + 1}</span>
              <input
                value={x.front}
                onChange={(e) => update(x.key, "front", e.target.value)}
                aria-label={`${frontLabel} ${i + 1}`}
              />
              <input
                value={x.back}
                onChange={(e) => update(x.key, "back", e.target.value)}
                aria-label={`${backLabel} ${i + 1}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (i === items.length - 1) addRow();
                    else listRef.current.querySelector(`[data-key="${items[i + 1].key}"] input`).focus();
                  }
                }}
              />
              <button type="button" className="erase" onClick={() => removeRow(x.key)} aria-label="Retirer la ligne">×</button>
            </li>
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
