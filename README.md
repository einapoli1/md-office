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

## Future Enhancements

- Real-time collaborative editing
- Plugin system for extensions
- Export to various formats (PDF, DOCX, etc.)
- Advanced Git operations (branching, merging)
- User authentication and multi-user workspaces
- Cloud storage integration
- Mobile app support