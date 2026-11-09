import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, plural } from "../api.js";
import { useAuth } from "../auth.jsx";
import { OBJECTS, useRoom } from "../components/Room.jsx";
import { Carrot, Chest, Deck, Lamp, Notebook, Plant, Typewriter } from "../components/Props.jsx";

// Couleur de l'onglet d'une liste, stable selon son id
const TABS = ["#0b4f5c", "#d9a441", "#e0715a", "#8fd3c2", "#2a8c97", "#a3472f", "#14213d"];

export default function Lists() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { discovered, discover, showNote, lampOn, setLampOn } = useRoom();
  const [lists, setLists] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [mine, setMine] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams({ q: query });
    if (mine) params.set("mine", "1");
    let cancelled = false;
    const t = setTimeout(() => {
      api("/lists?" + params)
        .then((d) => !cancelled && setLists(d.lists))
        .catch((e) => !cancelled && setError(e.message));
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, mine]);

  const props = [
    { key: "lamp", label: "La lampe", El: <Lamp on={lampOn} />, action: () => {
      setLampOn(!lampOn);
      showNote(lampOn ? "Clic. Il fait sombre… la lumière suivait ta souris." : "Et la lumière fut.");
    } },
    { key: "plant", label: "Margaux", El: <Plant />, action: () =>
      showNote("Elle s'appelle Margaux. Elle aussi révise le TOEIC.") },
    { key: "carrot", label: "Matheo", El: <Carrot />, action: () =>
      showNote("Eh oui, les carottes révisent aussi.") },
    { key: "notebook", label: "Ton profil", El: <Notebook />, action: () => navigate("/profil") },
    { key: "deck", label: "Les cartes", El: <Deck />, action: () =>
      showNote("Ouvre une liste et choisis « Cartes » : retourne, dis si tu savais.") },
    { key: "typewriter", label: "La machine à écrire", El: <Typewriter />, action: () =>
      showNote("Ouvre une liste et choisis « Écriture » : chaque lettre est corrigée.") },
    { key: "chest", label: "Le coffre", El: <Chest />, locked: true, action: () =>
      showNote("Verrouillé. Le mode Évaluation arrive bientôt.") },
  ];

  return (
    <div className="lists-page">
      <section className="intro">
        <h1 className="display">Crée tes listes.<br />Révise-les.</h1>
        <p className="lede">
          Vocabulaire, dates, formules, capitales… Fais une liste, puis entraîne-toi
          avec des cartes ou en écrivant les réponses. Toutes les listes sont partagées.
        </p>
      </section>

      <div className="list-controls">
        <div className="toggle" role="tablist">
          <button role="tab" aria-selected={!mine} className={!mine ? "on" : ""} onClick={() => setMine(false)}>
            Toutes les listes
          </button>
          <button role="tab" aria-selected={mine} className={mine ? "on" : ""} onClick={() => setMine(true)}>
            Mes listes
          </button>
        </div>
        <label className="plaque">
          <span className="sr-only">Rechercher</span>
          <input
            type="search"
            placeholder="Chercher une liste, un sujet, un auteur…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      {error && <p className="ink-error">{error}</p>}
      <div className="list-grid">
        <Link to="/listes/nouvelle" className="list-card list-card-new">
          <span className="plus">+</span>
          <span>Nouvelle liste</span>
        </Link>
        {lists?.map((l) => (
          <Link key={l.id} to={`/listes/${l.id}`} className="list-card" style={{ "--tab": TABS[l.id % TABS.length] }}>
            <span className="list-card-labels">{l.front_label} → {l.back_label}</span>
            <h2 className="list-card-title">{l.title}</h2>
            <ul className="list-card-preview">
              {l.preview.map((it, i) => (
                <li key={i}><span>{it.front}</span><span>{it.back}</span></li>
              ))}
              {l.item_count > l.preview.length && <li className="more">+ {l.item_count - l.preview.length} autres</li>}
            </ul>
            <span className="list-card-foot">
              <span>{plural(l.item_count, "élément")}</span>
              <span>{l.owner_id === user.id ? "par toi" : `par ${l.owner}`}</span>
            </span>
          </Link>
        ))}
      </div>
      {lists && !lists.length && (
        <p className="empty-note center-note">
          {query ? "Aucune liste ne correspond à ta recherche." : mine ? "Tu n'as encore créé aucune liste." : "Aucune liste pour l'instant — crée la première !"}
        </p>
      )}

      <p className="desk-caption">Ton bureau · {discovered.size} sur {OBJECTS.length} objets découverts</p>
      <div className="desk">
        {props.map(({ key, label, El, action, locked }) => (
          <button
            key={key}
            className={`prop prop-${key} ${locked ? "locked" : ""}`}
            onClick={() => { discover(key); action(); }}
            aria-label={label}
          >
            {El}
            <span className="prop-label">{label}{locked && " · bientôt"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
