package providers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

// Repo represents a git repository from any provider.
type Repo struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	FullName      string `json:"fullName"`
	Description   string `json:"description"`
	Private       bool   `json:"private"`
	DefaultBranch string `json:"defaultBranch"`
	CloneURL      string `json:"cloneUrl"`
	HTMLURL       string `json:"htmlUrl"`
	Owner         string `json:"owner"`
}

// Branch represents a branch on the remote.
type Branch struct {
	Name      string `json:"name"`
	Protected bool   `json:"protected"`
	IsDefault bool   `json:"isDefault"`
}

// PRRequest for creating a pull/merge request.
type PRRequest struct {
	Title      string `json:"title"`
	Body       string `json:"body"`
	Head       string `json:"head"` // source branch
	Base       string `json:"base"` // target branch
	RepoOwner  string `json:"repoOwner"`
	RepoName   string `json:"repoName"`
}

// PRResponse returned after creating a PR.
type PRResponse struct {
	ID      int    `json:"id"`
	Number  int    `json:"number"`
	HTMLURL string `json:"htmlUrl"`
	Title   string `json:"title"`
}

// CreateRepoRequest for creating new repos.
type CreateRepoRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Private     bool   `json:"private"`
	AutoInit    bool   `json:"autoInit"`
}

// Client wraps provider API calls.
type Client struct {
	Provider    string
	GiteaURL    string
	AccessToken string
}

// ListRepos returns repos for the authenticated user.
func (c *Client) ListRepos(page, perPage int, search string) ([]Repo, error) {
	switch c.Provider {
	case "github":
		return c.githubListRepos(page, perPage, search)
	case "gitlab":
		return c.gitlabListRepos(page, perPage, search)
	case "bitbucket":
		return c.bitbucketListRepos(page, perPage, search)
	case "gitea":
		return c.giteaListRepos(page, perPage, search)
	}
	return nil, fmt.Errorf("unsupported provider: %s", c.Provider)
}

// ListBranches returns branches for a repo.
func (c *Client) ListBranches(owner, repo string) ([]Branch, error) {
	switch c.Provider {
	case "github":
		return c.githubListBranches(owner, repo)
	case "gitlab":
		return c.gitlabListBranches(owner + "/" + repo)
	case "bitbucket":
		return c.bitbucketListBranches(owner, repo)
	case "gitea":
		return c.giteaListBranches(owner, repo)
	}
	return nil, fmt.Errorf("unsupported provider: %s", c.Provider)
}

// CreateRepo creates a new repository.
func (c *Client) CreateRepo(req CreateRepoRequest) (*Repo, error) {
	switch c.Provider {
	case "github":
		return c.githubCreateRepo(req)
	case "gitlab":
		return c.gitlabCreateRepo(req)
	case "bitbucket":
		return c.bitbucketCreateRepo(req)
	case "gitea":
		return c.giteaCreateRepo(req)
	}
	return nil, fmt.Errorf("unsupported provider: %s", c.Provider)
}

// CreatePR creates a pull/merge request.
func (c *Client) CreatePR(req PRRequest) (*PRResponse, error) {
	switch c.Provider {
	case "github":
		return c.githubCreatePR(req)
	case "gitlab":
		return c.gitlabCreatePR(req)
	case "bitbucket":
		return c.bitbucketCreatePR(req)
	case "gitea":
		return c.giteaCreatePR(req)
	}
	return nil, fmt.Errorf("unsupported provider: %s", c.Provider)
}

// --- GitHub ---

func (c *Client) githubListRepos(page, perPage int, search string) ([]Repo, error) {
	u := fmt.Sprintf("https://api.github.com/user/repos?page=%d&per_page=%d&sort=updated&affiliation=owner,collaborator", page, perPage)
	var items []map[string]interface{}
	if err := c.get(u, &items); err != nil {
		return nil, err
	}

	var repos []Repo
	for _, item := range items {
		name := str(item["name"])
		if search != "" && !strings.Contains(strings.ToLower(name), strings.ToLower(search)) &&
			!strings.Contains(strings.ToLower(str(item["full_name"])), strings.ToLower(search)) {
			continue
		}
		repos = append(repos, Repo{
			ID:            fmt.Sprintf("%v", item["id"]),
			Name:          name,
			FullName:      str(item["full_name"]),
			Description:   str(item["description"]),
			Private:       boolVal(item["private"]),
			DefaultBranch: str(item["default_branch"]),
			CloneURL:      str(item["clone_url"]),
			HTMLURL:       str(item["html_url"]),
			Owner:         str(mapVal(item["owner"], "login")),
		})
	}
	return repos, nil
}

func (c *Client) githubListBranches(owner, repo string) ([]Branch, error) {
	u := fmt.Sprintf("https://api.github.com/repos/%s/%s/branches?per_page=100", owner, repo)
	var items []map[string]interface{}
	if err := c.get(u, &items); err != nil {
		return nil, err
	}

	// Get default branch
	repoURL := fmt.Sprintf("https://api.github.com/repos/%s/%s", owner, repo)
	var repoData map[string]interface{}
	_ = c.get(repoURL, &repoData)
	defaultBranch := str(repoData["default_branch"])

	var branches []Branch
	for _, item := range items {
		name := str(item["name"])
		prot := boolVal(item["protected"])
		branches = append(branches, Branch{
			Name:      name,
			Protected: prot,
			IsDefault: name == defaultBranch,
		})
	}
	return branches, nil
}

func (c *Client) githubCreateRepo(req CreateRepoRequest) (*Repo, error) {
	body := map[string]interface{}{
		"name":        req.Name,
		"description": req.Description,
		"private":     req.Private,
		"auto_init":   req.AutoInit,
	}
	var resp map[string]interface{}
	if err := c.post("https://api.github.com/user/repos", body, &resp); err != nil {
		return nil, err
	}
	return &Repo{
		ID:            fmt.Sprintf("%v", resp["id"]),
		Name:          str(resp["name"]),
		FullName:      str(resp["full_name"]),
		CloneURL:      str(resp["clone_url"]),
		HTMLURL:       str(resp["html_url"]),
		DefaultBranch: str(resp["default_branch"]),
		Owner:         str(mapVal(resp["owner"], "login")),
	}, nil
}

func (c *Client) githubCreatePR(req PRRequest) (*PRResponse, error) {
	body := map[string]interface{}{
		"title": req.Title,
		"body":  req.Body,
		"head":  req.Head,
		"base":  req.Base,
	}
	u := fmt.Sprintf("https://api.github.com/repos/%s/%s/pulls", req.RepoOwner, req.RepoName)
	var resp map[string]interface{}
	if err := c.post(u, body, &resp); err != nil {
		return nil, err
	}
	return &PRResponse{
		Number:  intVal(resp["number"]),
		HTMLURL: str(resp["html_url"]),
		Title:   str(resp["title"]),
	}, nil
}

// --- GitLab ---

func (c *Client) gitlabListRepos(page, perPage int, search string) ([]Repo, error) {
	u := fmt.Sprintf("https://gitlab.com/api/v4/projects?membership=true&page=%d&per_page=%d&order_by=updated_at", page, perPage)
	if search != "" {
		u += "&search=" + url.QueryEscape(search)
	}
	var items []map[string]interface{}
	if err := c.get(u, &items); err != nil {
		return nil, err
	}
	var repos []Repo
	for _, item := range items {
		ns, _ := item["namespace"].(map[string]interface{})
		repos = append(repos, Repo{
			ID:            fmt.Sprintf("%v", item["id"]),
			Name:          str(item["name"]),
			FullName:      str(item["path_with_namespace"]),
			Description:   str(item["description"]),
			Private:       str(item["visibility"]) == "private",
			DefaultBranch: str(item["default_branch"]),
			CloneURL:      str(item["http_url_to_repo"]),
			HTMLURL:       str(item["web_url"]),
			Owner:         str(ns["path"]),
		})
	}
	return repos, nil
}

func (c *Client) gitlabListBranches(projectPath string) ([]Branch, error) {
	encoded := url.PathEscape(projectPath)
	u := fmt.Sprintf("https://gitlab.com/api/v4/projects/%s/repository/branches?per_page=100", encoded)
	var items []map[string]interface{}
	if err := c.get(u, &items); err != nil {
		return nil, err
	}

	// Get default branch
	pu := fmt.Sprintf("https://gitlab.com/api/v4/projects/%s", encoded)
	var proj map[string]interface{}
	_ = c.get(pu, &proj)
	defaultBranch := str(proj["default_branch"])

	var branches []Branch
	for _, item := range items {
		name := str(item["name"])
		branches = append(branches, Branch{
			Name:      name,
			Protected: boolVal(item["protected"]),
			IsDefault: name == defaultBranch,
		})
	}
	return branches, nil
}

func (c *Client) gitlabCreateRepo(req CreateRepoRequest) (*Repo, error) {
	vis := "private"
	if !req.Private {
		vis = "public"
	}
	body := map[string]interface{}{
		"name":                req.Name,
		"description":        req.Description,
		"visibility":         vis,
		"initialize_with_readme": req.AutoInit,
	}
	var resp map[string]interface{}
	if err := c.post("https://gitlab.com/api/v4/projects", body, &resp); err != nil {
		return nil, err
	}
	ns, _ := resp["namespace"].(map[string]interface{})
	return &Repo{
		ID:            fmt.Sprintf("%v", resp["id"]),
		Name:          str(resp["name"]),
		FullName:      str(resp["path_with_namespace"]),
		CloneURL:      str(resp["http_url_to_repo"]),
		HTMLURL:       str(resp["web_url"]),
		DefaultBranch: str(resp["default_branch"]),
		Owner:         str(ns["path"]),
	}, nil
}

func (c *Client) gitlabCreatePR(req PRRequest) (*PRResponse, error) {
	encoded := url.PathEscape(req.RepoOwner + "/" + req.RepoName)
	body := map[string]interface{}{
		"title":         req.Title,
		"description":   req.Body,
		"source_branch": req.Head,
		"target_branch": req.Base,
	}
	u := fmt.Sprintf("https://gitlab.com/api/v4/projects/%s/merge_requests", encoded)
	var resp map[string]interface{}
	if err := c.post(u, body, &resp); err != nil {
		return nil, err
	}
	return &PRResponse{
		ID:      intVal(resp["iid"]),
		Number:  intVal(resp["iid"]),
		HTMLURL: str(resp["web_url"]),
		Title:   str(resp["title"]),
	}, nil
}

// --- Bitbucket ---

func (c *Client) bitbucketListRepos(page, perPage int, search string) ([]Repo, error) {
	u := fmt.Sprintf("https://api.bitbucket.org/2.0/repositories?role=member&page=%d&pagelen=%d", page, perPage)
	if search != "" {
		u += "&q=name~%22" + url.QueryEscape(search) + "%22"
	}
	var resp map[string]interface{}
	if err := c.get(u, &resp); err != nil {
		return nil, err
	}
	items, _ := resp["values"].([]interface{})
	var repos []Repo
	for _, raw := range items {
		item, _ := raw.(map[string]interface{})
		if item == nil {
			continue
		}
		mainBranch, _ := item["mainbranch"].(map[string]interface{})
		owner, _ := item["owner"].(map[string]interface{})
		cloneURL := ""
		if links, ok := item["links"].(map[string]interface{}); ok {
			if cloneLinks, ok := links["clone"].([]interface{}); ok {
				for _, cl := range cloneLinks {
					m, _ := cl.(map[string]interface{})
					if str(m["name"]) == "https" {
						cloneURL = str(m["href"])
					}
				}
			}
		}
		repos = append(repos, Repo{
			ID:            str(item["uuid"]),
			Name:          str(item["name"]),
			FullName:      str(item["full_name"]),
			Description:   str(item["description"]),
			Private:       boolVal(item["is_private"]),
			DefaultBranch: str(mainBranch["name"]),
			CloneURL:      cloneURL,
			HTMLURL:       str(mapVal(item["links"], "html", "href")),
			Owner:         str(owner["username"]),
		})
	}
	return repos, nil
}

func (c *Client) bitbucketListBranches(owner, repo string) ([]Branch, error) {
	u := fmt.Sprintf("https://api.bitbucket.org/2.0/repositories/%s/%s/refs/branches?pagelen=100", owner, repo)
	var resp map[string]interface{}
	if err := c.get(u, &resp); err != nil {
		return nil, err
	}
	// Get default branch
	ru := fmt.Sprintf("https://api.bitbucket.org/2.0/repositories/%s/%s", owner, repo)
	var repoData map[string]interface{}
	_ = c.get(ru, &repoData)
	mainBranch, _ := repoData["mainbranch"].(map[string]interface{})
	defaultBranch := str(mainBranch["name"])

	items, _ := resp["values"].([]interface{})
	var branches []Branch
	for _, raw := range items {
		item, _ := raw.(map[string]interface{})
		name := str(item["name"])
		branches = append(branches, Branch{
			Name:      name,
			Protected: false, // Bitbucket doesn't expose this simply
			IsDefault: name == defaultBranch,
		})
	}
	return branches, nil
}

func (c *Client) bitbucketCreateRepo(req CreateRepoRequest) (*Repo, error) {
	// Need to get username first
	var user map[string]interface{}
	if err := c.get("https://api.bitbucket.org/2.0/user", &user); err != nil {
		return nil, err
	}
	username := str(user["username"])

	body := map[string]interface{}{
		"scm":         "git",
		"name":        req.Name,
		"description": req.Description,
		"is_private":  req.Private,
	}
	u := fmt.Sprintf("https://api.bitbucket.org/2.0/repositories/%s/%s", username, req.Name)
	var resp map[string]interface{}
	if err := c.post(u, body, &resp); err != nil {
		return nil, err
	}
	mainBranch, _ := resp["mainbranch"].(map[string]interface{})
	return &Repo{
		ID:            str(resp["uuid"]),
		Name:          str(resp["name"]),
		FullName:      str(resp["full_name"]),
		DefaultBranch: str(mainBranch["name"]),
		Owner:         username,
	}, nil
}

func (c *Client) bitbucketCreatePR(req PRRequest) (*PRResponse, error) {
	body := map[string]interface{}{
		"title": req.Title,
		"description": req.Body,
		"source": map[string]interface{}{
			"branch": map[string]interface{}{"name": req.Head},
		},
		"destination": map[string]interface{}{
			"branch": map[string]interface{}{"name": req.Base},
		},
	}
	u := fmt.Sprintf("https://api.bitbucket.org/2.0/repositories/%s/%s/pullrequests", req.RepoOwner, req.RepoName)
	var resp map[string]interface{}
	if err := c.post(u, body, &resp); err != nil {
		return nil, err
	}
	return &PRResponse{
		ID:      intVal(resp["id"]),
		Number:  intVal(resp["id"]),
		HTMLURL: str(mapVal(resp["links"], "html", "href")),
		Title:   str(resp["title"]),
	}, nil
}

// --- Gitea ---

func (c *Client) giteaListRepos(page, perPage int, search string) ([]Repo, error) {
	u := fmt.Sprintf("%s/api/v1/user/repos?page=%d&limit=%d", c.GiteaURL, page, perPage)
	var items []map[string]interface{}
	if err := c.get(u, &items); err != nil {
		return nil, err
	}
	var repos []Repo
	for _, item := range items {
		name := str(item["name"])
		if search != "" && !strings.Contains(strings.ToLower(name), strings.ToLower(search)) {
			continue
		}
		owner, _ := item["owner"].(map[string]interface{})
		repos = append(repos, Repo{
			ID:            fmt.Sprintf("%v", item["id"]),
			Name:          name,
			FullName:      str(item["full_name"]),
			Description:   str(item["description"]),
			Private:       boolVal(item["private"]),
			DefaultBranch: str(item["default_branch"]),
			CloneURL:      str(item["clone_url"]),
			HTMLURL:       str(item["html_url"]),
			Owner:         str(owner["login"]),
		})
	}
	return repos, nil
}

func (c *Client) giteaListBranches(owner, repo string) ([]Branch, error) {
	u := fmt.Sprintf("%s/api/v1/repos/%s/%s/branches", c.GiteaURL, owner, repo)
	var items []map[string]interface{}
	if err := c.get(u, &items); err != nil {
		return nil, err
	}

	ru := fmt.Sprintf("%s/api/v1/repos/%s/%s", c.GiteaURL, owner, repo)
	var repoData map[string]interface{}
	_ = c.get(ru, &repoData)
	defaultBranch := str(repoData["default_branch"])

	var branches []Branch
	for _, item := range items {
		name := str(item["name"])
		branches = append(branches, Branch{
			Name:      name,
			Protected: boolVal(item["protected"]),
			IsDefault: name == defaultBranch,
		})
	}
	return branches, nil
}

func (c *Client) giteaCreateRepo(req CreateRepoRequest) (*Repo, error) {
	body := map[string]interface{}{
		"name":        req.Name,
		"description": req.Description,
		"private":     req.Private,
		"auto_init":   req.AutoInit,
	}
	var resp map[string]interface{}
	if err := c.post(c.GiteaURL+"/api/v1/user/repos", body, &resp); err != nil {
		return nil, err
	}
	owner, _ := resp["owner"].(map[string]interface{})
	return &Repo{
		ID:            fmt.Sprintf("%v", resp["id"]),
		Name:          str(resp["name"]),
		FullName:      str(resp["full_name"]),
		CloneURL:      str(resp["clone_url"]),
		HTMLURL:       str(resp["html_url"]),
		DefaultBranch: str(resp["default_branch"]),
		Owner:         str(owner["login"]),
	}, nil
}

func (c *Client) giteaCreatePR(req PRRequest) (*PRResponse, error) {
	body := map[string]interface{}{
		"title": req.Title,
		"body":  req.Body,
		"head":  req.Head,
		"base":  req.Base,
	}
	u := fmt.Sprintf("%s/api/v1/repos/%s/%s/pulls", c.GiteaURL, req.RepoOwner, req.RepoName)
	var resp map[string]interface{}
	if err := c.post(u, body, &resp); err != nil {
		return nil, err
	}
	return &PRResponse{
		Number:  intVal(resp["number"]),
		HTMLURL: str(resp["html_url"]),
		Title:   str(resp["title"]),
	}, nil
}

// --- Helpers ---

func (c *Client) get(u string, result interface{}) error {
	req, err := http.NewRequest("GET", u, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.AccessToken)
	req.Header.Set("Accept", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return fmt.Errorf("API error %d: %s", resp.StatusCode, string(body))
	}
	return json.Unmarshal(body, result)
}

func (c *Client) post(u string, payload interface{}, result interface{}) error {
	data, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", u, bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.AccessToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return fmt.Errorf("API error %d: %s", resp.StatusCode, string(body))
	}
	return json.Unmarshal(body, result)
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

func boolVal(v interface{}) bool {
	if b, ok := v.(bool); ok {
		return b
	}
	return false
}

func intVal(v interface{}) int {
	if f, ok := v.(float64); ok {
		return int(f)
	}
	return 0
}

func mapVal(v interface{}, keys ...string) interface{} {
	current := v
	for _, key := range keys {
		m, ok := current.(map[string]interface{})
		if !ok {
			return nil
		}
		current = m[key]
	}
	return current
}
