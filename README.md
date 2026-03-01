# GramSaarthi Full-Stack App (React + Python)

Production-ready starter for:
- React frontend (Vite)
- Python FastAPI backend
- Environment-based configuration for local + AWS EC2 deployment

## Architecture
- Frontend calls backend APIs using `VITE_API_BASE_URL`
- Backend serves API endpoints and handles CORS using environment variables
- For EC2 public hosting:
  - Nginx serves frontend static files
  - Nginx reverse proxies `/api` to FastAPI (Uvicorn)
  - Systemd keeps backend process running

## 1) Local Development

### Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

App:
- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- Health: http://localhost:8000/api/health

## 2) Build for Production

### Frontend build
```bash
cd frontend
npm install
cp .env.example .env
# Production uses frontend/.env.production with VITE_API_BASE_URL=/api
npm run build
```

### Backend run (production)
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Update ALLOWED_ORIGINS for your public domain/IP
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## 3) AWS EC2 Linux Deployment

### A. Install dependencies
```bash
sudo dnf update -y
sudo dnf install -y python3 python3-pip nginx nodejs npm git
sudo systemctl enable --now nginx
```

### B. Backend setup
```bash
cd /home/ec2-user/GramSaarthi/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env`:
- `APP_NAME=GramSaarthi API`
- `API_V1_PREFIX=/api`
- `ALLOWED_ORIGINS=https://your-domain.com,http://your-ec2-public-ip`

### C. Frontend setup
```bash
cd /home/ec2-user/GramSaarthi/frontend
npm install
cp .env.example .env
```

Edit `frontend/.env`:
- `VITE_API_BASE_URL=/api`

Build frontend:
```bash
npm run build
```

### D. Configure systemd for backend
```bash
sudo cp /home/ec2-user/GramSaarthi/deploy/gramsaarthi-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable gramsaarthi-backend
sudo systemctl start gramsaarthi-backend
sudo systemctl status gramsaarthi-backend
```

### E. Configure nginx
```bash
sudo cp /home/ec2-user/GramSaarthi/deploy/nginx-gramsaarthi.conf /etc/nginx/conf.d/gramsaarthi.conf
sudo nginx -t
sudo systemctl restart nginx
```

Now your app is public at your EC2 public IP/domain.

## 4) Environment Variables

### Backend (`backend/.env`)
- `APP_NAME` API title
- `API_V1_PREFIX` API prefix (default `/api`)
- `ALLOWED_ORIGINS` comma-separated list of frontend origins

### Frontend (`frontend/.env`)
- `VITE_API_BASE_URL` API base URL. Recommended: `/api` (works locally via Vite proxy and in prod via Nginx).

## 5) Useful Checks

```bash
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:8000/api/branding
```

## 6) Security/Next Steps
- Add HTTPS using Certbot + Let's Encrypt
- Restrict AWS security group ports (80/443 public, SSH limited)
- Add structured logging and monitoring

## 6.1) Configure AWS Bedrock Nova Chatbot Backend

The backend now exposes a streaming chatbot endpoint:
- `POST /api/chat/stream` (SSE response)

### A. Enable Bedrock model access
1. In AWS Console, open **Amazon Bedrock** in your target region (for example `ap-south-1`).
2. Go to **Model access** and request access to a Nova model:
   - `amazon.nova-lite-v1:0` (default in this repo), or another Nova model.
3. Wait until access is approved in that region.

### B. Set backend environment variables
Update `backend/.env`:
- `AWS_REGION=ap-south-1`
- `BEDROCK_NOVA_MODEL_ID=amazon.nova-lite-v1:0`
- `BEDROCK_INFERENCE_PROFILE_ID=<inference-profile-id-or-arn>`
- `BEDROCK_MAX_TOKENS=512`
- `BEDROCK_TEMPERATURE=0.2`

Important:
- If Bedrock returns `on-demand throughput isn’t supported`, you must use an inference profile.
- In that case, keep `BEDROCK_NOVA_MODEL_ID` as fallback and set `BEDROCK_INFERENCE_PROFILE_ID` to the exact profile ID/ARN from Bedrock Console.

### C. Attach IAM permissions to the backend runtime role/user
The backend identity (EC2 instance profile or IAM user) needs:
- `bedrock:InvokeModel`
- `bedrock:InvokeModelWithResponseStream`

Resource can be restricted to the selected Nova model ARN in your region.
If using inference profile, allow the corresponding profile resource as well.

### D. Verify credentials on server
Use one of:
- EC2 Instance Profile (recommended for EC2 deployment)
- `~/.aws/credentials`
- environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, optional `AWS_SESSION_TOKEN`)

### E. Restart backend and test
```bash
sudo systemctl restart gramsaarthi-backend
curl -N -X POST http://127.0.0.1:8000/api/chat/stream \\
  -H \"Content-Type: application/json\" \\
  -d '{
    "role":"Rural User",
    "name":"Test User",
    "message":"Tell me one scheme update summary.",
    "history":[]
  }'
```
You should receive `data: {...}` streaming chunks.

## 7) GitHub Actions CI/CD to EC2 (Auto Deploy on `main`)

This repo includes:
- GitHub workflow: `.github/workflows/ci-cd.yml`
- Server deploy script: `scripts/remote_deploy.sh`

Flow:
1. Push to `main`
2. GitHub Actions runs CI (backend dependency install + Python syntax check + frontend build)
3. If CI passes, GitHub Actions SSHes into EC2
4. EC2 runs `scripts/remote_deploy.sh` to pull latest code and restart services

### A. One-time EC2 setup

Run on EC2 as `ec2-user`:
```bash
sudo dnf update -y
sudo dnf install -y python3 python3-pip nginx nodejs npm git
sudo systemctl enable --now nginx
```

Clone your repo:
```bash
cd /home/ec2-user
git clone <your-repo-url> GramSaarthi
cd GramSaarthi
```

Create env files:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit values:
- `backend/.env`: `ALLOWED_ORIGINS=http://<EC2_PUBLIC_IP>,https://<YOUR_DOMAIN>`
- `frontend/.env`: `VITE_API_BASE_URL=/api`

Run first deploy once:
```bash
./scripts/remote_deploy.sh
```

### B. Allow passwordless sudo for deployment commands

GitHub SSH session is non-interactive. Add sudoers rule:
```bash
sudo visudo -f /etc/sudoers.d/gramsaarthi-deploy
```

Paste:
```text
ec2-user ALL=(ALL) NOPASSWD: /bin/cp, /bin/ln, /usr/bin/systemctl, /usr/sbin/nginx
```

### C. Configure SSH access for GitHub Actions

1. Generate a dedicated key pair on your local machine:
```bash
ssh-keygen -t ed25519 -C "gha-ec2-deploy" -f gha-ec2-deploy
```
2. Add public key to EC2:
```bash
cat gha-ec2-deploy.pub
```
Append that output to `/home/ec2-user/.ssh/authorized_keys` on EC2.

3. In GitHub repo, add these **Actions secrets**:
- `EC2_HOST` = your EC2 public IP or DNS
- `EC2_USER` = `ec2-user`
- `EC2_PORT` = `22`
- `EC2_SSH_KEY` = contents of private key file `gha-ec2-deploy`

### D. GitHub repo settings

- Ensure default branch is `main`
- Optionally enable branch protection on `main` requiring workflow success

### E. Deploy trigger

Push any commit to `main`:
```bash
git add .
git commit -m "Setup CI/CD"
git push origin main
```

Then check: GitHub -> `Actions` tab -> `CI-CD` workflow.

### F. Validate on EC2

```bash
sudo systemctl status gramsaarthi-backend
curl http://127.0.0.1:8000/api/health
curl http://<EC2_PUBLIC_IP>/api/health
```
