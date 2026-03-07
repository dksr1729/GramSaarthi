#!/bin/bash

echo "========================================="
echo "GramSaarthi Requirements Check"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ALL_GOOD=true

# Check Python
echo -n "Checking Python 3.11+... "
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
    PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)
    
    if [ "$PYTHON_MAJOR" -ge 3 ] && [ "$PYTHON_MINOR" -ge 11 ]; then
        echo -e "${GREEN}✓ Python $PYTHON_VERSION${NC}"
    else
        echo -e "${RED}✗ Python $PYTHON_VERSION (need 3.11+)${NC}"
        ALL_GOOD=false
    fi
else
    echo -e "${RED}✗ Not installed${NC}"
    ALL_GOOD=false
fi

# Check Node.js
echo -n "Checking Node.js 18+... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)
    
    if [ "$NODE_MAJOR" -ge 18 ]; then
        echo -e "${GREEN}✓ Node.js $NODE_VERSION${NC}"
    else
        echo -e "${RED}✗ Node.js $NODE_VERSION (need 18+)${NC}"
        ALL_GOOD=false
    fi
else
    echo -e "${RED}✗ Not installed${NC}"
    ALL_GOOD=false
fi

# Check npm
echo -n "Checking npm... "
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓ npm $NPM_VERSION${NC}"
else
    echo -e "${RED}✗ Not installed${NC}"
    ALL_GOOD=false
fi

# Check Java
echo -n "Checking Java 8+... "
if command -v java &> /dev/null; then
    JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2)
    echo -e "${GREEN}✓ Java $JAVA_VERSION${NC}"
else
    echo -e "${YELLOW}⚠ Not installed (needed for DynamoDB Local)${NC}"
    echo "  You can use Docker instead: docker run -p 8000:8000 amazon/dynamodb-local"
fi

# Check Docker (optional)
echo -n "Checking Docker (optional)... "
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
    echo -e "${GREEN}✓ Docker $DOCKER_VERSION${NC}"
else
    echo -e "${YELLOW}⚠ Not installed (optional, alternative to Java for DynamoDB)${NC}"
fi

# Check Git
echo -n "Checking Git... "
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version | cut -d' ' -f3)
    echo -e "${GREEN}✓ Git $GIT_VERSION${NC}"
else
    echo -e "${YELLOW}⚠ Not installed (recommended)${NC}"
fi

echo ""
echo "========================================="

if [ "$ALL_GOOD" = true ]; then
    echo -e "${GREEN}✓ All required dependencies are installed!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Run: ./setup.sh"
    echo "  2. Start DynamoDB Local"
    echo "  3. Run: cd backend && python setup_dynamodb.py"
    echo "  4. Run: cd backend && python seed_data.py"
    echo "  5. Run: ./start.sh"
else
    echo -e "${RED}✗ Some required dependencies are missing${NC}"
    echo ""
    echo "Installation instructions:"
    echo ""
    echo "Python 3.11+:"
    echo "  macOS: brew install python@3.11"
    echo "  Ubuntu: sudo apt install python3.11"
    echo ""
    echo "Node.js 18+:"
    echo "  macOS: brew install node"
    echo "  Ubuntu: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    echo "          sudo apt-get install -y nodejs"
    echo ""
    echo "Java 8+ (for DynamoDB Local):"
    echo "  macOS: brew install openjdk"
    echo "  Ubuntu: sudo apt install default-jdk"
    echo ""
    echo "Or use Docker for DynamoDB Local:"
    echo "  docker run -p 8000:8000 amazon/dynamodb-local"
fi

echo "========================================="
