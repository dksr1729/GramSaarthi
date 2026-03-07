# GramSaarthi Quick Start Guide

Get GramSaarthi up and running in 5 minutes!

## Prerequisites Check

```bash
# Check Python (need 3.11+)
python3 --version

# Check Node.js (need 18+)
node --version

# Check Java (need 8+, for DynamoDB Local)
java -version
```

## Installation (One-Time Setup)

### 1. Run Setup Script

```bash
./setup.sh
```

This installs all dependencies and creates configuration files.

### 2. Start DynamoDB Local

**Using Docker (Easiest):**
```bash
docker run -d -p 8000:8000 --name dynamodb-local amazon/dynamodb-local
```

**Without Docker:**
```bash
# Download once
wget https://s3.ap-south-1.amazonaws.com/dynamodb-local-mumbai/dynamodb_local_latest.tar.gz
tar -xzf dynamodb_local_latest.tar.gz

# Run (keep this terminal open)
java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar -sharedDb -port 8000
```

### 3. Initialize Database

```bash
cd backend
source venv/bin/activate
python setup_dynamodb.py
python seed_data.py
cd ..
```

## Running the Application

### Option A: Use Start Script (Recommended)

```bash
./start.sh
```

This starts both backend and frontend automatically.

### Option B: Manual Start

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
python main.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## Access the Application

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

## First Time Usage

### 1. Register a User

1. Open http://localhost:5173
2. Click "Register here"
3. Fill in the form:
   - **Name:** Your Name
   - **Email:** your@email.com
   - **Password:** password123
   - **Persona:** Choose one:
     - **District Admin** - Full access (4 pages)
     - **Panchayat Officer** - Mandal access (3 pages)
     - **Rural User** - Village access (2 pages)
   - **Location:** Select State → District → Mandal → Village
4. Click "Register"

### 2. Explore Features

**Dashboard:**
- View district statistics
- See rainfall data charts

**Reports:**
- Chat with AI assistant
- Ask questions about schemes
- View generated reports

**Schemes:**
- Browse 10 government schemes
- Search by keyword
- View eligibility and application process

**Ingest (District Admin only):**
- Upload CSV, PDF, Excel files
- Process data for analysis

## Test Credentials

After registration, you can create multiple users with different personas to test access control.

## Common Commands

```bash
# Stop all services
Ctrl+C (in terminal running start.sh)

# Restart backend only
cd backend && source venv/bin/activate && python main.py

# Restart frontend only
cd frontend && npm run dev

# Reset database
cd backend && source venv/bin/activate
python setup_dynamodb.py
python seed_data.py

# View logs
# Backend logs appear in terminal
# Frontend logs appear in browser console
```

## Troubleshooting

**Port already in use:**
```bash
# Check what's using port 8000
lsof -i :8000

# Kill process
kill -9 <PID>
```

**Module not found:**
```bash
# Backend
cd backend && source venv/bin/activate && pip install -r requirements.txt

# Frontend
cd frontend && rm -rf node_modules && npm install
```

**DynamoDB connection error:**
- Ensure DynamoDB Local is running on port 8000
- Check with: `curl http://localhost:8000`

**CORS error:**
- Check `backend/.env` has `CORS_ORIGINS=http://localhost:5173`
- Restart backend after changing .env

## Next Steps

1. **Explore Different Personas:**
   - Register as District Admin, Panchayat Officer, and Rural User
   - Notice different page access for each persona

2. **Test Chatbot:**
   - Go to Reports page
   - Ask: "What schemes are available for water supply?"
   - Ask: "Tell me about housing schemes"

3. **Upload Files (District Admin):**
   - Go to Ingest page
   - Upload a CSV or PDF file
   - See processing status

4. **Customize:**
   - Add more schemes in `backend/seed_data.py`
   - Modify UI theme in `frontend/src/main.jsx`
   - Add location data in `resources/telangana_all_villages.json`

## Architecture Overview

```
┌─────────────┐
│   React     │  Port 5173
│  Frontend   │
└──────┬──────┘
       │ HTTP
       ▼
┌─────────────┐
│   FastAPI   │  Port 8000
│   Backend   │
└──────┬──────┘
       │
       ├─────► DynamoDB Local (Port 8000)
       │
       └─────► ChromaDB (Local Files)
```

## Support

- **Documentation:** See README.md and INSTALLATION.md
- **API Docs:** http://localhost:8000/docs
- **Issues:** Check logs in terminal

Happy coding! 🚀
