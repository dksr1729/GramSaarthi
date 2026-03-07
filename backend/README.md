# GramSaarthi Backend

FastAPI backend for GramSaarthi - AI-powered decision-support system for Gram Panchayats.

## Prerequisites

- Python 3.11+
- DynamoDB Local (for development)
- AWS Account (for production)

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

Edit `.env` with your configuration.

### 3. Start DynamoDB Local (Development)

Download and run DynamoDB Local:

```bash
# Download DynamoDB Local
wget https://s3.ap-south-1.amazonaws.com/dynamodb-local-mumbai/dynamodb_local_latest.tar.gz
tar -xzf dynamodb_local_latest.tar.gz

# Run DynamoDB Local
java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar -sharedDb -port 8000
```

Or use Docker:

```bash
docker run -p 8000:8000 amazon/dynamodb-local
```

### 4. Create DynamoDB Tables

```bash
python setup_dynamodb.py
```

### 5. Seed Initial Data

```bash
python seed_data.py
```

### 6. Run the Application

```bash
# Development mode with auto-reload
python main.py

# Or using uvicorn directly
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

API documentation: `http://localhost:8000/docs`

## Project Structure

```
backend/
├── main.py                 # FastAPI application entry point
├── config.py              # Configuration settings
├── models.py              # Pydantic models
├── database.py            # DynamoDB client
├── vector_store.py        # ChromaDB vector store
├── auth.py                # Authentication utilities
├── services/              # Business logic services
│   ├── auth_service.py
│   ├── location_service.py
│   └── rag_service.py
├── setup_dynamodb.py      # DynamoDB table creation script
├── seed_data.py           # Data seeding script
└── requirements.txt       # Python dependencies
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user info

### Locations
- `GET /api/locations/states` - Get states
- `GET /api/locations/districts/{state}` - Get districts
- `GET /api/locations/mandals/{state}/{district}` - Get mandals
- `GET /api/locations/villages/{state}/{district}/{mandal}` - Get villages

### Query/Chatbot
- `POST /api/query` - Process user query

### Reports
- `GET /api/reports` - List reports
- `POST /api/reports/generate` - Generate report

### Dashboard
- `GET /api/dashboard/rainfall` - Get rainfall data
- `GET /api/dashboard/district` - Get district statistics

### Schemes
- `GET /api/schemes` - Get available schemes

### File Ingest (District Admin only)
- `POST /api/ingest` - Upload and ingest files

## Testing

```bash
# Run tests
pytest

# Run with coverage
pytest --cov=. --cov-report=html
```

## Deployment

### Production Setup

1. Update `.env` with production AWS credentials
2. Create DynamoDB tables in AWS
3. Deploy to EC2 instance
4. Configure Nginx as reverse proxy
5. Set up SSL with Let's Encrypt

### Using Systemd

Create `/etc/systemd/system/gramsaarthi.service`:

```ini
[Unit]
Description=GramSaarthi FastAPI Application
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/gramsaarthi/backend
Environment="PATH=/home/ubuntu/gramsaarthi/backend/venv/bin"
ExecStart=/home/ubuntu/gramsaarthi/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4

[Install]
WantedBy=multi-user.target
```

Start the service:

```bash
sudo systemctl start gramsaarthi
sudo systemctl enable gramsaarthi
```

## License

MIT
