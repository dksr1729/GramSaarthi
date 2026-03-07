# GramSaarthi Installation Guide

Complete step-by-step installation guide for GramSaarthi.

## Prerequisites

### Required Software

1. **Python 3.11+**
   ```bash
   python3 --version
   ```

2. **Node.js 18+**
   ```bash
   node --version
   npm --version
   ```

3. **Java 8+ (for DynamoDB Local)**
   ```bash
   java -version
   ```

4. **Git**
   ```bash
   git --version
   ```

## Installation Steps

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd gramsaarthi
```

### Step 2: Run Setup Script

```bash
chmod +x setup.sh
./setup.sh
```

This will:
- Create Python virtual environment
- Install Python dependencies
- Install Node.js dependencies
- Create configuration files

### Step 3: Configure Environment

#### Backend Configuration

Edit `backend/.env`:

```env
# For local development, use these settings:
SECRET_KEY=dev-secret-key-change-in-production
AWS_REGION=ap-south-1

# Leave AWS credentials empty for local DynamoDB
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# DynamoDB tables (local)
DYNAMODB_USERS_TABLE=gramsaarthi-users-dev
DYNAMODB_FORECASTS_TABLE=gramsaarthi-forecasts-dev
DYNAMODB_SCHEMES_TABLE=gramsaarthi-schemes-dev
DYNAMODB_REPORTS_TABLE=gramsaarthi-reports-dev
DYNAMODB_CHAT_SESSIONS_TABLE=gramsaarthi-chat-sessions-dev

# ChromaDB (local)
CHROMA_PERSIST_DIRECTORY=./chroma_db
CHROMA_COLLECTION_NAME=schemes

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

#### Frontend Configuration

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
```

### Step 4: Start DynamoDB Local

**Option A: Using Docker (Recommended)**

```bash
docker run -d -p 8000:8000 --name dynamodb-local amazon/dynamodb-local
```

**Option B: Download and Run**

```bash
# Download
wget https://s3.ap-south-1.amazonaws.com/dynamodb-local-mumbai/dynamodb_local_latest.tar.gz
tar -xzf dynamodb_local_latest.tar.gz

# Run in a separate terminal
java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar -sharedDb -port 8000
```

### Step 5: Initialize Database

```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Create tables
python setup_dynamodb.py

# Seed data
python seed_data.py
```

You should see:
```
Created table: gramsaarthi-users-dev
Created table: gramsaarthi-forecasts-dev
Created table: gramsaarthi-schemes-dev
Created table: gramsaarthi-reports-dev
Created table: gramsaarthi-chat-sessions-dev
DynamoDB tables setup complete!

Added scheme: Pradhan Mantri Awas Yojana - Gramin (PMAY-G)
Added scheme: Mahatma Gandhi National Rural Employment Guarantee Act (MGNREGA)
...
Data seeding completed successfully!
```

### Step 6: Start Backend Server

```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
python main.py
```

Backend will start at: `http://localhost:8000`

Verify by visiting: `http://localhost:8000/docs` (Swagger UI)

### Step 7: Start Frontend Server

Open a new terminal:

```bash
cd frontend
npm run dev
```

Frontend will start at: `http://localhost:5173`

## Verification

### 1. Check Backend Health

```bash
curl http://localhost:8000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "environment": "development"
}
```

### 2. Check Frontend

Open browser: `http://localhost:5173`

You should see the GramSaarthi login page with Indian-themed colors.

### 3. Test Registration

1. Click "Register here"
2. Fill in the form:
   - Name: Test User
   - Email: test@example.com
   - Password: test123
   - Persona: Rural User
   - State: telangana
   - District: Select any district
   - Mandal: Select any mandal
   - Village: Select any village
3. Click "Register"
4. You should be redirected to the Dashboard

### 4. Test Schemes

1. Navigate to "Schemes" from the sidebar
2. You should see 10 government schemes
3. Try searching for "water" or "housing"

## Troubleshooting

### Backend Issues

**Issue: ModuleNotFoundError**
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

**Issue: DynamoDB connection error**
- Ensure DynamoDB Local is running on port 8000
- Check if port 8000 is already in use: `lsof -i :8000`

**Issue: ChromaDB error**
```bash
cd backend
rm -rf chroma_db
mkdir chroma_db
python seed_data.py
```

### Frontend Issues

**Issue: Module not found**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

**Issue: API connection error**
- Check if backend is running on port 8000
- Verify `VITE_API_URL` in `frontend/.env`

**Issue: CORS error**
- Check `CORS_ORIGINS` in `backend/.env`
- Ensure it includes `http://localhost:5173`

### Database Issues

**Issue: Table already exists**
- This is normal if you've run setup before
- Tables are reused

**Issue: No schemes showing**
```bash
cd backend
source venv/bin/activate
python seed_data.py
```

## Next Steps

1. **Explore the Application**
   - Try different personas (District Admin, Panchayat Officer, Rural User)
   - Test the chatbot on Reports page
   - Upload files as District Admin

2. **Customize**
   - Add more schemes in `backend/seed_data.py`
   - Modify UI colors in `frontend/src/main.jsx`
   - Add more location data in `resources/telangana_all_villages.json`

3. **Deploy to Production**
   - See deployment guide in README.md
   - Configure AWS credentials
   - Set up production DynamoDB tables
   - Deploy frontend to S3 + CloudFront
   - Deploy backend to EC2

## Support

If you encounter issues:
1. Check logs in terminal
2. Verify all prerequisites are installed
3. Ensure all services are running
4. Check configuration files

For more help, refer to README.md or open an issue.
