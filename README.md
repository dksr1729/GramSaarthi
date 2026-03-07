# GramSaarthi - Vision AI for Bharat

AI-powered decision-support system for Gram Panchayats in India. Built with FastAPI backend and React frontend, featuring persona-based access control and ChromaDB for vector search.

## Features

- **Persona-Based Access Control**: District Admin, Panchayat Officer, and Rural User roles
- **Location Hierarchy**: State → District → Mandal → Village selection
- **AI-Powered Chatbot**: Query government schemes and get recommendations
- **Dashboard**: Rainfall data and district statistics
- **Schemes Database**: Search and browse government schemes
- **Report Generation**: Generate administrative reports
- **File Ingestion**: Upload and process data files (District Admin only)
- **Indian-Themed UI**: Bright, accessible design with saffron and green colors

## Tech Stack

### Backend
- Python 3.11+
- FastAPI
- DynamoDB (AWS or Local)
- ChromaDB (Vector Store)
- Amazon Bedrock (AI)
- JWT Authentication

### Frontend
- React 18
- Material-UI
- Vite
- Zustand (State Management)
- Recharts (Data Visualization)

## Prerequisites

- Python 3.11 or higher
- Node.js 18 or higher
- DynamoDB Local (for development)
- AWS Account (for production)

## Quick Start

### 1. Clone and Setup

```bash
# Make setup script executable
chmod +x setup.sh

# Run setup script
./setup.sh
```

### 2. Start DynamoDB Local

**Option A: Using Docker**
```bash
docker run -p 8000:8000 amazon/dynamodb-local
```

**Option B: Download and Run**
```bash
# Download DynamoDB Local
wget https://s3.ap-south-1.amazonaws.com/dynamodb-local-mumbai/dynamodb_local_latest.tar.gz
tar -xzf dynamodb_local_latest.tar.gz

# Run DynamoDB Local
java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar -sharedDb -port 8000
```

### 3. Initialize Database

```bash
cd backend
source venv/bin/activate

# Create DynamoDB tables
python setup_dynamodb.py

# Seed initial data (government schemes)
python seed_data.py
```

### 4. Start Backend

```bash
cd backend
source venv/bin/activate
python main.py
```

Backend will run at: `http://localhost:8000`
API docs: `http://localhost:8000/docs`

### 5. Start Frontend

```bash
cd frontend
npm run dev
```

Frontend will run at: `http://localhost:5173`

## Project Structure

```
gramsaarthi/
├── backend/
│   ├── main.py                 # FastAPI application
│   ├── config.py              # Configuration
│   ├── models.py              # Pydantic models
│   ├── database.py            # DynamoDB client
│   ├── vector_store.py        # ChromaDB integration
│   ├── auth.py                # Authentication utilities
│   ├── services/              # Business logic
│   │   ├── auth_service.py
│   │   ├── location_service.py
│   │   └── rag_service.py
│   ├── setup_dynamodb.py      # Database setup
│   ├── seed_data.py           # Data seeding
│   ├── requirements.txt       # Python dependencies
│   └── chroma_db/             # ChromaDB storage
├── frontend/
│   ├── src/
│   │   ├── pages/             # React pages
│   │   ├── components/        # React components
│   │   ├── store/             # Zustand stores
│   │   ├── api/               # API client
│   │   └── main.jsx           # Entry point
│   ├── package.json
│   └── vite.config.js
├── resources/
│   └── telangana_all_villages.json  # Location data
└── README.md
```

## User Personas

### District Admin
- Access to all district data
- Can upload and ingest files
- Pages: Dashboard, Reports, Schemes, Ingest

### Panchayat Officer
- Access to mandal and village data
- Pages: Dashboard, Reports, Schemes

### Rural User
- Access to village data only
- Pages: Dashboard, Reports

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Locations
- `GET /api/locations/states` - Get states
- `GET /api/locations/districts/{state}` - Get districts
- `GET /api/locations/mandals/{state}/{district}` - Get mandals
- `GET /api/locations/villages/{state}/{district}/{mandal}` - Get villages

### Features
- `POST /api/query` - Chatbot query
- `GET /api/reports` - List reports
- `POST /api/reports/generate` - Generate report
- `GET /api/dashboard/rainfall` - Rainfall data
- `GET /api/dashboard/district` - District statistics
- `GET /api/schemes` - Get schemes
- `POST /api/ingest` - Upload files (District Admin only)

## Configuration

### Backend (.env)
```env
# Application
SECRET_KEY=your-secret-key
JWT_EXPIRATION_HOURS=24

# AWS
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret

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
```env
VITE_API_URL=http://localhost:8000
```

## Development

### Backend Development
```bash
cd backend
source venv/bin/activate

# Run with auto-reload
python main.py

# Or using uvicorn
uvicorn main:app --reload
```

### Frontend Development
```bash
cd frontend
npm run dev
```

### Testing
```bash
cd backend
pytest
```

## Deployment

### Backend (EC2)
1. Launch EC2 instance (Ubuntu 22.04)
2. Install dependencies
3. Configure Nginx as reverse proxy
4. Set up SSL with Let's Encrypt
5. Use systemd for process management

### Frontend (S3 + CloudFront)
1. Build: `npm run build`
2. Upload to S3 bucket
3. Configure CloudFront distribution
4. Set up custom domain

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
