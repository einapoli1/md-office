const { setupWSConnection } = require('y-websocket/bin/utils');
const http = require('http');
const WebSocket = require('ws');
const Y = require('yjs');
const fs = require('fs').promises;
const path = require('path');

// Port for the WebSocket server
const PORT = process.env.COLLABORATION_PORT || 1234;

// Workspace directory for saving documents  
const WORKSPACE_DIR = process.env.WORKSPACE_PATH || './workspace';

// Store for Y.Doc instances
const docs = new Map();

// Function to get or create a Y.Doc for a document
function getYDoc(docName) {
  if (!docs.has(docName)) {
    const ydoc = new Y.Doc();
    docs.set(docName, ydoc);
    
    // Load existing content if it exists
    loadDocument(docName, ydoc);
    
    // Save document on updates (debounced)
    let saveTimeout;
    ydoc.on('update', () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => saveDocument(docName, ydoc), 1000);
    });
  }
  return docs.get(docName);
}

// Load document from filesystem
async function loadDocument(docName, ydoc) {
  try {
    const filePath = path.join(WORKSPACE_DIR, docName);
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Get the shared text type
    const ytext = ydoc.getText('content');
    
    // Set initial content if the document is empty
    if (ytext.length === 0) {
      ytext.insert(0, content);
    }
  } catch (error) {
    // File doesn't exist or can't be read, that's okay
    console.log(`Document ${docName} not found, starting empty`);
  }
}

// Save document to filesystem
async function saveDocument(docName, ydoc) {
  try {
    const ytext = ydoc.getText('content');
    const content = ytext.toString();
    const filePath = path.join(WORKSPACE_DIR, docName);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    // Save to file
    await fs.writeFile(filePath, content, 'utf-8');
    console.log(`Saved document: ${docName}`);
  } catch (error) {
    console.error(`Error saving document ${docName}:`, error);
  }
}

// Create HTTP server
const server = http.createServer();

// Create WebSocket server
const wss = new WebSocket.Server({ 
  server,
  path: '/collaboration'
});

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const docName = url.searchParams.get('doc');
  
  if (!docName) {
    ws.close(1008, 'Document name is required');
    return;
  }
  
  console.log(`Client connected for document: ${docName}`);
  
  // Get or create Y.Doc for this document
  const ydoc = getYDoc(docName);
  
  // Setup the WebSocket connection with y-websocket utils
  setupWSConnection(ws, req, { 
    docName,
    gc: true,
    // Provide the Y.Doc instance
    ydoc
  });
  
  ws.on('close', () => {
    console.log(`Client disconnected from document: ${docName}`);
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Collaboration server running on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/collaboration`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down collaboration server...');
  wss.close(() => {
    server.close(() => {
      process.exit(0);
    });
  });
});