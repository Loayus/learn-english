"""Tests de l'API : python -m unittest discover backend"""
import os
import sqlite3
import tempfile
import unittest

os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["SECRET_KEY"] = "test"

import app as app_module  # noqa: E402
from app import FRONTEND, app  # noqa: E402

H = {"X-Requested-With": "fetch"}


class ApiTest(unittest.TestCase):
    def client_for(self, name):
        c = app.test_client()
        r = c.post("/api/register", json={"username": name, "password": "password123"}, headers=H)
        self.assertEqual(r.status_code, 201, r.json)
        return c

    def test_full_flow(self):
        alice, bob = self.client_for("alice"), self.client_for("bob")

        # Doublon et mauvais mot de passe
        self.assertEqual(app.test_client().post("/api/register", json={"username": "ALICE", "password": "password123"}, headers=H).status_code, 409)
        self.assertEqual(app.test_client().post("/api/login", json={"username": "alice", "password": "nope"}, headers=H).status_code, 401)

        # Sans en-tête anti-CSRF → refusé
        self.assertEqual(alice.post("/api/lists", json={}).status_code, 403)

        r = alice.post("/api/lists", headers=H, json={
            "title": "Capitales", "description": "Europe", "front_label": "Pays", "back_label": "Capitale",
            "items": [{"front": "France", "back": "Paris"}, {"front": "Italie", "back": "Rome"},
                      {"front": "Espagne", "back": "Madrid"}, {"front": "", "back": "x"}],
        })
        self.assertEqual(r.status_code, 201)
        lid = r.json["id"]

        # Bob voit et lit la liste, mais ne peut ni la modifier ni la supprimer
        lists = bob.get("/api/lists").json["lists"]
        self.assertEqual(len(lists), 1)
        self.assertEqual(lists[0]["item_count"], 3)
        self.assertEqual(lists[0]["preview"][0], {"front": "France", "back": "Paris"})
        self.assertEqual(len(bob.get("/api/lists?q=capitale").json["lists"]), 1)
        self.assertEqual(len(bob.get("/api/lists?mine=1").json["lists"]), 0)
        got = bob.get(f"/api/lists/{lid}").json["list"]
        self.assertEqual((got["front_label"], got["back_label"], len(got["items"])), ("Pays", "Capitale", 3))
        self.assertEqual(bob.put(f"/api/lists/{lid}", headers=H, json={"title": "x", "items": [{"front": "a", "back": "b"}]}).status_code, 403)
        self.assertEqual(bob.delete(f"/api/lists/{lid}", headers=H).status_code, 403)

        # Bob s'entraîne → historique
        r = bob.post("/api/trainings", headers=H, json={
            "list_id": lid, "mode": "typing", "direction": "front_back",
            "item_count": 3, "first_try": 1, "attempts": 5, "duration_sec": 42})
        self.assertEqual(r.status_code, 201)
        self.assertEqual(bob.post("/api/trainings", headers=H, json={
            "list_id": lid, "mode": "typing", "direction": "fr_en"}).status_code, 400)
        h = bob.get("/api/me/history").json
        self.assertEqual(h["stats"]["sessions"], 1)
        self.assertEqual(h["stats"]["items"], 3)
        self.assertEqual(h["history"][0]["front_label"], "Pays")

        # Alice modifie puis supprime : l'historique de Bob reste
        self.assertEqual(alice.put(f"/api/lists/{lid}", headers=H, json={"title": "Capitales 2", "items": [{"front": "a", "back": "b"}]}).status_code, 200)
        self.assertEqual(alice.get(f"/api/lists/{lid}").json["list"]["front_label"], "Question")
        self.assertEqual(alice.delete(f"/api/lists/{lid}", headers=H).status_code, 200)
        h = bob.get("/api/me/history").json["history"]
        self.assertEqual(len(h), 1)
        self.assertIsNone(h[0]["list_id"])

        # Déconnexion
        bob.post("/api/logout", json={}, headers=H)
        self.assertEqual(bob.get("/api/lists").status_code, 401)

    def test_migration_from_v0(self):
        # Base de la première version (vocabulaire FR/EN)
        path = os.path.join(tempfile.mkdtemp(), "old.db")
        conn = sqlite3.connect(path)
        conn.executescript("""
          CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password_hash TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
          CREATE TABLE lists (id INTEGER PRIMARY KEY, owner_id INTEGER, title TEXT, description TEXT DEFAULT '',
                              created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
          CREATE TABLE words (id INTEGER PRIMARY KEY, list_id INTEGER, french TEXT, english TEXT, position INTEGER);
          CREATE TABLE trainings (id INTEGER PRIMARY KEY, user_id INTEGER, list_id INTEGER, list_title TEXT, mode TEXT,
                                  direction TEXT CHECK (direction IN ('fr_en', 'en_fr', 'mixed')), word_count INTEGER,
                                  first_try INTEGER, attempts INTEGER, duration_sec INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
          CREATE INDEX idx_words_list ON words(list_id);
          INSERT INTO users (id, username, password_hash) VALUES (1, 'old', 'x');
          INSERT INTO lists (id, owner_id, title) VALUES (1, 1, 'Animaux');
          INSERT INTO words (list_id, french, english, position) VALUES (1, 'chat', 'cat', 0);
          INSERT INTO trainings (user_id, list_id, list_title, mode, direction, word_count, first_try, attempts, duration_sec)
            VALUES (1, 1, 'Animaux', 'cards', 'en_fr', 1, 1, 1, 3);
        """)
        conn.close()
        old_path, app_module.DB_PATH = app_module.DB_PATH, path
        try:
            app_module.init_db()
            app_module.init_db()  # idempotent
        finally:
            app_module.DB_PATH = old_path
        conn = sqlite3.connect(path)
        self.assertEqual(conn.execute("SELECT front, back FROM items").fetchone(), ("chat", "cat"))
        self.assertEqual(conn.execute("SELECT front_label, back_label FROM lists").fetchone(), ("Français", "Anglais"))
        self.assertEqual(conn.execute("SELECT direction FROM trainings").fetchone(), ("back_front",))
        conn.close()

    def test_frontend_served(self):
        c = app.test_client()
        self.assertEqual(c.get("/api/unknown").status_code, 404)
        if (FRONTEND / "index.html").is_file():
            # Les routes React (/listes/3, /profil…) renvoient toutes index.html
            for path in ("/", "/profil", "/listes/3"):
                r = c.get(path)
                self.assertIn(b'id="root"', r.data)
                r.close()


if __name__ == "__main__":
    unittest.main()
