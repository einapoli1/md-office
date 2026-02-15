#!/bin/bash

# MD Office Collaboration Server Runner
# Starts the Hocuspocus real-time collaboration server

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting MD Office Collaboration Server...${NC}"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed or not in PATH${NC}"
    exit 1
fi

# Navigate to collab-server directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COLLAB_DIR="$SCRIPT_DIR/collab-server"

if [ ! -d "$COLLAB_DIR" ]; then
    echo -e "${RED}❌ Collaboration server directory not found: $COLLAB_DIR${NC}"
    exit 1
fi

cd "$COLLAB_DIR"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

# Set environment variables
export COLLABORATION_PORT=${COLLABORATION_PORT:-1234}
export BACKEND_URL=${BACKEND_URL:-http://localhost:8080}
export WORKSPACE_PATH=${WORKSPACE_PATH:-../workspace}

echo -e "${GREEN}🔧 Configuration:${NC}"
echo -e "  Port: ${COLLABORATION_PORT}"
echo -e "  Backend URL: ${BACKEND_URL}"
echo -e "  Workspace: ${WORKSPACE_PATH}"
echo ""

# Start the server
echo -e "${GREEN}▶️  Starting Hocuspocus server...${NC}"
node server.js