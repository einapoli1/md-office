#!/bin/bash

echo "Starting MD Office with Collaboration Support..."

# Kill any existing processes on the ports
pkill -f "md-office"
pkill -f "collaboration-server"

# Wait a bit for cleanup
sleep 1

# Start collaboration server in the background
echo "Starting collaboration server on port 1234..."
cd collaboration-server
WORKSPACE_PATH="../backend/workspace" node server.js &
COLLAB_PID=$!
cd ..

# Wait a bit for the collaboration server to start
sleep 2

# Start the main backend server
echo "Starting main server on port 8080..."
cd backend
WORKSPACE_PATH="./workspace" ./md-office &
BACKEND_PID=$!
cd ..

echo "Servers started!"
echo "- Collaboration server PID: $COLLAB_PID"
echo "- Backend server PID: $BACKEND_PID"
echo "- Main app: http://localhost:8080"
echo "- Collaboration WebSocket: ws://localhost:1234/collaboration"
echo ""
echo "To stop servers, run: kill $COLLAB_PID $BACKEND_PID"

# Wait for interrupt
trap 'kill $COLLAB_PID $BACKEND_PID; exit' INT
wait