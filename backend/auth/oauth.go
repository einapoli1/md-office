package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"
	"golang.org/x/oauth2/gitlab"
	"golang.org/x/oauth2/bitbucket"
)

// ProviderConfig holds OAuth configuration per provider.
type ProviderConfig struct {
	ClientID     string
	ClientSecret string
	Scopes       []string
	Endpoint     oauth2.Endpoint
}

// ProviderUser is the normalized user info from a provider.
type ProviderUser struct {
	ID        string `json:"id"`
	Username  string `json:"username"`
	Email     string `json:"email"`
	AvatarURL string `json:"avatarUrl"`
}

// GetOAuthConfig returns the oauth2.Config for a provider.
func GetOAuthConfig(provider, giteaURL, callbackURL string) *oauth2.Config {
	switch provider {
	case "github":
		return &oauth2.Config{
			ClientID:     os.Getenv("GITHUB_CLIENT_ID"),
			ClientSecret: os.Getenv("GITHUB_CLIENT_SECRET"),
			Scopes:       []string{"repo", "user:email"},
			Endpoint:     github.Endpoint,
			RedirectURL:  callbackURL,
		}
	case "gitlab":
		return &oauth2.Config{
			ClientID:     os.Getenv("GITLAB_CLIENT_ID"),
			ClientSecret: os.Getenv("GITLAB_CLIENT_SECRET"),
			Scopes:       []string{"read_user", "api"},
			Endpoint:     gitlab.Endpoint,
			RedirectURL:  callbackURL,
		}
	case "bitbucket":
		return &oauth2.Config{
			ClientID:     os.Getenv("BITBUCKET_CLIENT_ID"),
			ClientSecret: os.Getenv("BITBUCKET_CLIENT_SECRET"),
			Scopes:       []string{"repository", "account"},
			Endpoint:     bitbucket.Endpoint,
			RedirectURL:  callbackURL,
		}
	case "gitea":
		return &oauth2.Config{
			ClientID:     os.Getenv("GITEA_CLIENT_ID"),
			ClientSecret: os.Getenv("GITEA_CLIENT_SECRET"),
			Scopes:       []string{"repo", "user"},
			Endpoint: oauth2.Endpoint{
				AuthURL:  giteaURL + "/login/oauth/authorize",
				TokenURL: giteaURL + "/login/oauth/access_token",
			},
			RedirectURL: callbackURL,
		}
	}
	return nil
}

// ExchangeCode exchanges the authorization code for tokens and fetches user info.
func ExchangeCode(provider, giteaURL, code, callbackURL string) (*oauth2.Token, *ProviderUser, error) {
	cfg := GetOAuthConfig(provider, giteaURL, callbackURL)
	if cfg == nil {
		return nil, nil, fmt.Errorf("unknown provider: %s", provider)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	token, err := cfg.Exchange(ctx, code)
	if err != nil {
		return nil, nil, fmt.Errorf("exchange code: %w", err)
	}

	user, err := FetchProviderUser(provider, giteaURL, token.AccessToken)
	if err != nil {
		return nil, nil, fmt.Errorf("fetch user: %w", err)
	}

	return token, user, nil
}

// FetchProviderUser fetches user info from the provider API.
func FetchProviderUser(provider, giteaURL, accessToken string) (*ProviderUser, error) {
	switch provider {
	case "github":
		return fetchGitHubUser(accessToken)
	case "gitlab":
		return fetchGitLabUser(accessToken)
	case "bitbucket":
		return fetchBitbucketUser(accessToken)
	case "gitea":
		return fetchGiteaUser(giteaURL, accessToken)
	}
	return nil, fmt.Errorf("unknown provider: %s", provider)
}

func fetchGitHubUser(token string) (*ProviderUser, error) {
	data, err := apiGet("https://api.github.com/user", token)
	if err != nil {
		return nil, err
	}
	return &ProviderUser{
		ID:        fmt.Sprintf("%v", data["id"]),
		Username:  str(data["login"]),
		Email:     str(data["email"]),
		AvatarURL: str(data["avatar_url"]),
	}, nil
}

func fetchGitLabUser(token string) (*ProviderUser, error) {
	data, err := apiGet("https://gitlab.com/api/v4/user", token)
	if err != nil {
		return nil, err
	}
	return &ProviderUser{
		ID:        fmt.Sprintf("%v", data["id"]),
		Username:  str(data["username"]),
		Email:     str(data["email"]),
		AvatarURL: str(data["avatar_url"]),
	}, nil
}

func fetchBitbucketUser(token string) (*ProviderUser, error) {
	data, err := apiGet("https://api.bitbucket.org/2.0/user", token)
	if err != nil {
		return nil, err
	}
	links, _ := data["links"].(map[string]interface{})
	avatar := ""
	if a, ok := links["avatar"].(map[string]interface{}); ok {
		avatar = str(a["href"])
	}
	return &ProviderUser{
		ID:        str(data["uuid"]),
		Username:  str(data["username"]),
		Email:     str(data["email"]),
		AvatarURL: avatar,
	}, nil
}

func fetchGiteaUser(baseURL, token string) (*ProviderUser, error) {
	data, err := apiGet(baseURL+"/api/v1/user", token)
	if err != nil {
		return nil, err
	}
	return &ProviderUser{
		ID:        fmt.Sprintf("%v", data["id"]),
		Username:  str(data["login"]),
		Email:     str(data["email"]),
		AvatarURL: str(data["avatar_url"]),
	}, nil
}

func apiGet(url, token string) (map[string]interface{}, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, string(body))
	}

	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, err
	}
	return data, nil
}

func str(v interface{}) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}

// SaveTokenFromPAT stores a personal access token (for Gitea PAT fallback).
func SaveTokenFromPAT(userID, provider, giteaURL, pat string) (*ProviderUser, error) {
	user, err := FetchProviderUser(provider, giteaURL, pat)
	if err != nil {
		return nil, fmt.Errorf("validate PAT: %w", err)
	}

	rec := &TokenRecord{
		UserID:      userID,
		Provider:    provider,
		GiteaURL:    giteaURL,
		AccessToken: pat,
		TokenType:   "bearer",
		Username:    user.Username,
		AvatarURL:   user.AvatarURL,
	}
	if err := SaveToken(rec); err != nil {
		return nil, err
	}
	return user, nil
}
