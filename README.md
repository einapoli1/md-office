# MD Office

An open-source office suite competitor to MS Office with a focus on markdown documents and built-in Git version control.

## Features

- **Markdown Editor**: Rich text editing with WYSIWYG interface that saves as .md files
- **File Browser**: Navigate, create, rename, and delete files and folders in your workspace
- **Git Integration**: Automatic commits on every save with full version history
- **Real-time Preview**: See rendered markdown as you type
- **Version History**: View commit history and revert to previous versions
- **Human + AI Collaboration**: Designed for seamless collaboration between humans and AI

## Tech Stack

- **Frontend**: React + TypeScript + Vite + TipTap (rich text editor)
- **Backend**: Go + Fiber framework + go-git library
- **Storage**: Local filesystem with Git repository per workspace

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- Go (v1.19 or higher)
- Git

### Installation & Setup

1. **Clone or navigate to the project directory**:
   ```bash
   cd md-office
   ```

2. **Install frontend dependencies**:
   ```bash
   cd frontend
   npm install
   ```

3. **Build the frontend** (required for production mode):
   ```bash
   npm run build
   cd ..
   ```

4. **Install backend dependencies**:
   ```bash
   cd backend
   go mod tidy
   ```

### Running the Application

**Option 1: Development Mode (Frontend + Backend separately)**

1. **Start the backend server**:
   ```bash
   cd backend
   go run main.go
   ```
   The API server will start on `http://localhost:8080`

2. **In a new terminal, start the frontend dev server**:
   ```bash
   cd frontend
   npm run dev
   ```
   The frontend will be available at `http://localhost:3000`

**Option 2: Production Mode (Backend serves frontend)**

1. **Build the frontend** (if not already done):
   ```bash
   cd frontend
   npm run build
   cd ..
   ```

2. **Start the backend server**:
   ```bash
   cd backend
   go run main.go
   ```

3. **Open your browser** to `http://localhost:8080`

### Usage

1. **Creating Files**: Click the "New" button in the sidebar to create files or folders
2. **Editing**: Click on any `.md` file to open it in the editor
3. **Saving**: Use the "Save" button or Ctrl/Cmd+S to save changes (auto-commits to Git)
4. **Version History**: View previous versions in the sidebar and revert if needed
5. **Preview**: Toggle the preview pane to see rendered markdown

### Project Structure

```
md-office/
├── backend/                 # Go API server
│   ├── main.go             # Main server file with all handlers
│   ├── go.mod              # Go module definition
│   └── workspace/          # Git repository for documents (auto-created)
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── types/          # TypeScript type definitions
│   │   └── utils/          # API client and utilities
│   ├── dist/               # Built frontend files
│   └── package.json
└── README.md
```

### API Endpoints

- `GET /api/files` - Get file tree structure
- `GET /api/files/:path` - Get file content
- `POST /api/files` - Save file content
- `POST /api/files/create` - Create new file
- `POST /api/files/mkdir` - Create directory
- `DELETE /api/files/:path` - Delete file/folder
- `PUT /api/files/rename` - Rename file/folder
- `GET /api/git/history` - Get commit history
- `POST /api/git/revert` - Revert to specific commit

### Features in Detail

#### Git Integration
- Every save operation automatically creates a Git commit
- Full commit history is maintained and browsable
- Revert functionality to restore previous versions
- Git repository is automatically initialized on first run

#### File Management
- Create, read, update, delete operations for files and folders
- Secure path validation to prevent directory traversal
- Support for nested folder structures

#### Markdown Editor
- WYSIWYG editing experience (users don't see raw markdown)
- Rich text formatting toolbar (bold, italic, headers, lists, etc.)
- Real-time preview pane
- TipTap-based editor with markdown output

## Development

### Frontend Development
```bash
cd frontend
npm run dev        # Start dev server
npm run build      # Build for production
npm run lint       # Run ESLint
```

### Backend Development
```bash
cd backend
go run main.go     # Start server
go mod tidy        # Update dependencies
```

### Architecture

The application follows a clean separation between frontend and backend:

- **Frontend**: Pure React SPA that communicates with backend via REST API
- **Backend**: Go server that handles file operations, Git operations, and serves the built frontend
- **Storage**: Local filesystem with Git for version control
- **Communication**: JSON REST API between frontend and backend

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

Open source (license TBD)

## Self-Hosting with Docker

### Quick Start

```bash
# Clone and configure
git clone <repo-url> md-office && cd md-office
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET to a random string

# Build and run
docker-compose up -d

# Open http://localhost:8080
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Server port |
| `JWT_SECRET` | (built-in) | **Set this!** Secret for JWT tokens |
| `CORS_ORIGINS` | `*` | Allowed CORS origins (comma-separated) |
| `WORKSPACE_PATH` | `/data/workspace` | Where documents are stored |
| `GITHUB_CLIENT_ID` | — | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | — | GitHub OAuth app secret |
| `GITLAB_CLIENT_ID` | — | GitLab OAuth app client ID |
| `GITLAB_CLIENT_SECRET` | — | GitLab OAuth app secret |
| `GITEA_URL` | — | Self-hosted Gitea instance URL |

### OAuth Setup (Optional)

To enable GitHub/GitLab login:
1. Create an OAuth app on GitHub (Settings → Developer Settings → OAuth Apps)
2. Set the callback URL to `http://your-host:8080/api/auth/github/callback`
3. Add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` to `.env`

### Data Persistence

All data is stored in the `md-office-data` Docker volume. To back up:

```bash
docker run --rm -v md-office-data:/data -v $(pwd):/backup alpine tar czf /backup/md-office-backup.tar.gz /data
```

### Health Check

```bash
curl http://localhost:8080/health
# {"status":"ok","timestamp":"...","version":"1.0.0"}
```

## REST API

The API is available at `/api/v1/` and requires an API key for authentication.

### Authentication

1. Log in to the web UI
2. Go to Tools → API Keys & Webhooks
3. Generate an API key
4. Use it in requests: `Authorization: Bearer mdo_...`

### Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/docs` | List documents |
| POST | `/api/v1/docs` | Create document |
| GET | `/api/v1/docs/:id` | Get document |
| PUT | `/api/v1/docs/:id` | Update document |
| DELETE | `/api/v1/docs/:id` | Delete document |
| GET | `/api/v1/sheets` | List spreadsheets |
| GET | `/api/v1/slides` | List slide decks |
| GET | `/api/v1/databases` | List databases |
| GET | `/api/v1/search?q=term` | Search all documents |
| GET | `/api/v1/export/:type/:id?format=html` | Export document |
| GET | `/health` | Health check |

(Same CRUD pattern for sheets, slides, databases)

### Rate Limiting

API requests are rate-limited to 120 requests/minute per API key. Headers:
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Window reset time

### OpenAPI Spec

The OpenAPI 3.0 specification is at `backend/api/openapi.json`.

## Webhooks

Subscribe to document events via the Settings panel or API:

**Events:** `doc.created`, `doc.updated`, `doc.deleted`, `sheet.updated`, `slide.updated`, `db.updated`

Webhook payloads include an HMAC-SHA256 signature in the `X-Signature-256` header.

Deliveries are retried up to 3 times with exponential backoff.

## Future Enhancements

- Real-time collaborative editing
- Plugin system for extensions
- Mobile app support