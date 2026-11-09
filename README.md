# Révise

Site de révision : chacun crée des listes (vocabulaire, dates, formules, capitales…) et s'entraîne dessus.

- **Comptes** : inscription / connexion (mot de passe hashé, session par cookie).
- **Listes** : deux colonnes au nom libre (Français/Anglais, Question/Réponse, Pays/Capitale…). Créer, modifier, supprimer ses listes ; voir et utiliser celles des autres. Plusieurs réponses acceptées avec `/` (ex. `car / automobile`). Import en masse (`France ; Paris` par ligne).
- **Mode Cartes** : on retourne la carte, puis « Je le connais » (la barre avance, la carte sort) ou « Je ne le connais pas » (la carte revient plus tard). Raccourcis : Espace, ← / →.
- **Mode Écriture** : on tape la réponse ; la correction colore chaque lettre (rouge = fausse/en trop, souligné = manquante). En cas d'erreur, on peut quand même valider (faute de frappe) ou confirmer que c'était faux (l'élément revient).
- **Sens** : colonne 1 → colonne 2, l'inverse, ou mélangé.
- **Profil** : statistiques + historique des entraînements. Onglet « Évaluation » grisé (à venir).

## Design

Ambiance de bureau bleu canard : les listes sont des **fiches lignées**, le mode Cartes se joue sur un **tapis de feutre**, le mode Écriture sur une **machine à écrire**, le profil est un **carnet** (onglet Évaluation = marque-page verrouillé). La lumière de la lampe suit la souris ; six objets du bureau sont à découvrir (dont Margaux, la plante).

## Stack

- `backend/app.py` : API JSON Flask + SQLite (fichier `backend/data.db`, créé automatiquement). Sert aussi le build React (`frontend/dist`).
- `frontend/` : React 19 + Vite + React Router.

## Lancer en local

Prérequis : Python 3.12+ et Node.js 20+.

```powershell
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
cd frontend; npm install; npm run build; cd ..
.\.venv\Scripts\python backend\app.py
```

Puis ouvrir http://127.0.0.1:5000.

**Développement du front** (rechargement à chaud) : lancer Flask comme ci-dessus, puis `cd frontend; npm run dev` et ouvrir http://localhost:5173 (les appels `/api` sont relayés vers Flask).

Tests : `cd backend; ..\.venv\Scripts\python -m unittest test_app`

## Production

Variables d'environnement : `SECRET_KEY` (sinon générée dans `backend/.secret_key`), `DB_PATH`, `PORT`, `COOKIE_SECURE=1` derrière HTTPS. Utiliser un serveur WSGI (ex. `waitress-serve --chdir backend app:app`) plutôt que le serveur de dev Flask.

## API

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/api/register`, `/api/login`, `/api/logout` | Authentification |
| GET | `/api/me` | Utilisateur connecté |
| GET | `/api/lists?q=&mine=1` | Toutes les listes (ou les miennes) |
| POST | `/api/lists` | Créer une liste |
| GET / PUT / DELETE | `/api/lists/<id>` | Lire / modifier / supprimer (créateur seulement pour PUT/DELETE) |
| POST | `/api/trainings` | Enregistrer une session terminée |
| GET | `/api/me/history` | Historique + stats |

Les requêtes POST/PUT/DELETE exigent l'en-tête `X-Requested-With: fetch` (protection CSRF).
