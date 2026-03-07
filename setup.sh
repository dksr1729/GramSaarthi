#!/bin/bash

echo "========================================="
echo "GramSaarthi Setup Script"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}Python 3 is not installed. Please install Python 3.11 or higher.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Python 3 found${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js is not installed. Please install Node.js 18 or higher.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js found${NC}"

# Backend setup
echo ""
echo "Setting up backend..."
cd backend

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install Python dependencies
echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo -e "${YELLOW}⚠ Please update .env file with your configuration${NC}"
fi

# Create chroma_db directory
mkdir -p chroma_db

echo -e "${GREEN}✓ Backend setup complete${NC}"

cd ..

# Frontend setup
echo ""
echo "Setting up frontend..."
cd frontend

# Install Node dependencies
echo "Installing Node dependencies..."
npm install

echo -e "${GREEN}✓ Frontend setup complete${NC}"

cd ..

echo ""
echo "========================================="
echo "Setup Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Configure AWS credentials (AWS CLI profile or backend/.env values)"
echo "2. Run: cd backend && source venv/bin/activate && python setup_dynamodb.py"
echo "3. Run: cd backend && source venv/bin/activate && python seed_data.py"
echo "4. Start backend: cd backend && source venv/bin/activate && python main.py"
echo "5. Start frontend: cd frontend && npm run dev"
echo ""
