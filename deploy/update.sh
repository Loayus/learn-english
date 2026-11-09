#!/bin/bash
# Met à jour le site sur PythonAnywhere avec la dernière version de la branche `deploy`.
# Usage (console Bash PythonAnywhere) : bash ~/learn-english/deploy/update.sh
set -euo pipefail

cd "$(dirname "$0")/.."

# La branche deploy est republiée à chaque push : on s'aligne dessus.
# Les fichiers ignorés par git (backend/data.db, la base) ne sont pas touchés.
git fetch origin deploy
git reset --hard origin/deploy

# Dépendances Python (rapide si rien n'a changé)
"$HOME/.virtualenvs/revise/bin/pip" install -q -r requirements.txt

# Toucher le fichier WSGI recharge l'application web
touch "/var/www/${USER}_pythonanywhere_com_wsgi.py"
echo "Site mis à jour : https://${USER}.pythonanywhere.com ($(git log -1 --format=%s))"
