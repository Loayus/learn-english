import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, directionLabel, formatDuration, MODES, parseDate } from "../api.js";
import { useAuth } from "../auth.jsx";

export default function Profile() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api("/me"), api("/me/history")])
      .then(([me, h]) => setData({ since: me.user.created_at, ...h }))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="ink-error center">{error}</p>;
  if (!data) return <div className="loading">…</div>;

  const { stats, history } = data;
  const seals = [
    [stats.sessions, "révisions"],
    [stats.items, "éléments révisés"],
    [formatDuration(stats.seconds), "de révision"],
    [stats.lists_created, "listes créées"],
  ];

  return (
    <div className="journal-wrap">
      <div className="journal">
        <nav className="ribbons" aria-label="Onglets du profil">
          <span className="ribbon on" aria-current="page">Historique</span>
          <span className="ribbon locked" aria-disabled="true" title="Bientôt disponible">
            Évaluation <span aria-hidden="true">🔒</span>
          </span>
        </nav>

        <div className="journal-page">
          <p className="eyebrow">
            Profil de {user.username} · membre depuis le{" "}
            {parseDate(data.since).toLocaleDateString("fr-FR", { dateStyle: "long" })}
          </p>
          <h1 className="sheet-title">Historique de révision</h1>

          <div className="seals">
            {seals.map(([v, label]) => (
              <div className="seal-stat" key={label}>
                <strong>{v}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <h2 className="page-heading">Dernières révisions</h2>
          {history.length ? (
            <ol className="entries">
              {history.map((t) => {
                const d = parseDate(t.created_at);
                return (
                  <li key={t.id}>
                    <time dateTime={d.toISOString()}>
                      <b>{d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</b>
                      <span>{d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </time>
                    <div>
                      <p className="entry-title">
                        {t.list_id ? <Link to={`/listes/${t.list_id}`}>{t.list_title}</Link>
                          : <span className="gone">{t.list_title} (supprimée)</span>}
                      </p>
                      <p className="hint">
                        {MODES[t.mode]} · {directionLabel(t.direction, t.front_label ?? undefined, t.back_label ?? undefined)} · {formatDuration(t.duration_sec)}
                      </p>
                    </div>
                    <span className={`entry-score ${t.first_try === t.item_count ? "perfect" : ""}`}
                      title="Trouvés du premier coup">
                      {t.first_try}/{t.item_count}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="empty-note">
              Aucune révision pour l'instant. <Link to="/">Choisis une liste</Link> pour commencer.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
