# Révise

Site de révision : chacun crée des listes (vocabulaire, dates, formules, capitales…) et s'entraîne dessus.

- **Comptes** : inscription / connexion (mot de passe hashé, session par cookie).
- **Listes** : deux colonnes au nom libre (Français/Anglais, Question/Réponse, Pays/Capitale…). Créer, modifier, supprimer ses listes ; voir et utiliser celles des autres. Plusieurs réponses acceptées avec `/` (ex. `car / automobile`). Import en masse (`France ; Paris` par ligne).
- **Listes de langues** : type « 🌍 Langues » → on choisit la langue connue et celle qu'on apprend (19 langues). En tapant un mot dans la 1re colonne, des traductions sont proposées pour la 2e : on clique sur une proposition (ou Tab/Entrée pour la première), ou on écrit la sienne.
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

## Traduction

Les propositions viennent de [MyMemory](https://mymemory.translated.net/doc/spec.php), gratuit et sans clé (environ 5 000 caractères/jour par adresse IP, environ 50 000 si la variable `MYMEMORY_EMAIL` contient un email de contact). Les appels passent par le serveur (`GET /api/translate?q=&from=&to=`) et chaque résultat est mis en cache dans la table `translations`, donc un même mot n'est demandé qu'une fois. Si le service est indisponible ou le quota atteint, l'utilisateur écrit simplement sa traduction. Les mots tapés sont envoyés à ce service tiers.

## Mise en ligne (PythonAnywhere, gratuit)

À chaque push sur `main`, le GitHub Action `.github/workflows/deploy-branch.yml` lance les tests, compile le front et publie le tout (avec `frontend/dist`) sur la branche **`deploy`**. Le serveur n'a donc pas besoin de Node.

**Installation (une seule fois)**

1. Créer un compte gratuit « Beginner » sur https://www.pythonanywhere.com.
2. Onglet *Consoles* → *Bash* :
   ```bash
   git clone -b deploy https://github.com/Loayus/learn-english.git
   mkvirtualenv revise --python=python3.12
   pip install -r learn-english/requirements.txt
   python -c "import secrets; print(secrets.token_hex(32))"   # clé secrète à copier
   ```
3. Onglet *Web* → *Add a new web app* → *Manual configuration* → *Python 3.12*.
   - *Virtualenv* : `/home/TONPSEUDO/.virtualenvs/revise`
   - Remplacer le contenu du *WSGI configuration file* par :
     ```python
     import os, sys
     os.environ["SECRET_KEY"] = "LA_CLÉ_SECRÈTE"
     os.environ["COOKIE_SECURE"] = "1"
     os.environ["MYMEMORY_EMAIL"] = "ton.email@exemple.com"  # facultatif : quota de traduction x10
     sys.path.insert(0, "/home/TONPSEUDO/learn-english/backend")
     from app import app as application
     ```
   - Activer *Force HTTPS*, puis *Reload*. Le site est sur `https://TONPSEUDO.pythonanywhere.com`.

**Mettre à jour le site** (après un push sur `main` et la fin de l'Action) : dans une console Bash,
```bash
bash ~/learn-english/deploy/update.sh
```
La base `backend/data.db` n'est jamais touchée par la mise à jour. Penser à cliquer sur *Run until 3 months from today* (onglet *Web*) tous les 3 mois.

**Autre hébergeur** : variables d'environnement `SECRET_KEY` (sinon générée dans `backend/.secret_key`), `DB_PATH`, `PORT`, `COOKIE_SECURE=1` derrière HTTPS, `MYMEMORY_EMAIL` ; utiliser un serveur WSGI (ex. `waitress-serve --chdir backend app:app`) plutôt que le serveur de dev Flask.

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
| GET | `/api/languages` | Langues disponibles pour les listes de vocabulaire |
| GET | `/api/translate?q=&from=&to=` | Propositions de traduction (MyMemory, mises en cache) |

Les requêtes POST/PUT/DELETE exigent l'en-tête `X-Requested-With: fetch` (protection CSRF).
