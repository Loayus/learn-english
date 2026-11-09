import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { api, directionLabel, DIRECTIONS, formatDuration, MODES } from "../api.js";
import { alternatives, checkAnswer } from "../lib/check.js";

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Chaque carte : une question (q) et la réponse attendue (a), avec le nom de leur colonne
function makeDeck(list, dir) {
  const F = list.front_label;
  const B = list.back_label;
  return shuffle(list.items).map((it) => {
    const forward = dir === "front_back" || (dir === "mixed" && Math.random() < 0.5);
    return forward
      ? { id: it.id, q: it.front, a: it.back, qLabel: F, aLabel: B }
      : { id: it.id, q: it.back, a: it.front, qLabel: B, aLabel: F };
  });
}

export default function Train() {
  const { id, mode, dir } = useParams();
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [run, setRun] = useState(0);

  useEffect(() => {
    api(`/lists/${id}`).then((d) => setList(d.list)).catch((e) => setError(e.message));
  }, [id]);

  if (!MODES[mode] || !DIRECTIONS.includes(dir)) return <Navigate to={`/listes/${id}`} replace />;
  if (error) return <p className="ink-error center">{error}</p>;
  if (!list) return <div className="loading">…</div>;

  return <Session key={run} list={list} mode={mode} dir={dir} onRestart={() => setRun((r) => r + 1)} />;
}

function Session({ list, mode, dir, onRestart }) {
  const total = list.items.length;
  const [queue, setQueue] = useState(() => makeDeck(list, dir));
  const [learned, setLearned] = useState(0);
  const [turn, setTurn] = useState(0); // nombre de réponses données
  const [summary, setSummary] = useState(null);
  const startedAt = useRef(Date.now());
  const triesByItem = useRef(new Map());

  function answer(known) {
    const [card, ...rest] = queue;
    const tries = (triesByItem.current.get(card.id) || 0) + 1;
    triesByItem.current.set(card.id, tries);
    const nextQueue = known ? rest : [...rest, card]; // pas connu → la carte revient plus tard
    const nextTurn = turn + 1;
    setQueue(nextQueue);
    setTurn(nextTurn);
    if (known) setLearned((n) => n + 1);
    if (!nextQueue.length) finish(nextTurn);
  }

  async function finish(attempts) {
    const firstTry = [...triesByItem.current.values()].filter((n) => n === 1).length;
    const duration = Math.round((Date.now() - startedAt.current) / 1000);
    const result = { firstTry, attempts, duration, saved: null };
    setSummary(result);
    try {
      await api("/trainings", {
        method: "POST",
        body: { list_id: list.id, mode, direction: dir, item_count: total, first_try: firstTry, attempts, duration_sec: duration },
      });
      setSummary({ ...result, saved: true });
    } catch (e) {
      setSummary({ ...result, saved: e.message });
    }
  }

  const card = queue[0];

  return (
    <div className={`trainer trainer-${mode}`}>
      <div className="trainer-top">
        <Link to={`/listes/${list.id}`} className="back-link">← Quitter</Link>
        <p className="eyebrow">{list.title} · {MODES[mode]} · {directionLabel(dir, list.front_label, list.back_label)}</p>
      </div>

      <div className="ruler" aria-label={`${learned} sur ${total} éléments acquis`}>
        <div className="ruler-fill" style={{ width: `${(learned / total) * 100}%` }} />
        <div className="ruler-ticks" style={{ "--n": Math.min(total, 40) }} />
        <span className="ruler-count">{learned} / {total}</span>
      </div>

      {summary ? (
        <Summary summary={summary} total={total} listId={list.id} onRestart={onRestart} />
      ) : mode === "cards" ? (
        <FlashCard key={`${card.id}-${turn}`} card={card} onAnswer={answer} />
      ) : (
        <TypingSheet key={`${card.id}-${turn}`} card={card} onAnswer={answer} />
      )}
    </div>
  );
}

function FlashCard({ card, onAnswer }) {
  const [flipped, setFlipped] = useState(false);
  const [revealed, setRevealed] = useState(false); // une fois vue, la réponse débloque les boutons

  const flip = () => { setFlipped((f) => !f); setRevealed(true); };

  useEffect(() => {
    const onKey = (e) => {
      if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      if (e.key === " ") { e.preventDefault(); flip(); }
      else if (revealed && e.key === "ArrowRight") onAnswer(true);
      else if (revealed && e.key === "ArrowLeft") onAnswer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="felt">
      <button className={`card3d ${flipped ? "flipped" : ""}`} onClick={flip} aria-label="Retourner la carte">
        <span className="card3d-inner">
          <span className="card-face front">
            <Corner label={card.qLabel} />
            <span className="card-word">{card.q}</span>
            <span className="card-hint">clique ou Espace pour retourner</span>
            <Corner label={card.qLabel} flip />
          </span>
          <span className="card-face back">
            <Corner label={card.aLabel} />
            <span className="card-word">{card.a}</span>
            <span className="card-hint">{card.q}</span>
            <Corner label={card.aLabel} flip />
          </span>
        </span>
      </button>
      <div className="answer-row">
        <button className="pill pill-big pill-danger" disabled={!revealed} onClick={() => onAnswer(false)}>
          ← Je ne le connais pas
        </button>
        <button className="pill pill-big pill-mint" disabled={!revealed} onClick={() => onAnswer(true)}>
          Je le connais →
        </button>
      </div>
    </div>
  );
}

function Corner({ label, flip }) {
  return (
    <span className={`corner ${flip ? "corner-flip" : ""}`}>
      <b>{label}</b>
      <i>✦</i>
    </span>
  );
}

function TypingSheet({ card, onAnswer }) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState(undefined); // undefined = en saisie, null = « je ne sais pas »
  const nextRef = useRef(null);

  useEffect(() => { if (result !== undefined) nextRef.current?.focus(); }, [result]);

  const submit = (e) => {
    e.preventDefault();
    if (value.trim()) setResult(checkAnswer(value, card.a));
  };

  const answering = result === undefined;

  return (
    <div className="typewriter">
      <div className="sheet">
        <p className="sheet-lang">{card.qLabel} → {card.aLabel}</p>
        <p className="sheet-word">{card.q}</p>

        <form onSubmit={submit}>
          <input
            className="type-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={!answering}
            autoFocus
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={`${card.aLabel}…`}
            aria-label={`Ta réponse : ${card.aLabel}`}
          />
          {answering && (
            <div className="answer-row">
              <button type="button" className="pill pill-ink" onClick={() => setResult(null)}>Je ne sais pas</button>
              <button className="pill pill-big pill-duck">Taper ⏎</button>
            </div>
          )}
        </form>

        {result?.correct && (
          <div className="verdict">
            <span className="stamp stamp-ok">Correct</span>
            {alternatives(card.a).length > 1 && <p className="hint">Réponses acceptées : {card.a}</p>}
            <div className="answer-row">
              <button ref={nextRef} className="pill pill-big pill-mint" onClick={() => onAnswer(true)}>Suivant →</button>
            </div>
          </div>
        )}

        {result !== undefined && !result?.correct && (
          <div className="verdict">
            <span className="stamp stamp-ko">À revoir</span>
            {result && (
              <p className="diff" aria-label="Ta réponse corrigée">
                {result.ops.map((o, i) => (
                  <span key={i} className={`d-${o.t}`}>{o.ch === " " ? " " : o.ch}</span>
                ))}
              </p>
            )}
            <p className="expected">Réponse attendue : <strong>{card.a}</strong></p>
            {result ? (
              <>
                <p className="hint">Une faute de frappe ? Tu peux quand même valider.</p>
                <div className="answer-row">
                  <button ref={nextRef} className="pill pill-big pill-danger" onClick={() => onAnswer(false)}>
                    Non, c'était faux
                  </button>
                  <button className="pill pill-big pill-ink" onClick={() => onAnswer(true)}>
                    Oui, valider quand même
                  </button>
                </div>
              </>
            ) : (
              <div className="answer-row">
                <button ref={nextRef} className="pill pill-big pill-duck" onClick={() => onAnswer(false)}>Continuer</button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="machine" aria-hidden="true">
        <div className="machine-roller" />
        <div className="machine-body">
          {Array.from({ length: 3 }, (_, r) => (
            <div className="keys" key={r}>
              {Array.from({ length: 10 - r }, (_, k) => <span key={k} />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Summary({ summary, total, listId, onRestart }) {
  const perfect = summary.firstTry === total;
  return (
    <div className="certificate">
      <span className="stamp stamp-big">{perfect ? "Parfait" : "Terminé"}</span>
      <p className="eyebrow">Liste terminée</p>
      <p className="score">{summary.firstTry}<small> / {total}</small></p>
      <p>trouvés du premier coup</p>
      <p className="hint">{summary.attempts} réponses · {formatDuration(summary.duration)}</p>
      <p className="hint">
        {summary.saved === null ? "Enregistrement…"
          : summary.saved === true ? "Ajouté à ton historique."
          : `Impossible de noter la session : ${summary.saved}`}
      </p>
      <div className="answer-row">
        <Link to={`/listes/${listId}`} className="pill pill-ink">Retour à la liste</Link>
        <button className="pill pill-big pill-duck" onClick={onRestart}>Recommencer</button>
      </div>
    </div>
  );
}
