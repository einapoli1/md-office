const { Server } = require('@hocuspocus/server');
const Y = require('yjs');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');

// Configuration
const PORT = process.env.COLLABORATION_PORT || 1234;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';
const WORKSPACE_DIR = process.env.WORKSPACE_PATH || './workspace';

// Store debounce timeouts for document saving
const saveTimeouts = new Map();

// Function to make HTTP requests to the Go backend
async function fetchFromBackend(endpoint, options = {}) {
  try {
    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    if (!response.ok) {
      throw new Error(`Backend request failed: ${response.status}`);
    }
    
    return response;
  } catch (error) {
    console.error(`Backend request error:`, error);
    throw error;
  }
}

// Load Yjs binary state from sidecar file
async function loadYjsState(docName) {
  try {
    const stateFilePath = path.join(WORKSPACE_DIR, `.${docName}.yjs`);
    const stateData = await fs.readFile(stateFilePath);
    return new Uint8Array(stateData);
  } catch (error) {
    console.log(`No Yjs state file found for ${docName}, starting fresh`);
    return null;
  }
}

// Save Yjs binary state to sidecar file
async function saveYjsState(docName, state) {
  try {
    const stateFilePath = path.join(WORKSPACE_DIR, `.${docName}.yjs`);
    await fs.mkdir(path.dirname(stateFilePath), { recursive: true });
    await fs.writeFile(stateFilePath, Buffer.from(state));
    console.log(`Saved Yjs state for document: ${docName}`);
  } catch (error) {
    console.error(`Error saving Yjs state for ${docName}:`, error);
  }
}

// Serialize Yjs document to plain text (TipTap uses XmlFragment 'default')
function serializeYjsToText(ydoc) {
  // TipTap stores content in an XmlFragment named 'default'
  const fragment = ydoc.getXmlFragment('default');
  if (fragment && fragment.length > 0) {
    return fragment.toJSON();
  }
  // Fallback to getText for simple text docs
  const ytext = ydoc.getText('content');
  return ytext.toString();
}

// Create Hocuspocus server
const server = new Server({
  port: PORT,
  
  // Load document content from Go backend and Yjs state
  async onLoadDocument(data) {
    const { documentName, document } = data;
    console.log(`Loading document: ${documentName}`);
    
    try {
      // First, try to load Yjs binary state for lossless recovery
      const yjsState = await loadYjsState(documentName);
      if (yjsState) {
        Y.applyUpdate(document, yjsState);
        console.log(`Loaded Yjs state for ${documentName}`);
        return document;
      }
      
      // If no Yjs state, load from Go backend
      const response = await fetchFromBackend(`/api/files/${encodeURIComponent(documentName)}`);
      const fileContent = await response.text();
      
      // Initialize document with content from backend
      const ytext = document.getText('content');
      if (ytext.length === 0 && fileContent) {
        ytext.insert(0, fileContent);
        console.log(`Loaded content from backend for ${documentName}`);
      }
      
    } catch (error) {
      console.error(`Error loading document ${documentName}:`, error);
      // Continue with empty document if loading fails
    }
    
    return document;
  },
  
  // Save document back to Go backend and preserve Yjs state
  async onStoreDocument(data) {
    const { documentName, document } = data;
    
    // Clear any existing timeout for this document
    if (saveTimeouts.has(documentName)) {
      clearTimeout(saveTimeouts.get(documentName));
    }
    
    // Debounce saves by ~5 seconds
    const timeoutId = setTimeout(async () => {
      try {
        console.log(`Saving document: ${documentName}`);
        
        // Save Yjs binary state for lossless recovery
        const state = Y.encodeStateAsUpdate(document);
        await saveYjsState(documentName, state);
        
        // Serialize and send to Go backend
        const content = serializeYjsToText(document);
        
        await fetchFromBackend(`/api/files/${encodeURIComponent(documentName)}`, {
          method: 'PUT',
          body: JSON.stringify({ content }),
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        console.log(`Successfully saved ${documentName} to backend`);
        
      } catch (error) {
        console.error(`Error saving document ${documentName}:`, error);
      } finally {
        saveTimeouts.delete(documentName);
      }
    }, 5000); // 5 second debounce
    
    saveTimeouts.set(documentName, timeoutId);
  },
  
  // Log connections
  onConnect(data) {
    console.log(`Client connected to document: ${data.documentName}`);
  },
  
  onDisconnect(data) {
    console.log(`Client disconnected from document: ${data.documentName}`);
  },
  
  // Handle authentication (for future use)
  async onAuthenticate(data) {
    // For now, allow all connections
    const id = data.connection?.remoteAddress || `anon-${Date.now()}`;
    const token = data.token || null;
    return {
      user: {
        id,
        name: token || `Guest ${Math.random().toString(36).substring(2, 6)}`,
      }
    };
  }
});

server.listen().then(() => {
  console.log(`🚀 Hocuspocus collaboration server running on port ${PORT}`);
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

console.log(`Starting Hocuspocus collaboration server on port ${PORT}...`);
console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}`);
console.log(`🔗 Backend URL: ${BACKEND_URL}`);
console.log(`📁 Workspace: ${WORKSPACE_DIR}`);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down collaboration server...');
  server.destroy();
});

process.on('SIGINT', () => {
  console.log('Shutting down collaboration server...');
  server.destroy();
});