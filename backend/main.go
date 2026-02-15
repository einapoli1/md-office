package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// JWT Configuration
var jwtSecret = []byte("your-secret-key-change-in-production")

// Data structures
type APIResponse struct {
	Data  interface{} `json:"data,omitempty"`
	Error string      `json:"error,omitempty"`
}

type FileSystemItem struct {
	Name        string            `json:"name"`
	Path        string            `json:"path"`
	IsDirectory bool              `json:"isDirectory"`
	Children    *[]FileSystemItem `json:"children,omitempty"`
}

type FileContent struct {
	Path         string `json:"path"`
	Content      string `json:"content"`
	LastModified string `json:"lastModified"`
}

type GitCommit struct {
	Hash    string `json:"hash"`
	Message string `json:"message"`
	Author  string `json:"author"`
	Date    string `json:"date"`
}

type GitHistory struct {
	Commits []GitCommit `json:"commits"`
}

type GitBranch struct {
	Name      string `json:"name"`
	IsCurrent bool   `json:"isCurrent"`
	Hash      string `json:"hash"`
}

type GitDiffChange struct {
	File      string `json:"file"`
	Type      string `json:"type"` // "added", "modified", "deleted"
	Additions int    `json:"additions"`
	Deletions int    `json:"deletions"`
	Content   string `json:"content,omitempty"` // Unified diff content
}

type GitDiff struct {
	From    string          `json:"from"`
	To      string          `json:"to"`
	Changes []GitDiffChange `json:"changes"`
	Summary string          `json:"summary,omitempty"`
}

// Workspace management
type Workspace struct {
	ID          string             `json:"id"`
	Name        string             `json:"name"`
	Path        string             `json:"path"`
	Owner       string             `json:"owner"`
	CreatedAt   time.Time          `json:"createdAt"`
	Members     []WorkspaceMember  `json:"members"`
	Permissions map[string]string  `json:"permissions"` // userId -> permission level
}

type WorkspaceMember struct {
	UserID     string `json:"userId"`
	Username   string `json:"username"`
	Permission string `json:"permission"` // owner, editor, viewer
	JoinedAt   time.Time `json:"joinedAt"`
}

type WorkspaceConfig struct {
	Workspaces    []Workspace `json:"workspaces"`
	ActiveWorkspace string    `json:"activeWorkspace"`
}

// User authentication
type User struct {
	ID           string    `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"passwordHash,omitempty"` // Stored in users.json, stripped from API responses
	CreatedAt    time.Time `json:"createdAt"`
}

// SafeUser is the API-safe version without password hash.
type SafeUser struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	CreatedAt time.Time `json:"createdAt"`
}

type UserStorage struct {
	Users []User `json:"users"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type RegisterRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token string   `json:"token"`
	User  SafeUser `json:"user"`
}

type JWTClaims struct {
	UserID   string `json:"userId"`
	Username string `json:"username"`
	jwt.RegisteredClaims
}

// Request types
type SaveFileRequest struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

type CreateFileRequest struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

type CreateDirRequest struct {
	Path string `json:"path"`
}

type RenameRequest struct {
	OldPath string `json:"oldPath"`
	NewPath string `json:"newPath"`
}

type RevertRequest struct {
	Hash string `json:"hash"`
	Path string `json:"path,omitempty"`
}

type CreateWorkspaceRequest struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

type SwitchWorkspaceRequest struct {
	WorkspaceID string `json:"workspaceId"`
}

type CreateBranchRequest struct {
	Name string `json:"name"`
}

type CheckoutBranchRequest struct {
	Name string `json:"name"`
}

type MergeBranchRequest struct {
	Branch string `json:"branch"`
}

type InviteUserRequest struct {
	Username   string `json:"username"`
	Permission string `json:"permission"` // editor, viewer
}

type UploadResponse struct {
	Filename string `json:"filename"`
	Path     string `json:"path"`
	Size     int64  `json:"size"`
	URL      string `json:"url"`
}

type SearchRequest struct {
	Query    string `json:"query"`
	FileType string `json:"fileType,omitempty"` // md, txt, etc.
	Limit    int    `json:"limit,omitempty"`
}

type SearchResult struct {
	File      string   `json:"file"`
	Matches   []SearchMatch `json:"matches"`
	Score     float64  `json:"score"`
}

type SearchMatch struct {
	Line     int    `json:"line"`
	Content  string `json:"content"`
	Start    int    `json:"start"`
	End      int    `json:"end"`
}

type SearchResponse struct {
	Results []SearchResult `json:"results"`
	Total   int           `json:"total"`
	Query   string        `json:"query"`
}

// Global variables
var (
	workspaceDir    string
	gitRepo         *git.Repository
	currentWorkspace *Workspace
	configDir       string
	userDataFile    string
	workspaceConfigFile string
)

func init() {
	// Setup config directory
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Fatal("Failed to get home directory:", err)
	}
	configDir = filepath.Join(homeDir, ".md-office")
	userDataFile = filepath.Join(configDir, "users.json")
	workspaceConfigFile = filepath.Join(configDir, "workspaces.json")

	// Create config directory
	if err := os.MkdirAll(configDir, 0755); err != nil {
		log.Fatal("Failed to create config directory:", err)
	}

	// Initialize default workspace
	workspaceDir = "./workspace"
	if envPath := os.Getenv("WORKSPACE_PATH"); envPath != "" {
		workspaceDir = envPath
	}
	abs, err := filepath.Abs(workspaceDir)
	if err == nil {
		workspaceDir = abs
	}
}

func main() {
	log.Println("Starting MD Office server...")
	
	// Initialize workspace and git
	if err := initializeApp(); err != nil {
		log.Fatal("Failed to initialize app:", err)
	}

	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			return c.JSON(APIResponse{Error: err.Error()})
		},
	})

	// Enable CORS
	app.Use(cors.New())

	// API routes
	api := app.Group("/api")

	// Authentication routes
	auth := api.Group("/auth")
	auth.Post("/register", register)
	auth.Post("/login", login)
	auth.Get("/me", authMiddleware, getCurrentUser)

	// Protected routes (require authentication)
	protected := api.Group("/", authMiddleware)

	// Workspace management
	workspaces := protected.Group("/workspaces")
	workspaces.Get("/", getWorkspaces)
	workspaces.Post("/", createWorkspace)
	workspaces.Post("/switch", switchWorkspace)
	workspaces.Get("/:id/members", getWorkspaceMembers)
	workspaces.Post("/:id/members", addWorkspaceMember)
	workspaces.Delete("/:id/members/:userId", removeWorkspaceMember)

	// File operations
	files := protected.Group("/files")
	files.Get("/", getFiles)
	files.Get("/:path", getFile)
	files.Post("/", saveFile)
	files.Post("/create", createFile)
	files.Post("/mkdir", createDirectory)
	files.Delete("/:path", deleteItem)
	files.Put("/rename", renameItem)
	files.Post("/upload", uploadFile)

	// Search operations
	search := protected.Group("/search")
	search.Get("/", searchFiles)

	// Git operations
	gitRoutes := protected.Group("/git")
	gitRoutes.Get("/history", getGitHistory)
	gitRoutes.Post("/revert", revertToCommit)
	gitRoutes.Get("/diff", getGitDiff)
	gitRoutes.Get("/branches", getBranches)
	gitRoutes.Post("/branches", createBranch)
	gitRoutes.Post("/checkout", checkoutBranch)
	gitRoutes.Post("/merge", mergeBranch)

	// Serve static files (frontend)
	app.Static("/", "../frontend/dist")

	// Catch all for SPA routing
	app.Get("/*", func(c *fiber.Ctx) error {
		return c.SendFile("../frontend/dist/index.html")
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Server starting on port %s...", port)
	log.Fatal(app.Listen(":" + port))
}

func initializeApp() error {
	// Load or create workspace configuration
	if err := loadWorkspaceConfig(); err != nil {
		return err
	}

	// Create default workspace if none exists
	if currentWorkspace == nil {
		if err := createDefaultWorkspace(); err != nil {
			return err
		}
	}

	// Initialize Git repository for current workspace
	if err := initGitRepo(); err != nil {
		log.Printf("Git initialization failed: %v", err)
		log.Println("Continuing without git support...")
		gitRepo = nil
	}

	return nil
}

func loadWorkspaceConfig() error {
	data, err := ioutil.ReadFile(workspaceConfigFile)
	if err != nil {
		if os.IsNotExist(err) {
			// Create empty config
			config := WorkspaceConfig{
				Workspaces: []Workspace{},
			}
			return saveWorkspaceConfig(&config)
		}
		return err
	}

	var config WorkspaceConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return err
	}

	// Find current workspace
	for _, ws := range config.Workspaces {
		if ws.ID == config.ActiveWorkspace {
			currentWorkspace = &ws
			workspaceDir = ws.Path
			break
		}
	}

	return nil
}

func saveWorkspaceConfig(config *WorkspaceConfig) error {
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}
	return ioutil.WriteFile(workspaceConfigFile, data, 0644)
}

func createDefaultWorkspace() error {
	// Create workspace directory
	if err := os.MkdirAll(workspaceDir, 0755); err != nil {
		return err
	}

	// Generate workspace ID
	workspaceID := generateID()

	workspace := Workspace{
		ID:        workspaceID,
		Name:      "Default Workspace",
		Path:      workspaceDir,
		Owner:     "system", // Will be updated when first user registers
		CreatedAt: time.Now(),
		Members:   []WorkspaceMember{},
		Permissions: make(map[string]string),
	}

	config := WorkspaceConfig{
		Workspaces:     []Workspace{workspace},
		ActiveWorkspace: workspaceID,
	}

	currentWorkspace = &workspace
	return saveWorkspaceConfig(&config)
}

func generateID() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// Authentication middleware
func authMiddleware(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return c.Status(401).JSON(APIResponse{Error: "Authorization header required"})
	}

	tokenString := strings.TrimPrefix(authHeader, "Bearer ")
	
	claims := &JWTClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})

	if err != nil || !token.Valid {
		return c.Status(401).JSON(APIResponse{Error: "Invalid token"})
	}

	// Store user info in context
	c.Locals("userID", claims.UserID)
	c.Locals("username", claims.Username)
	
	return c.Next()
}

// Authentication handlers
func register(c *fiber.Ctx) error {
	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.JSON(APIResponse{Error: "Invalid request body"})
	}

	// Validate input
	if req.Username == "" || req.Password == "" {
		return c.JSON(APIResponse{Error: "Username and password required"})
	}

	// Load existing users
	userStorage, err := loadUsers()
	if err != nil {
		return c.JSON(APIResponse{Error: "Failed to load user data"})
	}

	// Check if username already exists
	for _, user := range userStorage.Users {
		if user.Username == req.Username {
			return c.JSON(APIResponse{Error: "Username already exists"})
		}
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.JSON(APIResponse{Error: "Failed to hash password"})
	}

	// Create user
	userID := generateID()
	user := User{
		ID:           userID,
		Username:     req.Username,
		PasswordHash: string(hashedPassword),
		CreatedAt:    time.Now(),
	}

	userStorage.Users = append(userStorage.Users, user)

	// Save users
	if err := saveUsers(userStorage); err != nil {
		return c.JSON(APIResponse{Error: "Failed to save user data"})
	}

	// Update workspace owner if this is the first user
	if currentWorkspace != nil && currentWorkspace.Owner == "system" {
		config, err := loadWorkspaceConfigObject()
		if err == nil {
			for i := range config.Workspaces {
				if config.Workspaces[i].ID == currentWorkspace.ID {
					config.Workspaces[i].Owner = userID
					// Initialize permissions map if nil
					if config.Workspaces[i].Permissions == nil {
						config.Workspaces[i].Permissions = make(map[string]string)
					}
					config.Workspaces[i].Permissions[userID] = "owner"
					config.Workspaces[i].Members = []WorkspaceMember{
						{
							UserID:     userID,
							Username:   req.Username,
							Permission: "owner",
							JoinedAt:   time.Now(),
						},
					}
					// Update the currentWorkspace pointer with the corrected data
					currentWorkspace = &config.Workspaces[i]
					saveWorkspaceConfig(config)
					break
				}
			}
		}
	}

	// Generate JWT token
	token, err := generateJWT(userID, req.Username)
	if err != nil {
		return c.JSON(APIResponse{Error: "Failed to generate token"})
	}

	return c.JSON(APIResponse{Data: AuthResponse{
		Token: token,
		User:  SafeUser{ID: user.ID, Username: user.Username, CreatedAt: user.CreatedAt},
	}})
}

func login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.JSON(APIResponse{Error: "Invalid request body"})
	}

	// Load users
	userStorage, err := loadUsers()
	if err != nil {
		return c.JSON(APIResponse{Error: "Failed to load user data"})
	}

	// Find user
	var user *User
	for _, u := range userStorage.Users {
		if u.Username == req.Username {
			user = &u
			break
		}
	}

	if user == nil {
		return c.JSON(APIResponse{Error: "Invalid credentials"})
	}

	// Check password
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))
	if err != nil {
		return c.JSON(APIResponse{Error: "Invalid credentials"})
	}

	// Generate JWT token
	token, err := generateJWT(user.ID, user.Username)
	if err != nil {
		return c.JSON(APIResponse{Error: "Failed to generate token"})
	}

	return c.JSON(APIResponse{Data: AuthResponse{
		Token: token,
		User:  SafeUser{ID: user.ID, Username: user.Username, CreatedAt: user.CreatedAt},
	}})
}

func getCurrentUser(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	_ = c.Locals("username").(string) // username unused for now

	userStorage, err := loadUsers()
	if err != nil {
		return c.JSON(APIResponse{Error: "Failed to load user data"})
	}

	for _, user := range userStorage.Users {
		if user.ID == userID {
			return c.JSON(APIResponse{Data: SafeUser{ID: user.ID, Username: user.Username, CreatedAt: user.CreatedAt}})
		}
	}

	return c.JSON(APIResponse{Error: "User not found"})
}

func generateJWT(userID, username string) (string, error) {
	claims := JWTClaims{
		UserID:   userID,
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

func loadUsers() (*UserStorage, error) {
	data, err := ioutil.ReadFile(userDataFile)
	if err != nil {
		if os.IsNotExist(err) {
			return &UserStorage{Users: []User{}}, nil
		}
		return nil, err
	}

	var userStorage UserStorage
	err = json.Unmarshal(data, &userStorage)
	return &userStorage, err
}

func saveUsers(userStorage *UserStorage) error {
	data, err := json.MarshalIndent(userStorage, "", "  ")
	if err != nil {
		return err
	}
	return ioutil.WriteFile(userDataFile, data, 0644)
}

// Workspace management handlers
func getWorkspaces(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	
	config, err := loadWorkspaceConfigObject()
	if err != nil {
		return c.JSON(APIResponse{Error: "Failed to load workspaces"})
	}

	// Filter workspaces that user has access to
	var accessibleWorkspaces []Workspace
	for _, ws := range config.Workspaces {
		if _, hasAccess := ws.Permissions[userID]; hasAccess || ws.Owner == userID {
			// User has access to this workspace
			workspaceCopy := ws
			// Add current flag
			if ws.ID == config.ActiveWorkspace {
				// You might want to add a Current field to Workspace struct
			}
			accessibleWorkspaces = append(accessibleWorkspaces, workspaceCopy)
		}
	}

	return c.JSON(APIResponse{Data: map[string]interface{}{
		"workspaces": accessibleWorkspaces,
		"active":     config.ActiveWorkspace,
	}})
}

func createWorkspace(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	username := c.Locals("username").(string)

	var req CreateWorkspaceRequest
	if err := c.BodyParser(&req); err != nil {
		return c.JSON(APIResponse{Error: "Invalid request body"})
	}

	// Create workspace directory
	if err := os.MkdirAll(req.Path, 0755); err != nil {
		return c.JSON(APIResponse{Error: "Failed to create workspace directory"})
	}

	workspaceID := generateID()
	workspace := Workspace{
		ID:        workspaceID,
		Name:      req.Name,
		Path:      req.Path,
		Owner:     userID,
		CreatedAt: time.Now(),
		Members: []WorkspaceMember{
			{
				UserID:     userID,
				Username:   username,
				Permission: "owner",
				JoinedAt:   time.Now(),
			},
		},
		Permissions: map[string]string{
			userID: "owner",
		},
	}

	config, err := loadWorkspaceConfigObject()
	if err != nil {
		return c.JSON(APIResponse{Error: "Failed to load workspace config"})
	}

	config.Workspaces = append(config.Workspaces, workspace)

	if err := saveWorkspaceConfig(config); err != nil {
		return c.JSON(APIResponse{Error: "Failed to save workspace config"})
	}

	return c.JSON(APIResponse{Data: workspace})
}

func switchWorkspace(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	var req SwitchWorkspaceRequest
	if err := c.BodyParser(&req); err != nil {
		return c.JSON(APIResponse{Error: "Invalid request body"})
	}

	config, err := loadWorkspaceConfigObject()
	if err != nil {
		return c.JSON(APIResponse{Error: "Failed to load workspace config"})
	}

	// Find workspace and check access
	var targetWorkspace *Workspace
	for _, ws := range config.Workspaces {
		if ws.ID == req.WorkspaceID {
			if _, hasAccess := ws.Permissions[userID]; hasAccess || ws.Owner == userID {
				targetWorkspace = &ws
				break
			} else {
				return c.JSON(APIResponse{Error: "Access denied to workspace"})
			}
		}
	}

	if targetWorkspace == nil {
		return c.JSON(APIResponse{Error: "Workspace not found"})
	}

	// Update active workspace
	config.ActiveWorkspace = req.WorkspaceID
	currentWorkspace = targetWorkspace
	workspaceDir = targetWorkspace.Path

	if err := saveWorkspaceConfig(config); err != nil {
		return c.JSON(APIResponse{Error: "Failed to save workspace config"})
	}

	// Initialize Git for new workspace
	if err := initGitRepo(); err != nil {
		log.Printf("Git initialization failed: %v", err)
		gitRepo = nil
	}

	return c.JSON(APIResponse{Data: "Workspace switched successfully"})
}

func loadWorkspaceConfigObject() (*WorkspaceConfig, error) {
	data, err := ioutil.ReadFile(workspaceConfigFile)
	if err != nil {
		if os.IsNotExist(err) {
			return &WorkspaceConfig{Workspaces: []Workspace{}}, nil
		}
		return nil, err
	}

	var config WorkspaceConfig
	err = json.Unmarshal(data, &config)
	return &config, err
}

// Workspace member management
func getWorkspaceMembers(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	workspaceID := c.Params("id")

	config, err := loadWorkspaceConfigObject()
	if err != nil {
		return c.JSON(APIResponse{Error: "Failed to load workspace config"})
	}

	for _, ws := range config.Workspaces {
		if ws.ID == workspaceID {
			// Check if user has access to this workspace
			if _, hasAccess := ws.Permissions[userID]; !hasAccess && ws.Owner != userID {
				return c.JSON(APIResponse{Error: "Access denied"})
			}
			return c.JSON(APIResponse{Data: ws.Members})
		}
	}

	return c.JSON(APIResponse{Error: "Workspace not found"})
}

func addWorkspaceMember(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	workspaceID := c.Params("id")

	var req InviteUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.JSON(APIResponse{Error: "Invalid request body"})
	}

	// Validate permission level
	if req.Permission != "editor" && req.Permission != "viewer" {
		return c.JSON(APIResponse{Error: "Invalid permission level"})
	}

	// Find the user to invite
	userStorage, err := loadUsers()
	if err != nil {
		return c.JSON(APIResponse{Error: "Failed to load user data"})
	}

	var invitedUser *User
	for _, user := range userStorage.Users {
		if user.Username == req.Username {
			invitedUser = &user
			break
		}
	}

	if invitedUser == nil {
		return c.JSON(APIResponse{Error: "User not found"})
	}

	config, err := loadWorkspaceConfigObject()
	if err != nil {
		return c.JSON(APIResponse{Error: "Failed to load workspace config"})
	}

	for i, ws := range config.Workspaces {
		if ws.ID == workspaceID {
			// Check if current user is owner or has edit permissions
			if ws.Owner != userID {
				if permission, hasAccess := ws.Permissions[userID]; !hasAccess || permission == "viewer" {
					return c.JSON(APIResponse{Error: "Insufficient permissions"})
				}
			}

			// Check if user is already a member
			for _, member := range ws.Members {
				if member.UserID == invitedUser.ID {
					return c.JSON(APIResponse{Error: "User is already a member"})
				}
			}

			// Add member
			newMember := WorkspaceMember{
				UserID:     invitedUser.ID,
				Username:   invitedUser.Username,
				Permission: req.Permission,
				JoinedAt:   time.Now(),
			}

			config.Workspaces[i].Members = append(config.Workspaces[i].Members, newMember)
			config.Workspaces[i].Permissions[invitedUser.ID] = req.Permission

			if err := saveWorkspaceConfig(config); err != nil {
				return c.JSON(APIResponse{Error: "Failed to save workspace config"})
			}

			return c.JSON(APIResponse{Data: newMember})
		}
	}

	return c.JSON(APIResponse{Error: "Workspace not found"})
}

func removeWorkspaceMember(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	workspaceID := c.Params("id")
	memberUserID := c.Params("userId")

	config, err := loadWorkspaceConfigObject()
	if err != nil {
		return c.JSON(APIResponse{Error: "Failed to load workspace config"})
	}

	for i, ws := range config.Workspaces {
		if ws.ID == workspaceID {
			// Only owner can remove members
			if ws.Owner != userID {
				return c.JSON(APIResponse{Error: "Only workspace owner can remove members"})
			}

			// Cannot remove owner
			if memberUserID == ws.Owner {
				return c.JSON(APIResponse{Error: "Cannot remove workspace owner"})
			}

			// Remove member
			var newMembers []WorkspaceMember
			for _, member := range ws.Members {
				if member.UserID != memberUserID {
					newMembers = append(newMembers, member)
				}
			}

			config.Workspaces[i].Members = newMembers
			delete(config.Workspaces[i].Permissions, memberUserID)

			if err := saveWorkspaceConfig(config); err != nil {
				return c.JSON(APIResponse{Error: "Failed to save workspace config"})
			}

			return c.JSON(APIResponse{Data: "Member removed successfully"})
		}
	}

	return c.JSON(APIResponse{Error: "Workspace not found"})
}

// Git repository initialization
func initGitRepo() error {
	// Try to open existing repository
	repo, err := git.PlainOpen(workspaceDir)
	if err != nil {
		// If repository doesn't exist, create it
		repo, err = git.PlainInit(workspaceDir, false)
		if err != nil {
			return fmt.Errorf("failed to initialize git repository: %w", err)
		}

		// Create initial commit
		worktree, err := repo.Worktree()
		if err != nil {
			return err
		}

		// Create a README file
		readmePath := filepath.Join(workspaceDir, "README.md")
		err = ioutil.WriteFile(readmePath, []byte("# MD Office Workspace\n\nWelcome to your markdown workspace!\n"), 0644)
		if err != nil {
			return err
		}

		_, err = worktree.Add("README.md")
		if err != nil {
			return err
		}

		_, err = worktree.Commit("Initial commit", &git.CommitOptions{
			Author: &object.Signature{
				Name:  "MD Office",
				Email: "mdoffice@example.com",
				When:  time.Now(),
			},
		})
		if err != nil {
			return err
		}
	}

	gitRepo = repo
	return nil
}

// Git branch operations
func getBranches(c *fiber.Ctx) error {
	if gitRepo == nil {
		return c.JSON(APIResponse{Data: []GitBranch{}})
	}

	refs, err := gitRepo.References()
	if err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	head, err := gitRepo.Head()
	if err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	currentBranch := head.Name().Short()
	var branches []GitBranch

	err = refs.ForEach(func(ref *plumbing.Reference) error {
		if ref.Name().IsBranch() {
			branchName := ref.Name().Short()
			branches = append(branches, GitBranch{
				Name:      branchName,
				IsCurrent: branchName == currentBranch,
				Hash:      ref.Hash().String(),
			})
		}
		return nil
	})

	if err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	return c.JSON(APIResponse{Data: branches})
}

func createBranch(c *fiber.Ctx) error {
	if gitRepo == nil {
		return c.JSON(APIResponse{Error: "Git repository not available"})
	}

	var req CreateBranchRequest
	if err := c.BodyParser(&req); err != nil {
		return c.JSON(APIResponse{Error: "Invalid request body"})
	}

	head, err := gitRepo.Head()
	if err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	branchRef := plumbing.NewBranchReferenceName(req.Name)
	ref := plumbing.NewHashReference(branchRef, head.Hash())

	err = gitRepo.Storer.SetReference(ref)
	if err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	return c.JSON(APIResponse{Data: fmt.Sprintf("Branch %s created successfully", req.Name)})
}

func checkoutBranch(c *fiber.Ctx) error {
	if gitRepo == nil {
		return c.JSON(APIResponse{Error: "Git repository not available"})
	}

	var req CheckoutBranchRequest
	if err := c.BodyParser(&req); err != nil {
		return c.JSON(APIResponse{Error: "Invalid request body"})
	}

	worktree, err := gitRepo.Worktree()
	if err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	err = worktree.Checkout(&git.CheckoutOptions{
		Branch: plumbing.NewBranchReferenceName(req.Name),
	})
	if err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	return c.JSON(APIResponse{Data: fmt.Sprintf("Switched to branch %s", req.Name)})
}

func mergeBranch(c *fiber.Ctx) error {
	if gitRepo == nil {
		return c.JSON(APIResponse{Error: "Git repository not available"})
	}

	var req MergeBranchRequest
	if err := c.BodyParser(&req); err != nil {
		return c.JSON(APIResponse{Error: "Invalid request body"})
	}

	// This is a simplified merge - in production you'd want proper merge handling
	worktree, err := gitRepo.Worktree()
	if err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	// Get the branch reference
	branchRef, err := gitRepo.Reference(plumbing.NewBranchReferenceName(req.Branch), true)
	if err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	// Get the commit object
	commit, err := gitRepo.CommitObject(branchRef.Hash())
	if err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	// Simple strategy: create a merge commit
	// In a real implementation, you'd check for conflicts, etc.
	head, err := gitRepo.Head()
	if err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	headCommit, err := gitRepo.CommitObject(head.Hash())
	if err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	// Create merge commit
	_, err = worktree.Commit(fmt.Sprintf("Merge branch '%s'", req.Branch), &git.CommitOptions{
		Author: &object.Signature{
			Name:  "MD Office",
			Email: "mdoffice@example.com",
			When:  time.Now(),
		},
		Parents: []plumbing.Hash{headCommit.Hash, commit.Hash},
	})
	if err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	return c.JSON(APIResponse{Data: fmt.Sprintf("Branch %s merged successfully", req.Branch)})
}

// File operations (updated with permission checks)
func checkWorkspacePermission(userID string, requiredLevel string) error {
	if currentWorkspace == nil {
		return fmt.Errorf("no active workspace")
	}

	// Refresh workspace info to ensure we have the latest permissions
	config, err := loadWorkspaceConfigObject()
	if err == nil {
		for i := range config.Workspaces {
			if config.Workspaces[i].ID == currentWorkspace.ID {
				currentWorkspace = &config.Workspaces[i]
				break
			}
		}
	}

	// Owner has all permissions
	if currentWorkspace.Owner == userID {
		return nil
	}

	permission, hasAccess := currentWorkspace.Permissions[userID]
	if !hasAccess {
		return fmt.Errorf("no access to workspace")
	}

	// Permission levels: owner > editor > viewer
	switch requiredLevel {
	case "viewer":
		// Anyone with access can view
		return nil
	case "editor":
		// Need editor or owner permission
		if permission == "editor" || permission == "owner" {
			return nil
		}
	case "owner":
		// Need owner permission
		if permission == "owner" {
			return nil
		}
	}

	return fmt.Errorf("insufficient permissions")
}

func buildFileTree(dir string, basePath string) ([]FileSystemItem, error) {
	files, err := ioutil.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	var items []FileSystemItem
	for _, file := range files {
		// Skip .git directory
		if file.Name() == ".git" {
			continue
		}

		relativePath := file.Name()
		if basePath != "" {
			relativePath = filepath.Join(basePath, file.Name())
		}

		item := FileSystemItem{
			Name:        file.Name(),
			Path:        relativePath,
			IsDirectory: file.IsDir(),
		}

		if file.IsDir() {
			children, err := buildFileTree(filepath.Join(dir, file.Name()), relativePath)
			if err != nil {
				continue // Skip directories we can't read
			}
			item.Children = &children
		}

		items = append(items, item)
	}

	return items, nil
}

func getFiles(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	
	if err := checkWorkspacePermission(userID, "viewer"); err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	files, err := buildFileTree(workspaceDir, "")
	if err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}
	return c.JSON(APIResponse{Data: files})
}

func getFile(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	
	if err := checkWorkspacePermission(userID, "viewer"); err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	path := c.Params("path")
	if path == "" {
		return c.JSON(APIResponse{Error: "Path is required"})
	}

	fullPath := filepath.Join(workspaceDir, path)

	// Security check: ensure path is within workspace
	if !strings.HasPrefix(fullPath, workspaceDir) {
		return c.JSON(APIResponse{Error: "Access denied"})
	}

	content, err := ioutil.ReadFile(fullPath)
	if err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	stat, err := os.Stat(fullPath)
	if err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	fileContent := FileContent{
		Path:         path,
		Content:      string(content),
		LastModified: stat.ModTime().Format(time.RFC3339),
	}

	return c.JSON(APIResponse{Data: fileContent})
}

func saveFile(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	
	if err := checkWorkspacePermission(userID, "editor"); err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	var req SaveFileRequest
	if err := c.BodyParser(&req); err != nil {
		return c.JSON(APIResponse{Error: "Invalid request body"})
	}

	fullPath := filepath.Join(workspaceDir, req.Path)

	// Security check
	if !strings.HasPrefix(fullPath, workspaceDir) {
		return c.JSON(APIResponse{Error: "Access denied"})
	}

	// Create directory if it doesn't exist
	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	// Write file
	if err := ioutil.WriteFile(fullPath, []byte(req.Content), 0644); err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	// Git commit
	username := c.Locals("username").(string)
	if err := commitChangesWithAuthor(fmt.Sprintf("Update %s", req.Path), username); err != nil {
		log.Printf("Failed to commit changes: %v", err)
		// Don't fail the request if git commit fails
	}

	return c.JSON(APIResponse{Data: "File saved successfully"})
}

func createFile(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	
	if err := checkWorkspacePermission(userID, "editor"); err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	var req CreateFileRequest
	if err := c.BodyParser(&req); err != nil {
		return c.JSON(APIResponse{Error: "Invalid request body"})
	}

	fullPath := filepath.Join(workspaceDir, req.Path)

	// Security check
	if !strings.HasPrefix(fullPath, workspaceDir) {
		return c.JSON(APIResponse{Error: "Access denied"})
	}

	// Check if file already exists
	if _, err := os.Stat(fullPath); err == nil {
		return c.JSON(APIResponse{Error: "File already exists"})
	}

	// Create directory if needed
	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	// Create file
	if err := ioutil.WriteFile(fullPath, []byte(req.Content), 0644); err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	// Git commit
	username := c.Locals("username").(string)
	if err := commitChangesWithAuthor(fmt.Sprintf("Create %s", req.Path), username); err != nil {
		log.Printf("Failed to commit changes: %v", err)
	}

	return c.JSON(APIResponse{Data: "File created successfully"})
}

func createDirectory(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	
	if err := checkWorkspacePermission(userID, "editor"); err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	var req CreateDirRequest
	if err := c.BodyParser(&req); err != nil {
		return c.JSON(APIResponse{Error: "Invalid request body"})
	}

	fullPath := filepath.Join(workspaceDir, req.Path)

	// Security check
	if !strings.HasPrefix(fullPath, workspaceDir) {
		return c.JSON(APIResponse{Error: "Access denied"})
	}

	if err := os.MkdirAll(fullPath, 0755); err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	return c.JSON(APIResponse{Data: "Directory created successfully"})
}

func deleteItem(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	
	if err := checkWorkspacePermission(userID, "editor"); err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	path := c.Params("path")
	if path == "" {
		return c.JSON(APIResponse{Error: "Path is required"})
	}

	fullPath := filepath.Join(workspaceDir, path)

	// Security check
	if !strings.HasPrefix(fullPath, workspaceDir) {
		return c.JSON(APIResponse{Error: "Access denied"})
	}

	if err := os.RemoveAll(fullPath); err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	// Git commit
	username := c.Locals("username").(string)
	if err := commitChangesWithAuthor(fmt.Sprintf("Delete %s", path), username); err != nil {
		log.Printf("Failed to commit changes: %v", err)
	}

	return c.JSON(APIResponse{Data: "Item deleted successfully"})
}

func renameItem(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	
	if err := checkWorkspacePermission(userID, "editor"); err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	var req RenameRequest
	if err := c.BodyParser(&req); err != nil {
		return c.JSON(APIResponse{Error: "Invalid request body"})
	}

	oldPath := filepath.Join(workspaceDir, req.OldPath)
	newPath := filepath.Join(workspaceDir, req.NewPath)

	// Security checks
	if !strings.HasPrefix(oldPath, workspaceDir) || !strings.HasPrefix(newPath, workspaceDir) {
		return c.JSON(APIResponse{Error: "Access denied"})
	}

	if err := os.Rename(oldPath, newPath); err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	// Git commit
	username := c.Locals("username").(string)
	if err := commitChangesWithAuthor(fmt.Sprintf("Rename %s to %s", req.OldPath, req.NewPath), username); err != nil {
		log.Printf("Failed to commit changes: %v", err)
	}

	return c.JSON(APIResponse{Data: "Item renamed successfully"})
}

func commitChangesWithAuthor(message, authorName string) error {
	if gitRepo == nil {
		return nil // No git repository available
	}
	
	worktree, err := gitRepo.Worktree()
	if err != nil {
		return err
	}

	// Add all changes
	err = worktree.AddGlob(".")
	if err != nil {
		return err
	}

	// Commit changes
	_, err = worktree.Commit(message, &git.CommitOptions{
		Author: &object.Signature{
			Name:  authorName,
			Email: fmt.Sprintf("%s@mdoffice.local", authorName),
			When:  time.Now(),
		},
	})
	return err
}

func getGitHistory(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	
	if err := checkWorkspacePermission(userID, "viewer"); err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	if gitRepo == nil {
		return c.JSON(APIResponse{Data: GitHistory{Commits: []GitCommit{}}})
	}
	
	pathFilter := c.Query("path")

	// Get commit history
	logs, err := gitRepo.Log(&git.LogOptions{})
	if err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	var commits []GitCommit
	err = logs.ForEach(func(commit *object.Commit) error {
		// If path filter is specified, check if this commit affects the path
		if pathFilter != "" {
			// This is a simplified check. In a more robust implementation,
			// you'd check the commit's file changes
			if !strings.Contains(commit.Message, pathFilter) {
				return nil // Skip this commit
			}
		}

		commits = append(commits, GitCommit{
			Hash:    commit.Hash.String(),
			Message: commit.Message,
			Author:  commit.Author.Name,
			Date:    commit.Author.When.Format(time.RFC3339),
		})
		return nil
	})

	if err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	history := GitHistory{Commits: commits}
	return c.JSON(APIResponse{Data: history})
}

func revertToCommit(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	
	if err := checkWorkspacePermission(userID, "editor"); err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	if gitRepo == nil {
		return c.JSON(APIResponse{Error: "Git repository not available"})
	}
	
	var req RevertRequest
	if err := c.BodyParser(&req); err != nil {
		return c.JSON(APIResponse{Error: "Invalid request body"})
	}

	hash := plumbing.NewHash(req.Hash)
	commit, err := gitRepo.CommitObject(hash)
	if err != nil {
		return c.JSON(APIResponse{Error: "Invalid commit hash"})
	}

	worktree, err := gitRepo.Worktree()
	if err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	// Reset to the specified commit
	err = worktree.Reset(&git.ResetOptions{
		Commit: hash,
		Mode:   git.HardReset,
	})
	if err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	// Create a new commit for this revert
	username := c.Locals("username").(string)
	if err := commitChangesWithAuthor(fmt.Sprintf("Revert to %s", req.Hash[:7]), username); err != nil {
		log.Printf("Failed to commit revert: %v", err)
	}

	return c.JSON(APIResponse{Data: fmt.Sprintf("Reverted to commit %s", commit.Hash.String()[:7])})
}

func getGitDiff(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	
	if err := checkWorkspacePermission(userID, "viewer"); err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	if gitRepo == nil {
		return c.JSON(APIResponse{Error: "Git repository not available"})
	}

	// Get query parameters
	fromCommit := c.Query("from", "")
	toCommit := c.Query("to", "HEAD")
	filePath := c.Query("file", "")

	// If no from commit specified, show working directory changes
	if fromCommit == "" {
		worktree, err := gitRepo.Worktree()
		if err != nil {
			return c.JSON(APIResponse{Error: err.Error()})
		}

		status, err := worktree.Status()
		if err != nil {
			return c.JSON(APIResponse{Error: err.Error()})
		}

		var changes []GitDiffChange
		for file, fileStatus := range status {
			if filePath != "" && file != filePath {
				continue
			}

			var changeType string
			switch {
			case fileStatus.Staging == git.Added:
				changeType = "added"
			case fileStatus.Staging == git.Modified:
				changeType = "modified"
			case fileStatus.Staging == git.Deleted:
				changeType = "deleted"
			case fileStatus.Worktree == git.Modified:
				changeType = "modified"
			case fileStatus.Worktree == git.Deleted:
				changeType = "deleted"
			default:
				changeType = "unknown"
			}

			changes = append(changes, GitDiffChange{
				File:       file,
				Type:       changeType,
				Additions:  0, // Would need file content comparison
				Deletions:  0, // Would need file content comparison
				Content:    "", // Could implement unified diff format
			})
		}

		diff := GitDiff{
			From:    "working-directory",
			To:      "HEAD",
			Changes: changes,
		}
		return c.JSON(APIResponse{Data: diff})
	}

	// Compare two commits
	fromHash := plumbing.NewHash(fromCommit)
	toHash := plumbing.NewHash(toCommit)

	fromCommitObj, err := gitRepo.CommitObject(fromHash)
	if err != nil {
		return c.JSON(APIResponse{Error: "Invalid from commit: " + err.Error()})
	}

	toCommitObj, err := gitRepo.CommitObject(toHash)
	if err != nil {
		return c.JSON(APIResponse{Error: "Invalid to commit: " + err.Error()})
	}

	// Basic diff implementation - in production you'd use git.PlainDiff
	diff := GitDiff{
		From:    fromCommit,
		To:      toCommit,
		Changes: []GitDiffChange{}, // Placeholder for now
		Summary: fmt.Sprintf("Comparing %s to %s", fromCommitObj.Hash.String()[:7], toCommitObj.Hash.String()[:7]),
	}

	return c.JSON(APIResponse{Data: diff})
}

func uploadFile(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	
	if err := checkWorkspacePermission(userID, "editor"); err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	// Get the uploaded file
	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(APIResponse{Error: "No file provided"})
	}

	// Get upload directory (default to assets/)
	uploadDir := c.FormValue("dir")
	if uploadDir == "" {
		uploadDir = "assets"
	}

	// Ensure upload directory exists
	uploadPath := filepath.Join(workspaceDir, uploadDir)
	if err := os.MkdirAll(uploadPath, 0755); err != nil {
		return c.JSON(APIResponse{Error: "Failed to create upload directory"})
	}

	// Generate safe filename
	safeFilename := generateSafeFilename(file.Filename)
	filePath := filepath.Join(uploadPath, safeFilename)

	// Check if file already exists and generate unique name if needed
	counter := 1
	for {
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			break
		}
		// File exists, generate new name
		ext := filepath.Ext(safeFilename)
		nameWithoutExt := strings.TrimSuffix(safeFilename, ext)
		filePath = filepath.Join(uploadPath, fmt.Sprintf("%s_%d%s", nameWithoutExt, counter, ext))
		counter++
	}

	// Save the file
	if err := c.SaveFile(file, filePath); err != nil {
		return c.JSON(APIResponse{Error: "Failed to save file"})
	}

	// Get file info
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return c.JSON(APIResponse{Error: "Failed to get file info"})
	}

	// Generate relative path and URL
	relativePath := strings.TrimPrefix(filePath, workspaceDir)
	relativePath = strings.TrimPrefix(relativePath, string(filepath.Separator))
	fileURL := fmt.Sprintf("/files/%s", relativePath)

	// Commit the upload to git
	username := c.Locals("username").(string)
	commitMessage := fmt.Sprintf("Upload file: %s", relativePath)
	if err := commitChangesWithAuthor(commitMessage, username); err != nil {
		log.Printf("Failed to commit file upload: %v", err)
	}

	response := UploadResponse{
		Filename: filepath.Base(filePath),
		Path:     relativePath,
		Size:     fileInfo.Size(),
		URL:      fileURL,
	}

	return c.JSON(APIResponse{Data: response})
}

func generateSafeFilename(filename string) string {
	// Remove/replace unsafe characters
	safe := strings.ReplaceAll(filename, " ", "_")
	safe = strings.ReplaceAll(safe, "..", "")
	safe = strings.ReplaceAll(safe, "/", "_")
	safe = strings.ReplaceAll(safe, "\\", "_")
	safe = strings.ReplaceAll(safe, "\x00", "")
	
	// Ensure filename is not empty
	if safe == "" {
		safe = "uploaded_file"
	}
	
	return safe
}

func searchFiles(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	
	if err := checkWorkspacePermission(userID, "viewer"); err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	query := c.Query("q", "")
	if query == "" {
		return c.JSON(APIResponse{Error: "Search query required"})
	}

	fileType := c.Query("type", "")
	limitStr := c.Query("limit", "50")
	limit := 50
	if l, err := fmt.Sscanf(limitStr, "%d", &limit); err != nil || l != 1 {
		limit = 50
	}

	var results []SearchResult
	
	// Walk through workspace directory
	err := filepath.Walk(workspaceDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Continue on errors
		}

		// Skip hidden files and directories
		if strings.HasPrefix(info.Name(), ".") {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		// Skip directories
		if info.IsDir() {
			return nil
		}

		// Filter by file type if specified
		if fileType != "" {
			ext := strings.TrimPrefix(filepath.Ext(path), ".")
			if ext != fileType {
				return nil
			}
		}

		// Only search text files (basic check)
		if !isTextFile(path) {
			return nil
		}

		// Search within file
		matches, score := searchInFile(path, query)
		if len(matches) > 0 {
			relativePath := strings.TrimPrefix(path, workspaceDir)
			relativePath = strings.TrimPrefix(relativePath, string(filepath.Separator))
			
			results = append(results, SearchResult{
				File:    relativePath,
				Matches: matches,
				Score:   score,
			})
		}

		// Limit total results
		if len(results) >= limit {
			return filepath.SkipAll
		}

		return nil
	})

	if err != nil {
		return c.JSON(APIResponse{Error: err.Error()})
	}

	response := SearchResponse{
		Results: results,
		Total:   len(results),
		Query:   query,
	}

	return c.JSON(APIResponse{Data: response})
}

func isTextFile(path string) bool {
	ext := strings.ToLower(filepath.Ext(path))
	textExts := []string{".md", ".txt", ".json", ".yaml", ".yml", ".html", ".css", ".js", ".ts", ".go", ".py", ".java", ".c", ".cpp", ".h", ".hpp"}
	
	for _, textExt := range textExts {
		if ext == textExt {
			return true
		}
	}
	return false
}

func searchInFile(path, query string) ([]SearchMatch, float64) {
	content, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, 0
	}

	lines := strings.Split(string(content), "\n")
	var matches []SearchMatch
	score := 0.0
	queryLower := strings.ToLower(query)

	for lineNum, line := range lines {
		lineLower := strings.ToLower(line)
		if strings.Contains(lineLower, queryLower) {
			start := strings.Index(lineLower, queryLower)
			end := start + len(query)
			
			matches = append(matches, SearchMatch{
				Line:    lineNum + 1, // 1-indexed
				Content: line,
				Start:   start,
				End:     end,
			})
			
			// Simple scoring: more matches = higher score
			score += 1.0
			
			// Bonus for exact case matches
			if strings.Contains(line, query) {
				score += 0.5
			}
		}
	}

	return matches, score
}