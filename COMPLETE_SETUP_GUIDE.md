# GramSaarthi - Complete Setup Guide

## ✅ What Has Been Created

A complete full-stack application with:

### Backend (FastAPI + Python)
- ✅ FastAPI REST API server
- ✅ JWT authentication with bcrypt password hashing
- ✅ DynamoDB integration (local and AWS)
- ✅ ChromaDB vector store for RAG
- ✅ Persona-based access control (District Admin, Panchayat Officer, Rural User)
- ✅ Location hierarchy service (State → District → Mandal → Village)
- ✅ 10 pre-seeded government schemes
- ✅ All necessary services and utilities

### Frontend (React + Material-UI)
- ✅ Indian-themed UI (Saffron & Green colors)
- ✅ Login/Register pages with location selection
- ✅ Dashboard with rainfall charts
- ✅ Reports page with AI chatbot
- ✅ Schemes browser with search
- ✅ File ingest page (District Admin only)
- ✅ Responsive design

### Infrastructure
- ✅ Setup scripts
- ✅ Database initialization scripts
- ✅ Data seeding scripts
- ✅ Complete documentation

## 📋 Current Status

✅ All dependencies installed
✅ Project structure created
✅ Code implemented
⏳ Ready to initialize database and run

## 🚀 Next Steps to Run the Application

### Step 1: Start DynamoDB Local

Open a new terminal and run:

```bash
# Using Docker (Recommended)
docker run -p 8000:8000 amazon/dynamodb-local

# OR without Docker
java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar -sharedDb -port 8000
```

Keep this terminal running.

### Step 2: Initialize Database

Open a new terminal:

```bash
cd backend
source venv/bin/activate
python setup_dynamodb.py
python seed_data.py
```

You should see:
- ✅ Created 5 DynamoDB tables
- ✅ Added 10 government schemes

### Step 3: Start Backend

In the same terminal (or new one):

```bash
cd backend
source venv/bin/activate
python main.py
```

Backend will run at: **http://localhost:8000**

### Step 4: Start Frontend

Open another new terminal:

```bash
cd frontend
npm run dev
```

Frontend will run at: **http://localhost:5173**

### Step 5: Access the Application

Open your browser and go to: **http://localhost:5173**

## 👤 First Time Usage

### Register a User

1. Click "Register here"
2. Fill in the form:
   - **Name:** Your Name
   - **Email:** test@example.com
   - **Password:** password123
   - **Persona:** Choose one:
     - **District Admin** - Full access (4 pages: Dashboard, Reports, Schemes, Ingest)
     - **Panchayat Officer** - Mandal access (3 pages: Dashboard, Reports, Schemes)
     - **Rural User** - Village access (2 pages: Dashboard, Reports)
   - **Location:** 
     - State: telangana
     - District: Select any (e.g., Adilabad)
     - Mandal: Select any (e.g., Adilabad Rural)
     - Village: Select any (e.g., Ankapur)
3. Click "Register"
4. You'll be logged in automatically

### Explore Features

**Dashboard:**
- View district statistics
- See rainfall data (placeholder for now)

**Reports:**
- Chat with AI assistant (placeholder responses)
- Ask questions about schemes
- View generated reports

**Schemes:**
- Browse 10 government schemes
- Search by keyword
- View eligibility and application details

**Ingest (District Admin only):**
- Upload CSV, PDF, Excel files
- Process data for analysis

## 📁 Project Structure

```
GramSaarthi/
├── backend/
│   ├── main.py                 # FastAPI app
│   ├── config.py              # Configuration
│   ├── models.py              # Pydantic models
│   ├── database.py            # DynamoDB client
│   ├── vector_store.py        # ChromaDB
│   ├── auth.py                # Authentication
│   ├── services/              # Business logic
│   │   ├── auth_service.py
│   │   ├── location_service.py
│   │   └── rag_service.py
│   ├── setup_dynamodb.py      # DB setup
│   ├── seed_data.py           # Data seeding
│   ├── requirements.txt       # Dependencies
│   ├── .env                   # Configuration
│   └── chroma_db/             # Vector store data
├── frontend/
│   ├── src/
│   │   ├── pages/             # React pages
│   │   ├── components/        # Components
│   │   ├── store/             # State management
│   │   ├── api/               # API client
│   │   └── main.jsx           # Entry point
│   ├── package.json
│   └── vite.config.js
├── resources/
│   └── telangana_all_villages.json  # Location data
├── setup.sh                   # Setup script
├── start.sh                   # Start script
├── check_requirements.sh      # Requirements check
├── README.md                  # Main documentation
├── INSTALLATION.md            # Installation guide
├── QUICKSTART.md              # Quick start guide
└── COMPLETE_SETUP_GUIDE.md    # This file
```

## 🔧 Configuration

### Backend (.env)

Located at `backend/.env`:

```env
# Application
SECRET_KEY=dev-secret-key-change-in-production
JWT_EXPIRATION_HOURS=24

# AWS (leave empty for local DynamoDB)
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# DynamoDB Tables
DYNAMODB_USERS_TABLE=gramsaarthi-users-dev
DYNAMODB_FORECASTS_TABLE=gramsaarthi-forecasts-dev
DYNAMODB_SCHEMES_TABLE=gramsaarthi-schemes-dev
DYNAMODB_REPORTS_TABLE=gramsaarthi-reports-dev
DYNAMODB_CHAT_SESSIONS_TABLE=gramsaarthi-chat-sessions-dev

# ChromaDB
CHROMA_PERSIST_DIRECTORY=./chroma_db
CHROMA_COLLECTION_NAME=schemes

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Frontend (.env)

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
```

## 🧪 Testing the Application

### Test Authentication
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"gmail":"test@example.com","password":"password123"}'
```

### Test Health Check
```bash
curl http://localhost:8000/api/health
```

### Test Schemes API
```bash
curl http://localhost:8000/api/schemes \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 🐛 Troubleshooting

### Backend won't start
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

### Frontend won't start
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### DynamoDB connection error
- Ensure DynamoDB Local is running on port 8000
- Check: `curl http://localhost:8000`

### CORS error
- Check `backend/.env` has `CORS_ORIGINS=http://localhost:5173`
- Restart backend after changing .env

### Port already in use
```bash
# Find process using port 8000
lsof -i :8000

# Kill process
kill -9 <PID>
```

## 📚 API Documentation

Once backend is running, visit:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

## 🎯 Key Features Implemented

### Authentication & Authorization
- ✅ JWT-based authentication
- ✅ Bcrypt password hashing
- ✅ Persona-based access control
- ✅ Location-based data isolation

### Location Management
- ✅ Hierarchical location selection
- ✅ State → District → Mandal → Village
- ✅ Validation against telangana_all_villages.json
- ✅ Dynamic dropdown population

### Schemes Management
- ✅ 10 pre-seeded government schemes
- ✅ Vector search with ChromaDB
- ✅ Full-text search
- ✅ Category filtering
- ✅ Metadata display

### User Interface
- ✅ Indian-themed colors (Saffron & Green)
- ✅ Responsive design
- ✅ Material-UI components
- ✅ Persona-specific navigation
- ✅ Location display in navbar

## 🚀 Production Deployment

### Backend (EC2)
1. Launch EC2 instance
2. Install dependencies
3. Configure Nginx
4. Set up SSL
5. Use systemd for process management

### Frontend (S3 + CloudFront)
1. Build: `npm run build`
2. Upload to S3
3. Configure CloudFront
4. Set up custom domain

### Database (AWS DynamoDB)
1. Create tables in AWS
2. Update `.env` with AWS credentials
3. Run seed script

## 📞 Support

For issues:
1. Check logs in terminal
2. Verify all services are running
3. Check configuration files
4. Refer to README.md or INSTALLATION.md

## 🎉 Success!

You now have a fully functional GramSaarthi application with:
- ✅ Secure authentication
- ✅ Persona-based access control
- ✅ Location hierarchy management
- ✅ Government schemes database
- ✅ AI-powered chatbot (placeholder)
- ✅ Dashboard with visualizations
- ✅ File upload capability
- ✅ Indian-themed UI

Happy coding! 🚀
