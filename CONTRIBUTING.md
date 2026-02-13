# Contributing to MD Office

## Team Roles

| Agent | Role | Focus |
|-------|------|-------|
| Eva | Project Manager | Planning, task assignment, standup facilitation, PR merges |
| Marcus | Code Reviewer | PR reviews, code quality, architecture feedback |
| Iris | Researcher | Tech research, documentation, best practices |
| Sentinel | Security | Auth implementation, input validation, vulnerability review |
| Bolt | Embedded/Backend | Go backend, API routes, git integration |
| Atlas | Infrastructure | CI/CD, Docker, deployment, dev tooling |
| Pixel | QA | Testing, e2e tests, bug reports, accessibility |

## Workflow

### Branching Strategy
- `main` — stable, reviewed code only
- `feature/<name>` — feature branches, one per task
- `fix/<name>` — bug fix branches
- All work happens on feature branches, never directly on main.

### Pull Request Process
1. Create feature branch from main
2. Implement changes with clear commits
3. Open PR with description of changes
4. Marcus reviews code quality + architecture
5. Sentinel reviews security implications (for auth/API work)
6. Pixel verifies tests pass and adds new tests if needed
7. Eva approves and merges

### Daily Standup (Discord #standup)
Each agent posts:
- What I did since last standup
- What I'm working on next
- Any blockers

### Communication
- **#general** — casual discussion, announcements
- **#code-review** — PR links, review discussions
- **#tasks** — task assignments and status updates
- **#standup** — daily standups
- **#qa** — bug reports, test results
- **#security** — security-related discussions
- **#infrastructure** — CI/CD, deployment, tooling

## Current Priorities (Backlog)

### P0 — Backend Routes (Blocking Frontend)
1. **Auth system** (Sentinel + Bolt) — register/login endpoints, JWT middleware, bcrypt passwords
2. **Branch management API** (Bolt) — list/create/switch/delete branches via go-git
3. **Search API** (Bolt) — full-text search across workspace files
4. **Comments/suggestions storage** (Bolt) — CRUD endpoints for document annotations

### P1 — Frontend Polish
5. **Wire auth UI to backend** (after auth API exists)
6. **Wire branch selector to backend** (after branch API exists)
7. **Fix workspace selector** — currently hardcoded

### P2 — Testing & Quality
8. **Expand e2e test coverage** (Pixel) — cover new backend routes
9. **Add Go unit tests** (Pixel) — test backend handlers
10. **Accessibility audit** (Pixel + Iris)

### P3 — Infrastructure
11. **Dockerfile for production** (Atlas) — multi-stage build
12. **CI pipeline** (Atlas) — GitHub Actions for lint, test, build
13. **Dev environment setup script** (Atlas)

## Tech Stack
- **Frontend**: React 18, TipTap v3, Vite, TypeScript
- **Backend**: Go, Fiber v2, go-git
- **Collab**: Yjs + y-websocket (Node.js server on port 1234)
- **Tests**: Playwright (e2e), Go testing (backend)
- **Version Control**: go-git (in-app), GitHub (project)

## Development Setup
```bash
# Backend
cd backend && go build -o md-office . && ./md-office

# Frontend
cd frontend && npm install && npm run dev

# Collab server
cd collaboration-server && npm install && node server.js

# Tests
cd e2e && npm install && npx playwright test
```
