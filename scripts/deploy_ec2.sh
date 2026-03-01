#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -eq 0 ]]; then
  echo "Run as ubuntu user, not root."
  exit 1
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[1/5] Backend setup"
cd "$PROJECT_DIR/backend"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp -n .env.example .env || true


echo "[2/5] Frontend setup"
cd "$PROJECT_DIR/frontend"
npm install
cp -n .env.example .env || true
npm run build


echo "[3/5] Install systemd unit"
sudo cp "$PROJECT_DIR/deploy/gramsaarthi-backend.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable gramsaarthi-backend
sudo systemctl restart gramsaarthi-backend


echo "[4/5] Install nginx config"
sudo cp "$PROJECT_DIR/deploy/nginx-gramsaarthi.conf" /etc/nginx/sites-available/gramsaarthi
sudo ln -sf /etc/nginx/sites-available/gramsaarthi /etc/nginx/sites-enabled/gramsaarthi
sudo nginx -t
sudo systemctl restart nginx


echo "[5/5] Done"
echo "Update backend/.env and frontend/.env, then rerun this script if needed."
