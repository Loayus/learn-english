"""Tests de l'API : python -m unittest discover backend"""
import os
import tempfile
import unittest

os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["SECRET_KEY"] = "test"

from app import app  # noqa: E402

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
            "title": "Animaux", "description": "Basique",
            "words": [{"french": "chat", "english": "cat"}, {"french": "chien", "english": "dog"}, {"french": "", "english": "x"}],
        })
        self.assertEqual(r.status_code, 201)
        lid = r.json["id"]

        # Bob voit et lit la liste, mais ne peut ni la modifier ni la supprimer
        self.assertEqual(len(bob.get("/api/lists").json["lists"]), 1)
        self.assertEqual(len(bob.get("/api/lists?mine=1").json["lists"]), 0)
        self.assertEqual(len(bob.get(f"/api/lists/{lid}").json["list"]["words"]), 2)
        self.assertEqual(bob.put(f"/api/lists/{lid}", headers=H, json={"title": "x", "words": [{"french": "a", "english": "b"}]}).status_code, 403)
        self.assertEqual(bob.delete(f"/api/lists/{lid}", headers=H).status_code, 403)

        # Bob s'entraîne → historique
        r = bob.post("/api/trainings", headers=H, json={
            "list_id": lid, "mode": "typing", "direction": "fr_en",
            "word_count": 2, "first_try": 1, "attempts": 3, "duration_sec": 42})
        self.assertEqual(r.status_code, 201)
        h = bob.get("/api/me/history").json
        self.assertEqual(h["stats"]["sessions"], 1)
        self.assertEqual(h["history"][0]["list_title"], "Animaux")

        # Alice modifie puis supprime : l'historique de Bob reste
        self.assertEqual(alice.put(f"/api/lists/{lid}", headers=H, json={"title": "Animaux 2", "words": [{"french": "oiseau", "english": "bird"}]}).status_code, 200)
        self.assertEqual(alice.delete(f"/api/lists/{lid}", headers=H).status_code, 200)
        h = bob.get("/api/me/history").json["history"]
        self.assertEqual(len(h), 1)
        self.assertIsNone(h[0]["list_id"])

        # Déconnexion
        bob.post("/api/logout", json={}, headers=H)
        self.assertEqual(bob.get("/api/lists").status_code, 401)

    def test_frontend_served(self):
        c = app.test_client()
        self.assertIn(b"Learn English", c.get("/").data)
        self.assertIn(b"Learn English", c.get("/profile").data)
        self.assertEqual(c.get("/api/unknown").status_code, 404)


if __name__ == "__main__":
    unittest.main()
