# Learn English

Site pour apprendre du vocabulaire anglais avec des listes créées par les utilisateurs.

- **Comptes** : inscription / connexion (mot de passe hashé, session par cookie).
- **Listes de vocabulaire** : créer, modifier, supprimer ses listes ; voir et utiliser celles des autres. Plusieurs traductions acceptées avec `/` (ex. `car / automobile`). Import en masse (`chat ; cat` par ligne).
- **Mode Cartes** : on retourne la carte, puis « Je le connais » (la barre avance, la carte sort) ou « Je ne le connais pas » (la carte revient plus tard). Raccourcis : Espace, ← / →.
- **Mode Écriture** : on tape la traduction ; la correction colore chaque lettre (rouge = fausse/en trop, souligné = manquante). En cas d'erreur, on peut quand même valider (faute de frappe) ou confirmer que c'était faux (le mot revient).
- **Sens** : FR → EN, EN → FR ou mélangé.
- **Profil** : statistiques + historique des entraînements. Onglet « Évaluation » grisé (à venir).

## Stack

- `backend/app.py` : API JSON Flask + SQLite (fichier `backend/data.db`, créé automatiquement). Sert aussi le frontend.
- `frontend/` : HTML/CSS/JS sans framework ni build.

## Lancer en local

```powershell
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\python backend\app.py
```

Puis ouvrir http://127.0.0.1:5000.

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
