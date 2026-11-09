import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

// Les objets du bureau qu'on peut « découvrir » en cliquant dessus
export const OBJECTS = ["lamp", "plant", "carrot", "notebook", "deck", "typewriter", "chest"];
const STORAGE_KEY = "revise:discovered";

const RoomContext = createContext(null);
export const useRoom = () => useContext(RoomContext);

function loadDiscovered() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY)) || []);
  } catch {
    return new Set();
  }
}

export default function Room() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const roomRef = useRef(null);
  const [discovered, setDiscovered] = useState(loadDiscovered);
  const [lampOn, setLampOn] = useState(true);
  const [note, setNote] = useState(null);

  const discover = useCallback((key) => {
    setDiscovered((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev).add(key);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch { /* stockage indisponible */ }
      return next;
    });
  }, []);

  // Petite note papier qui s'affiche quelques secondes en bas de l'écran
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 4200);
    return () => clearTimeout(t);
  }, [note]);

  useEffect(() => setNote(null), [location.pathname]);

  // La lumière de la lampe suit la souris
  useEffect(() => {
    let frame = 0;
    const move = (e) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        roomRef.current?.style.setProperty("--mx", `${e.clientX}px`);
        roomRef.current?.style.setProperty("--my", `${e.clientY}px`);
      });
    };
    window.addEventListener("pointermove", move);
    return () => { window.removeEventListener("pointermove", move); cancelAnimationFrame(frame); };
  }, []);

  const ctx = { discovered, discover, lampOn, setLampOn, showNote: setNote };

  return (
    <RoomContext.Provider value={ctx}>
      <div ref={roomRef} className={`room ${lampOn ? "" : "lamp-off"}`}>
        <div className="room-light" aria-hidden="true" />
        <LeafShadows />

        <header className="hud">
          <NavLink to="/" className="hud-title">
            <span className="hud-name">Révise</span>
            <span className="hud-sub">Tes listes de révision</span>
          </NavLink>
          {user && (
            <nav className="hud-nav">
              <NavLink to="/" end className="pill">Listes</NavLink>
              <NavLink to="/listes/nouvelle" className="pill">+ Nouvelle liste</NavLink>
              <NavLink to="/profil" className="pill">Profil · {user.username}</NavLink>
              <button
                className="pill pill-ghost"
                onClick={async () => { await logout(); navigate("/connexion"); }}
              >
                Déconnexion
              </button>
            </nav>
          )}
        </header>

        <main className="stage">
          <Outlet />
        </main>

        {note && (
          <div className="paper-note" role="status" onClick={() => setNote(null)}>
            {note}
          </div>
        )}
        <div className="grain" aria-hidden="true" />
      </div>
    </RoomContext.Provider>
  );
}

// Ombres de feuillage projetées sur le mur, qui se balancent doucement
function LeafShadows() {
  const leaves = [
    [8, 4, 38, -20], [14, 10, 30, 15], [4, 16, 34, 40], [20, 2, 26, -45],
    [24, 14, 32, 10], [11, 22, 28, -5], [30, 8, 24, 60], [2, 28, 30, 25],
  ];
  return (
    <svg className="leaf-shadows" viewBox="0 0 40 40" aria-hidden="true">
      <g className="sway">
        <path d="M0 0 Q 18 10 34 34" className="stem" />
        {leaves.map(([x, y, s, r], i) => (
          <ellipse key={i} cx={x} cy={y} rx={s / 10} ry={s / 22} transform={`rotate(${r} ${x} ${y})`} />
        ))}
      </g>
    </svg>
  );
}
