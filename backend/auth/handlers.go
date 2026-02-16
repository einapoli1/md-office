package auth

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// RegisterRoutes adds OAuth routes to the Fiber app.
func RegisterRoutes(app fiber.Router, authMiddleware fiber.Handler) {
	oauth := app.Group("/auth")

	// Start OAuth flow
	oauth.Get("/:provider", authMiddleware, startOAuth)
	// OAuth callback (no auth middleware - browser redirect)
	oauth.Get("/:provider/callback", oauthCallback)
	// Get current user's connected providers
	oauth.Get("/providers/connected", authMiddleware, getConnectedProviders)
	// Disconnect a provider
	oauth.Delete("/providers/:provider", authMiddleware, disconnectProvider)
	// Save a personal access token (Gitea fallback)
	oauth.Post("/providers/pat", authMiddleware, savePAT)
}

func generateState() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func startOAuth(c *fiber.Ctx) error {
	provider := c.Params("provider")
	if provider == "providers" {
		return c.Next()
	}
	userID := c.Locals("userID").(string)
	giteaURL := c.Query("gitea_url", "")

	if provider == "gitea" && giteaURL == "" {
		return c.Status(400).JSON(fiber.Map{"error": "gitea_url query parameter required for Gitea"})
	}

	validProviders := map[string]bool{"github": true, "gitlab": true, "bitbucket": true, "gitea": true}
	if !validProviders[provider] {
		return c.Status(400).JSON(fiber.Map{"error": "unsupported provider"})
	}

	state := generateState()
	if err := SaveOAuthState(state, userID, provider, giteaURL); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to save state"})
	}

	callbackURL := buildCallbackURL(c, provider)
	cfg := GetOAuthConfig(provider, giteaURL, callbackURL)
	if cfg == nil || cfg.ClientID == "" {
		return c.Status(400).JSON(fiber.Map{"error": fmt.Sprintf("%s OAuth not configured (missing env vars)", provider)})
	}

	authURL := cfg.AuthCodeURL(state)
	return c.JSON(fiber.Map{"url": authURL})
}

func oauthCallback(c *fiber.Ctx) error {
	code := c.Query("code")
	state := c.Query("state")
	if code == "" || state == "" {
		return c.Status(400).SendString("Missing code or state parameter")
	}

	userID, provider, giteaURL, err := ConsumeOAuthState(state)
	if err != nil {
		return c.Status(400).SendString("Invalid or expired OAuth state")
	}

	callbackURL := buildCallbackURL(c, provider)
	token, user, err := ExchangeCode(provider, giteaURL, code, callbackURL)
	if err != nil {
		return c.Status(500).SendString("OAuth exchange failed: " + err.Error())
	}

	rec := &TokenRecord{
		UserID:       userID,
		Provider:     provider,
		GiteaURL:     giteaURL,
		AccessToken:  token.AccessToken,
		RefreshToken: token.RefreshToken,
		TokenType:    token.TokenType,
		Expiry:       token.Expiry,
		Username:     user.Username,
		AvatarURL:    user.AvatarURL,
	}
	if err := SaveToken(rec); err != nil {
		return c.Status(500).SendString("Failed to save token: " + err.Error())
	}

	// Redirect to frontend with success
	return c.Redirect("/onboarding?provider=" + provider + "&connected=true")
}

func getConnectedProviders(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	tokens, err := GetTokensForUser(userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to load tokens"})
	}

	type ProviderInfo struct {
		Provider  string `json:"provider"`
		Username  string `json:"username"`
		AvatarURL string `json:"avatarUrl"`
		GiteaURL  string `json:"giteaUrl,omitempty"`
	}

	var providers []ProviderInfo
	for _, t := range tokens {
		providers = append(providers, ProviderInfo{
			Provider:  t.Provider,
			Username:  t.Username,
			AvatarURL: t.AvatarURL,
			GiteaURL:  t.GiteaURL,
		})
	}

	if providers == nil {
		providers = []ProviderInfo{}
	}

	return c.JSON(fiber.Map{"data": providers})
}

func disconnectProvider(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	provider := c.Params("provider")
	giteaURL := c.Query("gitea_url", "")

	if err := DeleteToken(userID, provider, giteaURL); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to disconnect"})
	}

	return c.JSON(fiber.Map{"data": "disconnected"})
}

func savePAT(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	var req struct {
		Provider string `json:"provider"`
		GiteaURL string `json:"giteaUrl"`
		Token    string `json:"token"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}

	if req.Token == "" {
		return c.Status(400).JSON(fiber.Map{"error": "token required"})
	}

	user, err := SaveTokenFromPAT(userID, req.Provider, req.GiteaURL, req.Token)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"data": fiber.Map{
		"provider": req.Provider,
		"username": user.Username,
		"avatarUrl": user.AvatarURL,
	}})
}

func buildCallbackURL(c *fiber.Ctx, provider string) string {
	proto := c.Get("X-Forwarded-Proto", "http")
	host := c.Get("X-Forwarded-Host", c.Hostname())
	if strings.Contains(host, "localhost") || strings.Contains(host, "127.0.0.1") {
		proto = "http"
	}
	return fmt.Sprintf("%s://%s/api/auth/%s/callback", proto, host, provider)
}
