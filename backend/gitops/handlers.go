package gitops

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	gogit "github.com/go-git/go-git/v5"
	"github.com/gofiber/fiber/v2"

	"md-office-backend/auth"
	"md-office-backend/providers"
)

// ConnectedRepo tracks a user's connected repository.
type ConnectedRepo struct {
	Config   *RepoConfig      `json:"config"`
	Repo     *gogit.Repository `json:"-"`
	LocalPath string           `json:"localPath"`
}

var (
	userRepos = make(map[string]*ConnectedRepo) // userID -> repo
	repoMu   sync.RWMutex
)

// RegisterRoutes adds git operations routes.
func RegisterRoutes(app fiber.Router, authMiddleware fiber.Handler) {
	g := app.Group("/git-provider", authMiddleware)

	// Repository management
	g.Get("/repos", listRepos)
	g.Post("/repos", createRepo)
	g.Get("/repos/:owner/:name/branches", listRepoBranches)

	// Connect/setup a repo for editing
	g.Post("/connect", connectRepo)
	g.Get("/status", getSyncStatus)
	g.Post("/sync", syncRepo)
	g.Post("/commit", commitChanges)
	g.Post("/create-branch", createNewBranch)
	g.Post("/create-pr", createPR)

	// File operations on connected repo
	g.Get("/files", listRepoFiles)
	g.Get("/file/*", getRepoFile)
	g.Post("/file", saveRepoFile)
}

func getProviderClient(c *fiber.Ctx) (*providers.Client, error) {
	userID := c.Locals("userID").(string)
	provider := c.Query("provider", "github")
	giteaURL := c.Query("gitea_url", "")

	token, err := auth.GetToken(userID, provider, giteaURL)
	if err != nil {
		return nil, fmt.Errorf("not connected to %s: %w", provider, err)
	}

	return &providers.Client{
		Provider:    provider,
		GiteaURL:    giteaURL,
		AccessToken: token.AccessToken,
	}, nil
}

func listRepos(c *fiber.Ctx) error {
	client, err := getProviderClient(c)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	page := c.QueryInt("page", 1)
	perPage := c.QueryInt("per_page", 20)
	search := c.Query("search", "")

	repos, err := client.ListRepos(page, perPage, search)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"data": repos})
}

func createRepo(c *fiber.Ctx) error {
	client, err := getProviderClient(c)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	var req providers.CreateRepoRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	req.AutoInit = true

	repo, err := client.CreateRepo(req)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"data": repo})
}

func listRepoBranches(c *fiber.Ctx) error {
	client, err := getProviderClient(c)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	owner := c.Params("owner")
	name := c.Params("name")

	branches, err := client.ListBranches(owner, name)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"data": branches})
}

func connectRepo(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	var req struct {
		Provider      string `json:"provider"`
		GiteaURL      string `json:"giteaUrl"`
		Owner         string `json:"owner"`
		RepoName      string `json:"repoName"`
		CloneURL      string `json:"cloneUrl"`
		Branch        string `json:"branch"`
		DefaultBranch string `json:"defaultBranch"`
		Subdirectory  string `json:"subdirectory"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}

	token, err := auth.GetToken(userID, req.Provider, req.GiteaURL)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "not connected to provider"})
	}

	cfg := &RepoConfig{
		Provider:      req.Provider,
		GiteaURL:      req.GiteaURL,
		Owner:         req.Owner,
		Name:          req.RepoName,
		CloneURL:      req.CloneURL,
		Branch:        req.Branch,
		DefaultBranch: req.DefaultBranch,
		Subdirectory:  req.Subdirectory,
		AccessToken:   token.AccessToken,
		Username:      token.Username,
	}

	// Clone to user-specific directory
	homeDir, _ := os.UserHomeDir()
	localPath := filepath.Join(homeDir, ".md-office", "repos", userID, req.Owner, req.RepoName)

	// If already cloned, try to pull
	var repo *gogit.Repository
	if _, err := os.Stat(filepath.Join(localPath, ".git")); err == nil {
		repo, err = gogit.PlainOpen(localPath)
		if err != nil {
			// Corrupt, re-clone
			os.RemoveAll(localPath)
			repo, err = CloneRepo(cfg, localPath)
			if err != nil {
				return c.Status(500).JSON(fiber.Map{"error": "clone failed: " + err.Error()})
			}
		} else {
			_ = PullChanges(repo, cfg)
		}
	} else {
		repo, err = CloneRepo(cfg, localPath)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "clone failed: " + err.Error()})
		}
	}

	// Checkout the desired branch
	if cfg.Branch != cfg.DefaultBranch {
		// Create branch if it doesn't exist
		_ = CreateBranch(repo, cfg.Branch)
		_ = CheckoutBranch(repo, cfg.Branch)
	}

	// Save the config for this user
	repoMu.Lock()
	userRepos[userID] = &ConnectedRepo{
		Config:    cfg,
		Repo:      repo,
		LocalPath: localPath,
	}
	repoMu.Unlock()

	// Persist repo config
	saveUserRepoConfig(userID, cfg, localPath)

	return c.JSON(fiber.Map{"data": fiber.Map{
		"connected": true,
		"localPath": localPath,
		"branch":    cfg.Branch,
	}})
}

func getConnectedRepo(userID string) (*ConnectedRepo, error) {
	repoMu.RLock()
	cr, ok := userRepos[userID]
	repoMu.RUnlock()
	if ok {
		return cr, nil
	}

	// Try to load from persisted config
	cr, err := loadUserRepoConfig(userID)
	if err != nil {
		return nil, fmt.Errorf("no connected repo")
	}

	repoMu.Lock()
	userRepos[userID] = cr
	repoMu.Unlock()

	return cr, nil
}

func getSyncStatus(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	cr, err := getConnectedRepo(userID)
	if err != nil {
		return c.JSON(fiber.Map{"data": SyncStatus{State: "disconnected"}})
	}

	status, err := GetSyncStatus(cr.Repo, cr.Config)
	if err != nil {
		return c.JSON(fiber.Map{"data": SyncStatus{State: "error", Message: err.Error()}})
	}

	return c.JSON(fiber.Map{"data": status})
}

func syncRepo(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	cr, err := getConnectedRepo(userID)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "no connected repo"})
	}

	// Pull first
	if err := PullChanges(cr.Repo, cr.Config); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "pull failed: " + err.Error()})
	}

	return c.JSON(fiber.Map{"data": "synced"})
}

func commitChanges(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	username := c.Locals("username").(string)

	cr, err := getConnectedRepo(userID)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "no connected repo"})
	}

	var req struct {
		Message string `json:"message"`
	}
	if err := c.BodyParser(&req); err != nil || req.Message == "" {
		req.Message = fmt.Sprintf("Update from MD Office at %s", time.Now().Format(time.RFC3339))
	}

	// Check for conflicts first
	hasConflict, err := DetectConflicts(cr.Repo, cr.Config)
	if err != nil {
		log.Printf("conflict detection failed: %v", err)
	}
	if hasConflict {
		return c.Status(409).JSON(fiber.Map{"error": "merge conflict detected", "conflict": true})
	}

	email := fmt.Sprintf("%s@mdoffice.local", username)
	if err := CommitAndPush(cr.Repo, cr.Config, req.Message, username, email); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"data": "committed and pushed"})
}

func createNewBranch(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	cr, err := getConnectedRepo(userID)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "no connected repo"})
	}

	var req struct {
		Name     string `json:"name"`
		Checkout bool   `json:"checkout"`
	}
	if err := c.BodyParser(&req); err != nil || req.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "branch name required"})
	}

	if err := CreateBranch(cr.Repo, req.Name); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	if req.Checkout {
		if err := CheckoutBranch(cr.Repo, req.Name); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		cr.Config.Branch = req.Name
	}

	// Push the new branch to remote
	if err := PushBranch(cr.Repo, cr.Config, req.Name); err != nil {
		log.Printf("push branch failed (may be new): %v", err)
	}

	return c.JSON(fiber.Map{"data": "branch created"})
}

func createPR(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	cr, err := getConnectedRepo(userID)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "no connected repo"})
	}

	client, err := getProviderClient(c)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	var req struct {
		Title string `json:"title"`
		Body  string `json:"body"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}

	if req.Title == "" {
		req.Title = fmt.Sprintf("MD Office: changes from %s", cr.Config.Branch)
	}

	pr, err := client.CreatePR(providers.PRRequest{
		Title:     req.Title,
		Body:      req.Body,
		Head:      cr.Config.Branch,
		Base:      cr.Config.DefaultBranch,
		RepoOwner: cr.Config.Owner,
		RepoName:  cr.Config.Name,
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"data": pr})
}

func listRepoFiles(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	cr, err := getConnectedRepo(userID)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "no connected repo"})
	}

	files, err := ListFiles(cr.LocalPath, cr.Config.Subdirectory)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"data": files})
}

func getRepoFile(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	cr, err := getConnectedRepo(userID)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "no connected repo"})
	}

	filePath := c.Params("*")
	root := cr.LocalPath
	if cr.Config.Subdirectory != "" {
		root = filepath.Join(root, cr.Config.Subdirectory)
	}
	fullPath := filepath.Join(root, filePath)

	// Security check
	if !filepath.HasPrefix(fullPath, cr.LocalPath) {
		return c.Status(403).JSON(fiber.Map{"error": "access denied"})
	}

	content, err := os.ReadFile(fullPath)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "file not found"})
	}

	info, _ := os.Stat(fullPath)
	return c.JSON(fiber.Map{"data": fiber.Map{
		"path":         filePath,
		"content":      string(content),
		"lastModified": info.ModTime().Format(time.RFC3339),
	}})
}

func saveRepoFile(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	cr, err := getConnectedRepo(userID)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "no connected repo"})
	}

	var req struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}

	root := cr.LocalPath
	if cr.Config.Subdirectory != "" {
		root = filepath.Join(root, cr.Config.Subdirectory)
	}
	fullPath := filepath.Join(root, req.Path)

	// Security check
	if !filepath.HasPrefix(fullPath, cr.LocalPath) {
		return c.Status(403).JSON(fiber.Map{"error": "access denied"})
	}

	// Create parent dirs
	os.MkdirAll(filepath.Dir(fullPath), 0755)

	if err := os.WriteFile(fullPath, []byte(req.Content), 0644); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"data": "saved"})
}

// Persistence helpers

func saveUserRepoConfig(userID string, cfg *RepoConfig, localPath string) {
	homeDir, _ := os.UserHomeDir()
	cfgDir := filepath.Join(homeDir, ".md-office", "repo-configs")
	os.MkdirAll(cfgDir, 0755)

	data := map[string]interface{}{
		"provider":      cfg.Provider,
		"giteaUrl":      cfg.GiteaURL,
		"owner":         cfg.Owner,
		"name":          cfg.Name,
		"cloneUrl":      cfg.CloneURL,
		"branch":        cfg.Branch,
		"defaultBranch": cfg.DefaultBranch,
		"subdirectory":  cfg.Subdirectory,
		"localPath":     localPath,
	}
	b, _ := json.MarshalIndent(data, "", "  ")
	os.WriteFile(filepath.Join(cfgDir, userID+".json"), b, 0644)
}

func loadUserRepoConfig(userID string) (*ConnectedRepo, error) {
	homeDir, _ := os.UserHomeDir()
	cfgPath := filepath.Join(homeDir, ".md-office", "repo-configs", userID+".json")

	data, err := os.ReadFile(cfgPath)
	if err != nil {
		return nil, err
	}

	var m map[string]string
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, err
	}

	cfg := &RepoConfig{
		Provider:      m["provider"],
		GiteaURL:      m["giteaUrl"],
		Owner:         m["owner"],
		Name:          m["name"],
		CloneURL:      m["cloneUrl"],
		Branch:        m["branch"],
		DefaultBranch: m["defaultBranch"],
		Subdirectory:  m["subdirectory"],
	}

	localPath := m["localPath"]

	// Get token
	token, err := auth.GetToken(userID, cfg.Provider, cfg.GiteaURL)
	if err != nil {
		return nil, fmt.Errorf("no token: %w", err)
	}
	cfg.AccessToken = token.AccessToken
	cfg.Username = token.Username

	// Open existing repo
	repo, err := gogit.PlainOpen(localPath)
	if err != nil {
		return nil, fmt.Errorf("open repo: %w", err)
	}

	return &ConnectedRepo{
		Config:    cfg,
		Repo:      repo,
		LocalPath: localPath,
	}, nil
}
