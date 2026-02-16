package api

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

// APIResponse is the standard response envelope
type APIResponse struct {
	Data  interface{} `json:"data,omitempty"`
	Error string      `json:"error,omitempty"`
}

// Document types for the API
type Document struct {
	ID           string    `json:"id"`
	Title        string    `json:"title"`
	Path         string    `json:"path"`
	Type         string    `json:"type"` // doc, sheet, slide, database
	Content      string    `json:"content,omitempty"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
	Size         int64     `json:"size"`
}

type CreateDocumentRequest struct {
	Title   string `json:"title"`
	Type    string `json:"type"`
	Content string `json:"content"`
	Folder  string `json:"folder,omitempty"`
}

type UpdateDocumentRequest struct {
	Title   string `json:"title,omitempty"`
	Content string `json:"content"`
}

type ExportRequest struct {
	Format string `json:"format"` // markdown, html
}

type SearchQuery struct {
	Q        string `json:"q"`
	Type     string `json:"type,omitempty"`
	Limit    int    `json:"limit,omitempty"`
}

// Config holds runtime config for API routes
type Config struct {
	WorkspaceDir string
	ConfigDir    string
	GetUserID    func(c *fiber.Ctx) string
}

var (
	rateLimiter *RateLimiter
	apiConfig   *Config
)

// RegisterRoutes sets up /api/v1/ routes
func RegisterRoutes(app fiber.Router, cfg *Config) {
	apiConfig = cfg

	// Initialize API key store
	if err := InitAPIKeyStore(cfg.ConfigDir); err != nil {
		fmt.Printf("Warning: API key store init failed: %v\n", err)
	}

	// Rate limiter: 120 requests per minute per key
	rateLimiter = NewRateLimiter(120, time.Minute)

	v1 := app.Group("/api/v1", apiKeyAuthMiddleware)

	// API key management (uses JWT auth, not API key)
	keys := app.Group("/api/v1/keys", jwtPassthrough(cfg))
	keys.Get("/", listAPIKeys)
	keys.Post("/", createAPIKey)
	keys.Delete("/:id", revokeAPIKey)

	// Document CRUD for each type
	for _, docType := range []string{"docs", "sheets", "slides", "databases"} {
		group := v1.Group("/" + docType)
		group.Get("/", makeListHandler(docType))
		group.Get("/:id", makeGetHandler(docType))
		group.Post("/", makeCreateHandler(docType))
		group.Put("/:id", makeUpdateHandler(docType))
		group.Delete("/:id", makeDeleteHandler(docType))
	}

	// Search
	v1.Get("/search", searchHandler)

	// Export
	v1.Get("/export/:type/:id", exportHandler)

	// Health
	app.Get("/health", healthHandler)
}

// apiKeyAuthMiddleware validates API key from header
func apiKeyAuthMiddleware(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer mdo_") {
		return c.Status(401).JSON(APIResponse{Error: "API key required (Bearer mdo_...)"})
	}

	rawKey := strings.TrimPrefix(authHeader, "Bearer ")
	key, err := ValidateKey(rawKey)
	if err != nil {
		return c.Status(401).JSON(APIResponse{Error: "Invalid API key"})
	}

	// Rate limiting
	allowed, remaining, resetAt := rateLimiter.Allow(key.ID)
	c.Set("X-RateLimit-Remaining", strconv.Itoa(remaining))
	c.Set("X-RateLimit-Reset", resetAt.Format(time.RFC3339))

	if !allowed {
		c.Set("Retry-After", strconv.Itoa(int(time.Until(resetAt).Seconds())))
		return c.Status(429).JSON(APIResponse{Error: "Rate limit exceeded"})
	}

	c.Locals("apiKeyUserID", key.UserID)
	c.Locals("apiKeyID", key.ID)
	return c.Next()
}

// jwtPassthrough reuses the existing JWT auth for key management endpoints
func jwtPassthrough(cfg *Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// The main app's authMiddleware should have already run
		// or we check for JWT here
		userID := cfg.GetUserID(c)
		if userID == "" {
			return c.Status(401).JSON(APIResponse{Error: "Authentication required"})
		}
		c.Locals("apiKeyUserID", userID)
		return c.Next()
	}
}

// --- API Key management handlers ---

func listAPIKeys(c *fiber.Ctx) error {
	userID := c.Locals("apiKeyUserID").(string)
	keys := ListKeys(userID)
	if keys == nil {
		keys = []APIKey{}
	}
	return c.JSON(APIResponse{Data: keys})
}

type createKeyRequest struct {
	Name string `json:"name"`
}

func createAPIKey(c *fiber.Ctx) error {
	userID := c.Locals("apiKeyUserID").(string)
	var req createKeyRequest
	if err := c.BodyParser(&req); err != nil || req.Name == "" {
		return c.Status(400).JSON(APIResponse{Error: "name is required"})
	}

	rawKey, key, err := GenerateKey(req.Name, userID)
	if err != nil {
		return c.Status(500).JSON(APIResponse{Error: err.Error()})
	}

	return c.JSON(APIResponse{Data: map[string]interface{}{
		"key":    rawKey,
		"id":     key.ID,
		"name":   key.Name,
		"prefix": key.Prefix,
	}})
}

func revokeAPIKey(c *fiber.Ctx) error {
	userID := c.Locals("apiKeyUserID").(string)
	keyID := c.Params("id")
	if err := RevokeKey(keyID, userID); err != nil {
		return c.Status(404).JSON(APIResponse{Error: err.Error()})
	}
	return c.JSON(APIResponse{Data: "Key revoked"})
}

// --- Document helpers ---

func docTypeToExtension(docType string) string {
	switch docType {
	case "docs":
		return ".md"
	case "sheets":
		return ".sheet.json"
	case "slides":
		return ".slides.json"
	case "databases":
		return ".db.json"
	default:
		return ".md"
	}
}

func extensionToDocType(path string) string {
	switch {
	case strings.HasSuffix(path, ".sheet.json"):
		return "sheets"
	case strings.HasSuffix(path, ".slides.json"):
		return "slides"
	case strings.HasSuffix(path, ".db.json"):
		return "databases"
	case strings.HasSuffix(path, ".md"):
		return "docs"
	default:
		return "docs"
	}
}

func pathToID(path string) string {
	return strings.ReplaceAll(strings.ReplaceAll(path, "/", "_"), "\\", "_")
}

func idToPath(id string) string {
	return strings.ReplaceAll(id, "_", "/")
}

func listDocuments(docType string) ([]Document, error) {
	ext := docTypeToExtension(docType)
	var docs []Document

	err := filepath.WalkDir(apiConfig.WorkspaceDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			if d != nil && d.IsDir() && d.Name() == ".git" {
				return filepath.SkipDir
			}
			return nil
		}

		if !strings.HasSuffix(path, ext) {
			return nil
		}

		info, err := d.Info()
		if err != nil {
			return nil
		}

		relPath, _ := filepath.Rel(apiConfig.WorkspaceDir, path)
		title := strings.TrimSuffix(filepath.Base(relPath), ext)

		docs = append(docs, Document{
			ID:        pathToID(relPath),
			Title:     title,
			Path:      relPath,
			Type:      docType,
			CreatedAt: info.ModTime(), // Approximation
			UpdatedAt: info.ModTime(),
			Size:      info.Size(),
		})

		return nil
	})

	return docs, err
}

// --- CRUD handlers ---

func makeListHandler(docType string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		docs, err := listDocuments(docType)
		if err != nil {
			return c.Status(500).JSON(APIResponse{Error: err.Error()})
		}
		if docs == nil {
			docs = []Document{}
		}
		return c.JSON(APIResponse{Data: docs})
	}
}

func makeGetHandler(docType string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		id := c.Params("id")
		relPath := idToPath(id)
		fullPath := filepath.Join(apiConfig.WorkspaceDir, relPath)

		if !strings.HasPrefix(fullPath, apiConfig.WorkspaceDir) {
			return c.Status(403).JSON(APIResponse{Error: "Access denied"})
		}

		content, err := os.ReadFile(fullPath)
		if err != nil {
			return c.Status(404).JSON(APIResponse{Error: "Document not found"})
		}

		info, _ := os.Stat(fullPath)
		ext := docTypeToExtension(docType)
		title := strings.TrimSuffix(filepath.Base(relPath), ext)

		doc := Document{
			ID:        id,
			Title:     title,
			Path:      relPath,
			Type:      docType,
			Content:   string(content),
			UpdatedAt: info.ModTime(),
			Size:      info.Size(),
		}

		return c.JSON(APIResponse{Data: doc})
	}
}

func makeCreateHandler(docType string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req CreateDocumentRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(APIResponse{Error: "Invalid request body"})
		}

		if req.Title == "" {
			return c.Status(400).JSON(APIResponse{Error: "title is required"})
		}

		ext := docTypeToExtension(docType)
		folder := req.Folder
		if folder == "" {
			folder = "."
		}
		relPath := filepath.Join(folder, req.Title+ext)
		fullPath := filepath.Join(apiConfig.WorkspaceDir, relPath)

		if !strings.HasPrefix(fullPath, apiConfig.WorkspaceDir) {
			return c.Status(403).JSON(APIResponse{Error: "Access denied"})
		}

		if _, err := os.Stat(fullPath); err == nil {
			return c.Status(409).JSON(APIResponse{Error: "Document already exists"})
		}

		if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
			return c.Status(500).JSON(APIResponse{Error: err.Error()})
		}

		content := req.Content
		if content == "" {
			switch docType {
			case "docs":
				content = "# " + req.Title + "\n"
			case "sheets":
				content = `{"cells":{},"meta":{"title":"` + req.Title + `"}}`
			case "slides":
				content = `{"slides":[],"meta":{"title":"` + req.Title + `"}}`
			case "databases":
				content = `{"columns":[],"rows":[],"meta":{"title":"` + req.Title + `"}}`
			}
		}

		if err := os.WriteFile(fullPath, []byte(content), 0644); err != nil {
			return c.Status(500).JSON(APIResponse{Error: err.Error()})
		}

		// Fire webhook
		go FireEvent(docType[:len(docType)-1]+".created", map[string]interface{}{
			"id":    pathToID(relPath),
			"title": req.Title,
			"type":  docType,
			"path":  relPath,
		})

		info, _ := os.Stat(fullPath)
		doc := Document{
			ID:        pathToID(relPath),
			Title:     req.Title,
			Path:      relPath,
			Type:      docType,
			Content:   content,
			CreatedAt: info.ModTime(),
			UpdatedAt: info.ModTime(),
			Size:      info.Size(),
		}

		return c.Status(201).JSON(APIResponse{Data: doc})
	}
}

func makeUpdateHandler(docType string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		id := c.Params("id")
		relPath := idToPath(id)
		fullPath := filepath.Join(apiConfig.WorkspaceDir, relPath)

		if !strings.HasPrefix(fullPath, apiConfig.WorkspaceDir) {
			return c.Status(403).JSON(APIResponse{Error: "Access denied"})
		}

		if _, err := os.Stat(fullPath); os.IsNotExist(err) {
			return c.Status(404).JSON(APIResponse{Error: "Document not found"})
		}

		var req UpdateDocumentRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(APIResponse{Error: "Invalid request body"})
		}

		if err := os.WriteFile(fullPath, []byte(req.Content), 0644); err != nil {
			return c.Status(500).JSON(APIResponse{Error: err.Error()})
		}

		// Fire webhook
		eventName := docType[:len(docType)-1] + ".updated"
		go FireEvent(eventName, map[string]interface{}{
			"id":   id,
			"type": docType,
			"path": relPath,
		})

		info, _ := os.Stat(fullPath)
		ext := docTypeToExtension(docType)
		title := strings.TrimSuffix(filepath.Base(relPath), ext)

		doc := Document{
			ID:        id,
			Title:     title,
			Path:      relPath,
			Type:      docType,
			Content:   req.Content,
			UpdatedAt: info.ModTime(),
			Size:      info.Size(),
		}

		return c.JSON(APIResponse{Data: doc})
	}
}

func makeDeleteHandler(docType string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		id := c.Params("id")
		relPath := idToPath(id)
		fullPath := filepath.Join(apiConfig.WorkspaceDir, relPath)

		if !strings.HasPrefix(fullPath, apiConfig.WorkspaceDir) {
			return c.Status(403).JSON(APIResponse{Error: "Access denied"})
		}

		if _, err := os.Stat(fullPath); os.IsNotExist(err) {
			return c.Status(404).JSON(APIResponse{Error: "Document not found"})
		}

		if err := os.Remove(fullPath); err != nil {
			return c.Status(500).JSON(APIResponse{Error: err.Error()})
		}

		// Fire webhook
		go FireEvent(docType[:len(docType)-1]+".deleted", map[string]interface{}{
			"id":   id,
			"type": docType,
			"path": relPath,
		})

		return c.JSON(APIResponse{Data: "Deleted"})
	}
}

// --- Search handler ---

func searchHandler(c *fiber.Ctx) error {
	q := c.Query("q", "")
	if q == "" {
		return c.Status(400).JSON(APIResponse{Error: "q parameter required"})
	}

	docTypeFilter := c.Query("type", "")
	limitStr := c.Query("limit", "50")
	limit, _ := strconv.Atoi(limitStr)
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	qLower := strings.ToLower(q)
	var results []Document

	filepath.WalkDir(apiConfig.WorkspaceDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			if d != nil && d.IsDir() && d.Name() == ".git" {
				return filepath.SkipDir
			}
			return nil
		}

		relPath, _ := filepath.Rel(apiConfig.WorkspaceDir, path)
		dt := extensionToDocType(relPath)

		if docTypeFilter != "" && dt != docTypeFilter {
			return nil
		}

		// Check filename match
		nameMatch := strings.Contains(strings.ToLower(filepath.Base(relPath)), qLower)

		// Check content match
		contentMatch := false
		content, err := os.ReadFile(path)
		if err == nil {
			contentMatch = strings.Contains(strings.ToLower(string(content)), qLower)
		}

		if nameMatch || contentMatch {
			info, _ := d.Info()
			ext := docTypeToExtension(dt)
			title := strings.TrimSuffix(filepath.Base(relPath), ext)

			results = append(results, Document{
				ID:        pathToID(relPath),
				Title:     title,
				Path:      relPath,
				Type:      dt,
				UpdatedAt: info.ModTime(),
				Size:      info.Size(),
			})
		}

		if len(results) >= limit {
			return filepath.SkipAll
		}
		return nil
	})

	if results == nil {
		results = []Document{}
	}

	return c.JSON(APIResponse{Data: map[string]interface{}{
		"results": results,
		"total":   len(results),
		"query":   q,
	}})
}

// --- Export handler ---

func exportHandler(c *fiber.Ctx) error {
	docType := c.Params("type")
	id := c.Params("id")
	format := c.Query("format", "markdown")

	relPath := idToPath(id)
	fullPath := filepath.Join(apiConfig.WorkspaceDir, relPath)

	if !strings.HasPrefix(fullPath, apiConfig.WorkspaceDir) {
		return c.Status(403).JSON(APIResponse{Error: "Access denied"})
	}

	content, err := os.ReadFile(fullPath)
	if err != nil {
		return c.Status(404).JSON(APIResponse{Error: "Document not found"})
	}

	switch format {
	case "markdown":
		c.Set("Content-Type", "text/markdown")
		c.Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s.md"`, filepath.Base(relPath)))
		return c.Send(content)
	case "html":
		// Simple markdown-to-HTML for docs, raw JSON for others
		html := "<html><body>"
		if docType == "docs" {
			// Basic conversion
			lines := strings.Split(string(content), "\n")
			for _, line := range lines {
				if strings.HasPrefix(line, "# ") {
					html += "<h1>" + strings.TrimPrefix(line, "# ") + "</h1>\n"
				} else if strings.HasPrefix(line, "## ") {
					html += "<h2>" + strings.TrimPrefix(line, "## ") + "</h2>\n"
				} else if strings.HasPrefix(line, "### ") {
					html += "<h3>" + strings.TrimPrefix(line, "### ") + "</h3>\n"
				} else if line == "" {
					html += "<br>\n"
				} else {
					html += "<p>" + line + "</p>\n"
				}
			}
		} else {
			html += "<pre>" + string(content) + "</pre>"
		}
		html += "</body></html>"
		c.Set("Content-Type", "text/html")
		c.Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s.html"`, filepath.Base(relPath)))
		return c.SendString(html)
	case "json":
		c.Set("Content-Type", "application/json")
		// If content is already JSON, send as-is; otherwise wrap
		var js json.RawMessage
		if json.Unmarshal(content, &js) == nil {
			return c.Send(content)
		}
		wrapped, _ := json.Marshal(map[string]string{"content": string(content)})
		return c.Send(wrapped)
	default:
		return c.Status(400).JSON(APIResponse{Error: "Unsupported format. Use: markdown, html, json"})
	}
}

// --- Health handler ---

func healthHandler(c *fiber.Ctx) error {
	return c.JSON(map[string]interface{}{
		"status":    "ok",
		"timestamp": time.Now().Format(time.RFC3339),
		"version":   "1.0.0",
	})
}
