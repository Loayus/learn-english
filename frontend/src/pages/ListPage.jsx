import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, directionLabel, DIRECTIONS, plural } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Deck, Typewriter } from "../components/Props.jsx";

export default function ListPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [dir, setDir] = useState("front_back");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setList(null);
    api(`/lists/${id}`).then((d) => setList(d.list)).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="ink-error center">{error} <Link to="/">Retour</Link></p>;
  if (!list) return <div className="loading">…</div>;

  const isOwner = list.owner_id === user.id;
  const start = (mode) => navigate(`/reviser/${id}/${mode}/${dir}`);

  async function remove() {
    if (!confirmDelete) return setConfirmDelete(true);
    await api(`/lists/${id}`, { method: "DELETE" });
    navigate("/");
  }

  return (
    <div className="sheet-wrap">
      <Link to="/" className="back-link">← Toutes les listes</Link>
      <article className="list-sheet">
        <section className="sheet-col">
          <p className="eyebrow">
            Liste · {plural(list.items.length, "élément")} · créée par {isOwner ? "toi" : list.owner}
          </p>
          <h1 className="sheet-title">{list.title}</h1>
          {list.description && <p className="sheet-desc">{list.description}</p>}

          <h2 className="page-heading">Réviser</h2>
          <div className="segmented" role="radiogroup" aria-label="Sens de révision">
            {DIRECTIONS.map((v) => (
              <button key={v} role="radio" aria-checked={dir === v} className={dir === v ? "on" : ""} onClick={() => setDir(v)}>
                {directionLabel(v, list.front_label, list.back_label)}
              </button>
            ))}
          </div>
          <div className="modes">
            <button className="mode" onClick={() => start("cards")}>
              <Deck />
              <strong>Cartes</strong>
              <span>Retourne la carte et dis si tu savais.</span>
            </button>
            <button className="mode" onClick={() => start("typing")}>
              <Typewriter />
              <strong>Écriture</strong>
              <span>Écris la réponse, corrigée lettre par lettre.</span>
            </button>
          </div>

          {isOwner && (
            <div className="owner-actions">
              <Link to={`/listes/${id}/modifier`} className="pill pill-ink">Modifier</Link>
              <button className={`pill pill-danger ${confirmDelete ? "armed" : ""}`} onClick={remove}
                onBlur={() => setConfirmDelete(false)}>
                {confirmDelete ? "Confirmer la suppression ?" : "Supprimer"}
              </button>
            </div>
          )}
        </section>

        <section className="sheet-col sheet-col-right">
          <h2 className="page-heading">Contenu</h2>
          <div className="contents-head">
            <span>{list.front_label}</span>
            <span>{list.back_label}</span>
          </div>
          <ol className="contents">
            {list.items.map((it) => (
              <li key={it.id}>
                <span className="front">{it.front}</span>
                <span className="leader" aria-hidden="true" />
                <span className="back">{it.back}</span>
              </li>
            ))}
          </ol>
        </section>
      </article>
    </div>
  );
}
