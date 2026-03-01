# Basic Users CRUD App

Minimal full-stack CRUD application:

- React frontend (`frontend/`)
- Python FastAPI backend (`backend/`)

No auth, tokens, or extra features.

## Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

Frontend proxies `/api` to backend at `http://localhost:8000`.

## CRUD Endpoints

- `GET /api/users`
- `POST /api/users`
- `GET /api/users/{user_id}`
- `PUT /api/users/{user_id}`
- `DELETE /api/users/{user_id}`
- `GET /api/health`
