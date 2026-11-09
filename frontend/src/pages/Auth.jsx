import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function Auth({ mode }) {
  const { login } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isLogin = mode === "login";

  async function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await login(isLogin ? "/login" : "/register", form.get("username"), form.get("password"));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="entrance">
      <section className="entrance-text">
        <p className="eyebrow">Site de révision</p>
        <h1 className="display">Révise<br />ce que tu veux.</h1>
        <p className="lede">
          Crée des listes de révision — vocabulaire, dates, formules, définitions — puis
          entraîne-toi avec des cartes ou en écrivant les réponses. Ton historique garde
          une trace de tout ce que tu as révisé.
        </p>
      </section>

      <form className="library-card" onSubmit={submit} key={mode}>
        <div className="library-card-head">
          <span>{isLogin ? "Connexion" : "Inscription"}</span>
          {!isLogin && <span className="stamp-small">Gratuit</span>}
        </div>
        <label className="ruled">
          <span>Pseudo</span>
          <input name="username" autoComplete="username" required autoFocus minLength={3} maxLength={30} />
        </label>
        <label className="ruled">
          <span>Mot de passe</span>
          <input
            name="password"
            type="password"
            required
            minLength={isLogin ? undefined : 8}
            autoComplete={isLogin ? "current-password" : "new-password"}
          />
        </label>
        {!isLogin && <p className="hint">8 caractères minimum.</p>}
        {error && <p className="ink-error">{error}</p>}
        <button className="seal" disabled={busy}>
          {isLogin ? "Entrer" : "S'inscrire"}
        </button>
        <p className="library-card-foot">
          {isLogin ? (
            <>Pas encore de compte ? <Link to="/inscription">Créer un compte</Link></>
          ) : (
            <>Déjà un compte ? <Link to="/connexion">Se connecter</Link></>
          )}
        </p>
      </form>
    </div>
  );
}
