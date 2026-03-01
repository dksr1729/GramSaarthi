#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/home/ec2-user/GramSaarthi}"
BRANCH="${BRANCH:-main}"

if [[ ! -d "$PROJECT_DIR/.git" ]]; then
  echo "Repository not found at $PROJECT_DIR"
  exit 1
fi

cd "$PROJECT_DIR"

echo "[1/6] Sync source from origin/$BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "[2/6] Backend dependencies"
cd "$PROJECT_DIR/backend"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp -n .env.example .env || true


echo "[3/6] Frontend build"
cd "$PROJECT_DIR/frontend"
npm install
cp -n .env.example .env || true
npm run build


echo "[4/6] Install service + nginx configs"
cd "$PROJECT_DIR"
sudo cp deploy/gramsaarthi-backend.service /etc/systemd/system/gramsaarthi-backend.service
sudo cp deploy/nginx-gramsaarthi.conf /etc/nginx/conf.d/gramsaarthi.conf


echo "[5/6] Restart services"
sudo systemctl daemon-reload
sudo systemctl enable gramsaarthi-backend
sudo systemctl restart gramsaarthi-backend
sudo nginx -t
sudo systemctl reload nginx

echo "[6/6] Deployment complete"
