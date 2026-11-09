"""Révise — API Flask + SQLite. Sert aussi le frontend React compilé."""
import os
import secrets
import sqlite3
from functools import wraps
from pathlib import Path

from flask import Flask, g, jsonify, request, send_from_directory, session
from werkzeug.security import check_password_hash, generate_password_hash

BASE = Path(__file__).resolve().parent
FRONTEND = BASE.parent / "frontend" / "dist"  # build React (npm run build)
DB_PATH = Path(os.environ.get("DB_PATH", BASE / "data.db"))
SECRET_FILE = BASE / ".secret_key"

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS lists (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  front_label TEXT NOT NULL DEFAULT 'Question',
  back_label TEXT NOT NULL DEFAULT 'Réponse',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY,
  list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  position INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS trainings (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  list_id INTEGER REFERENCES lists(id) ON DELETE SET NULL,
  list_title TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('cards', 'typing')),
  direction TEXT NOT NULL CHECK (direction IN ('front_back', 'back_front', 'mixed')),
  word_count INTEGER NOT NULL,
  first_try INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  duration_sec INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_items_list ON items(list_id);
CREATE INDEX IF NOT EXISTS idx_trainings_user ON trainings(user_id, created_at);
"""

# v1 : passage du vocabulaire FR/EN à des listes génériques (recto / verso)
MIGRATION_V1 = """
ALTER TABLE words RENAME TO items;
ALTER TABLE items RENAME COLUMN french TO front;
ALTER TABLE items RENAME COLUMN english TO back;
DROP INDEX IF EXISTS idx_words_list;
ALTER TABLE lists ADD COLUMN front_label TEXT NOT NULL DEFAULT 'Français';
ALTER TABLE lists ADD COLUMN back_label TEXT NOT NULL DEFAULT 'Anglais';
ALTER TABLE trainings RENAME TO trainings_old;
DROP INDEX IF EXISTS idx_trainings_user;
""" + SCHEMA + """
INSERT INTO trainings SELECT id, user_id, list_id, list_title, mode,
  CASE direction WHEN 'fr_en' THEN 'front_back' WHEN 'en_fr' THEN 'back_front' ELSE 'mixed' END,
  word_count, first_try, attempts, duration_sec, created_at FROM trainings_old;
DROP TABLE trainings_old;
"""
DIRECTIONS = ("front_back", "back_front", "mixed")

app = Flask(__name__, static_folder=None)


def secret_key():
    if os.environ.get("SECRET_KEY"):
        return os.environ["SECRET_KEY"]
    if not SECRET_FILE.exists():
        SECRET_FILE.write_text(secrets.token_hex(32))
    return SECRET_FILE.read_text().strip()


app.config.update(
    SECRET_KEY=secret_key(),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("COOKIE_SECURE") == "1",
    PERMANENT_SESSION_LIFETIME=60 * 60 * 24 * 30,
)


def db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def init_db():
    conn = sqlite3.connect(DB_PATH)
    try:
        old = conn.execute("SELECT 1 FROM sqlite_master WHERE name = 'words'").fetchone()
        if old:  # base créée par la première version (FR/EN uniquement)
            try:
                conn.executescript("BEGIN;" + MIGRATION_V1 + "COMMIT;")
            except sqlite3.Error:
                if conn.in_transaction:
                    conn.execute("ROLLBACK")
                raise
        else:
            conn.executescript(SCHEMA)
    finally:
        conn.close()


def error(msg, status=400):
    return jsonify(error=msg), status


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            return error("Non connecté", 401)
        return fn(*args, **kwargs)
    return wrapper


@app.before_request
def csrf_guard():
    # Les requêtes qui modifient l'état doivent être en JSON : un formulaire
    # HTML d'un autre site ne peut pas envoyer ce Content-Type sans CORS.
    if request.path.startswith("/api/") and request.method in ("POST", "PUT", "DELETE"):
        if request.method != "DELETE" and not request.is_json:
            return error("Content-Type application/json requis", 415)
        if request.headers.get("X-Requested-With") != "fetch":
            return error("En-tête manquant", 403)


def body():
    return request.get_json(silent=True) or {}


# ---------- Auth ----------

@app.post("/api/register")
def register():
    data = body()
    username = str(data.get("username", "")).strip()
    password = str(data.get("password", ""))
    if not (3 <= len(username) <= 30) or not username.replace("_", "").replace("-", "").isalnum():
        return error("Nom d'utilisateur : 3 à 30 caractères (lettres, chiffres, - ou _)")
    if len(password) < 8:
        return error("Le mot de passe doit faire au moins 8 caractères")
    try:
        cur = db().execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, generate_password_hash(password)),
        )
        db().commit()
    except sqlite3.IntegrityError:
        return error("Ce nom d'utilisateur est déjà pris", 409)
    session.clear()
    session.permanent = True
    session["user_id"] = cur.lastrowid
    return jsonify(user={"id": cur.lastrowid, "username": username}), 201


@app.post("/api/login")
def login():
    data = body()
    row = db().execute(
        "SELECT * FROM users WHERE username = ?", (str(data.get("username", "")).strip(),)
    ).fetchone()
    if not row or not check_password_hash(row["password_hash"], str(data.get("password", ""))):
        return error("Identifiants incorrects", 401)
    session.clear()
    session.permanent = True
    session["user_id"] = row["id"]
    return jsonify(user={"id": row["id"], "username": row["username"]})


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify(ok=True)


@app.get("/api/me")
def me():
    uid = session.get("user_id")
    row = uid and db().execute(
        "SELECT id, username, created_at FROM users WHERE id = ?", (uid,)
    ).fetchone()
    if not row:
        session.clear()
        return jsonify(user=None)
    return jsonify(user=dict(row))


# ---------- Listes ----------

def parse_list_payload(data):
    title = str(data.get("title", "")).strip()
    description = str(data.get("description", "")).strip()
    front_label = str(data.get("front_label", "")).strip() or "Question"
    back_label = str(data.get("back_label", "")).strip() or "Réponse"
    items = []
    for it in data.get("items") or []:
        if not isinstance(it, dict):
            continue
        front, back = str(it.get("front", "")).strip(), str(it.get("back", "")).strip()
        if front and back:
            items.append((front[:300], back[:300]))
    if not title or len(title) > 100:
        return None, "Le titre est obligatoire (100 caractères max)"
    if len(front_label) > 30 or len(back_label) > 30:
        return None, "Noms de colonnes : 30 caractères max"
    if not items:
        return None, "Ajoute au moins un élément (les deux colonnes remplies)"
    if len(items) > 500:
        return None, "500 éléments maximum par liste"
    return (title, description[:500], front_label, back_label, items), None


def save_items(list_id, items):
    db().execute("DELETE FROM items WHERE list_id = ?", (list_id,))
    db().executemany(
        "INSERT INTO items (list_id, front, back, position) VALUES (?, ?, ?, ?)",
        [(list_id, f, b, i) for i, (f, b) in enumerate(items)],
    )


def get_owned_list(list_id):
    row = db().execute("SELECT * FROM lists WHERE id = ?", (list_id,)).fetchone()
    if not row:
        return None, error("Liste introuvable", 404)
    if row["owner_id"] != session["user_id"]:
        return None, error("Tu n'es pas le créateur de cette liste", 403)
    return row, None


@app.get("/api/lists")
@login_required
def list_lists():
    q = f"%{request.args.get('q', '').strip()}%"
    sql = """
      SELECT l.id, l.title, l.description, l.front_label, l.back_label,
             l.created_at, l.updated_at, u.username AS owner, l.owner_id,
             (SELECT COUNT(*) FROM items i WHERE i.list_id = l.id) AS item_count
      FROM lists l JOIN users u ON u.id = l.owner_id
      WHERE (l.title LIKE ? OR l.description LIKE ? OR u.username LIKE ?
             OR l.front_label LIKE ? OR l.back_label LIKE ?)
    """
    params = [q] * 5
    if request.args.get("mine") == "1":
        sql += " AND l.owner_id = ?"
        params.append(session["user_id"])
    sql += " ORDER BY l.updated_at DESC LIMIT 200"
    lists = [dict(r) for r in db().execute(sql, params)]
    # Aperçu : les 3 premiers éléments de chaque liste
    if lists:
        ids = [l["id"] for l in lists]
        rows = db().execute(
            f"""SELECT list_id, front, back FROM items
                WHERE list_id IN ({",".join("?" * len(ids))}) AND position < 3
                ORDER BY list_id, position""",
            ids,
        )
        previews = {}
        for r in rows:
            previews.setdefault(r["list_id"], []).append({"front": r["front"], "back": r["back"]})
        for l in lists:
            l["preview"] = previews.get(l["id"], [])
    return jsonify(lists=lists)


@app.post("/api/lists")
@login_required
def create_list():
    parsed, err = parse_list_payload(body())
    if err:
        return error(err)
    title, description, front_label, back_label, items = parsed
    cur = db().execute(
        "INSERT INTO lists (owner_id, title, description, front_label, back_label) VALUES (?, ?, ?, ?, ?)",
        (session["user_id"], title, description, front_label, back_label),
    )
    save_items(cur.lastrowid, items)
    db().commit()
    return jsonify(id=cur.lastrowid), 201


@app.get("/api/lists/<int:list_id>")
@login_required
def get_list(list_id):
    row = db().execute(
        """SELECT l.*, u.username AS owner FROM lists l
           JOIN users u ON u.id = l.owner_id WHERE l.id = ?""",
        (list_id,),
    ).fetchone()
    if not row:
        return error("Liste introuvable", 404)
    items = db().execute(
        "SELECT id, front, back FROM items WHERE list_id = ? ORDER BY position", (list_id,)
    ).fetchall()
    return jsonify(list={**dict(row), "items": [dict(i) for i in items]})


@app.put("/api/lists/<int:list_id>")
@login_required
def update_list(list_id):
    _, err = get_owned_list(list_id)
    if err:
        return err
    parsed, msg = parse_list_payload(body())
    if msg:
        return error(msg)
    title, description, front_label, back_label, items = parsed
    db().execute(
        """UPDATE lists SET title = ?, description = ?, front_label = ?, back_label = ?,
             updated_at = CURRENT_TIMESTAMP WHERE id = ?""",
        (title, description, front_label, back_label, list_id),
    )
    save_items(list_id, items)
    db().commit()
    return jsonify(id=list_id)


@app.delete("/api/lists/<int:list_id>")
@login_required
def delete_list(list_id):
    _, err = get_owned_list(list_id)
    if err:
        return err
    db().execute("DELETE FROM lists WHERE id = ?", (list_id,))
    db().commit()
    return jsonify(ok=True)


# ---------- Entraînements / historique ----------

@app.post("/api/trainings")
@login_required
def create_training():
    d = body()
    lst = db().execute("SELECT id, title FROM lists WHERE id = ?", (d.get("list_id"),)).fetchone()
    if not lst:
        return error("Liste introuvable", 404)
    if d.get("mode") not in ("cards", "typing") or d.get("direction") not in DIRECTIONS:
        return error("Mode ou direction invalide")
    try:
        nums = [max(0, int(d.get(k, 0))) for k in ("item_count", "first_try", "attempts", "duration_sec")]
    except (TypeError, ValueError):
        return error("Valeurs numériques invalides")
    db().execute(
        """INSERT INTO trainings (user_id, list_id, list_title, mode, direction,
             word_count, first_try, attempts, duration_sec)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (session["user_id"], lst["id"], lst["title"], d["mode"], d["direction"], *nums),
    )
    db().commit()
    return jsonify(ok=True), 201


@app.get("/api/me/history")
@login_required
def history():
    uid = session["user_id"]
    rows = db().execute(
        """SELECT t.id, t.list_id, t.list_title, t.mode, t.direction, t.word_count AS item_count,
                  t.first_try, t.attempts, t.duration_sec, t.created_at,
                  l.front_label, l.back_label
           FROM trainings t LEFT JOIN lists l ON l.id = t.list_id
           WHERE t.user_id = ? ORDER BY t.created_at DESC, t.id DESC LIMIT 100""",
        (uid,),
    ).fetchall()
    stats = db().execute(
        """SELECT COUNT(*) AS sessions, COALESCE(SUM(word_count), 0) AS items,
                  COALESCE(SUM(duration_sec), 0) AS seconds,
                  (SELECT COUNT(*) FROM lists WHERE owner_id = ?) AS lists_created
           FROM trainings WHERE user_id = ?""",
        (uid, uid),
    ).fetchone()
    return jsonify(history=[dict(r) for r in rows], stats=dict(stats))


# ---------- Frontend ----------

@app.get("/")
@app.get("/<path:path>")
def frontend(path="index.html"):
    if path.startswith("api/"):
        return error("Route inconnue", 404)
    if not (FRONTEND / "index.html").is_file():
        return "Frontend non compilé : lance `npm run build` dans frontend/.", 503
    if (FRONTEND / path).is_file():
        return send_from_directory(FRONTEND, path)
    return send_from_directory(FRONTEND, "index.html")


init_db()

if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG") == "1", port=int(os.environ.get("PORT", 5000)))
