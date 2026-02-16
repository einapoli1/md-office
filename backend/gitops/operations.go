package gitops

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	gogit "github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/config"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/go-git/go-git/v5/plumbing/transport/http"
)

// RepoConfig holds configuration for a connected repo.
type RepoConfig struct {
	Provider      string `json:"provider"`
	GiteaURL      string `json:"giteaUrl,omitempty"`
	Owner         string `json:"owner"`
	Name          string `json:"name"`
	CloneURL      string `json:"cloneUrl"`
	Branch        string `json:"branch"`
	DefaultBranch string `json:"defaultBranch"`
	Subdirectory  string `json:"subdirectory,omitempty"`
	AccessToken   string `json:"-"` // never serialized
	Username      string `json:"-"`
}

// SyncStatus represents the current sync state.
type SyncStatus struct {
	State     string `json:"state"` // "synced", "pushing", "pulling", "conflict", "error", "dirty"
	Message   string `json:"message,omitempty"`
	LastSync  string `json:"lastSync,omitempty"`
	Behind    int    `json:"behind"`
	Ahead     int    `json:"ahead"`
}

// CloneRepo clones a remote repository to a local path.
func CloneRepo(cfg *RepoConfig, localPath string) (*gogit.Repository, error) {
	if err := os.MkdirAll(localPath, 0755); err != nil {
		return nil, fmt.Errorf("create dir: %w", err)
	}

	auth := &http.BasicAuth{
		Username: cfg.Username,
		Password: cfg.AccessToken,
	}

	opts := &gogit.CloneOptions{
		URL:           cfg.CloneURL,
		Auth:          auth,
		ReferenceName: plumbing.NewBranchReferenceName(cfg.Branch),
		SingleBranch:  true,
		Depth:         0, // full clone for history
	}

	repo, err := gogit.PlainClone(localPath, false, opts)
	if err != nil {
		return nil, fmt.Errorf("clone: %w", err)
	}

	return repo, nil
}

// PullChanges pulls latest changes from remote.
func PullChanges(repo *gogit.Repository, cfg *RepoConfig) error {
	wt, err := repo.Worktree()
	if err != nil {
		return fmt.Errorf("worktree: %w", err)
	}

	auth := &http.BasicAuth{
		Username: cfg.Username,
		Password: cfg.AccessToken,
	}

	err = wt.Pull(&gogit.PullOptions{
		RemoteName:    "origin",
		ReferenceName: plumbing.NewBranchReferenceName(cfg.Branch),
		Auth:          auth,
	})
	if err == gogit.NoErrAlreadyUpToDate {
		return nil
	}
	return err
}

// CommitAndPush stages all changes, commits, and pushes.
func CommitAndPush(repo *gogit.Repository, cfg *RepoConfig, message, authorName, authorEmail string) error {
	wt, err := repo.Worktree()
	if err != nil {
		return fmt.Errorf("worktree: %w", err)
	}

	// Stage all changes
	if err := wt.AddGlob("."); err != nil {
		return fmt.Errorf("add: %w", err)
	}

	// Check if there are changes to commit
	status, err := wt.Status()
	if err != nil {
		return fmt.Errorf("status: %w", err)
	}
	if status.IsClean() {
		return nil // Nothing to commit
	}

	// Commit
	_, err = wt.Commit(message, &gogit.CommitOptions{
		Author: &object.Signature{
			Name:  authorName,
			Email: authorEmail,
			When:  time.Now(),
		},
	})
	if err != nil {
		return fmt.Errorf("commit: %w", err)
	}

	// Push
	auth := &http.BasicAuth{
		Username: cfg.Username,
		Password: cfg.AccessToken,
	}

	err = repo.Push(&gogit.PushOptions{
		RemoteName: "origin",
		Auth:       auth,
	})
	if err != nil && err != gogit.NoErrAlreadyUpToDate {
		return fmt.Errorf("push: %w", err)
	}

	return nil
}

// CreateBranch creates a new branch from current HEAD.
func CreateBranch(repo *gogit.Repository, branchName string) error {
	head, err := repo.Head()
	if err != nil {
		return err
	}

	ref := plumbing.NewHashReference(
		plumbing.NewBranchReferenceName(branchName),
		head.Hash(),
	)
	return repo.Storer.SetReference(ref)
}

// CheckoutBranch switches to a branch.
func CheckoutBranch(repo *gogit.Repository, branchName string) error {
	wt, err := repo.Worktree()
	if err != nil {
		return err
	}
	return wt.Checkout(&gogit.CheckoutOptions{
		Branch: plumbing.NewBranchReferenceName(branchName),
	})
}

// PushBranch pushes a specific branch to remote.
func PushBranch(repo *gogit.Repository, cfg *RepoConfig, branchName string) error {
	auth := &http.BasicAuth{
		Username: cfg.Username,
		Password: cfg.AccessToken,
	}

	refSpec := config.RefSpec(fmt.Sprintf("refs/heads/%s:refs/heads/%s", branchName, branchName))
	return repo.Push(&gogit.PushOptions{
		RemoteName: "origin",
		Auth:       auth,
		RefSpecs:   []config.RefSpec{refSpec},
	})
}

// ListBranches lists local branches.
func ListBranches(repo *gogit.Repository) ([]string, string, error) {
	refs, err := repo.References()
	if err != nil {
		return nil, "", err
	}

	head, err := repo.Head()
	if err != nil {
		return nil, "", err
	}
	currentBranch := head.Name().Short()

	var branches []string
	_ = refs.ForEach(func(ref *plumbing.Reference) error {
		if ref.Name().IsBranch() {
			branches = append(branches, ref.Name().Short())
		}
		return nil
	})

	return branches, currentBranch, nil
}

// GetSyncStatus checks if local repo is ahead/behind remote.
func GetSyncStatus(repo *gogit.Repository, cfg *RepoConfig) (*SyncStatus, error) {
	// Fetch to update remote refs
	auth := &http.BasicAuth{
		Username: cfg.Username,
		Password: cfg.AccessToken,
	}
	_ = repo.Fetch(&gogit.FetchOptions{
		RemoteName: "origin",
		Auth:       auth,
	})

	wt, err := repo.Worktree()
	if err != nil {
		return &SyncStatus{State: "error", Message: err.Error()}, nil
	}

	status, err := wt.Status()
	if err != nil {
		return &SyncStatus{State: "error", Message: err.Error()}, nil
	}

	if !status.IsClean() {
		return &SyncStatus{State: "dirty", Message: "Uncommitted changes"}, nil
	}

	return &SyncStatus{
		State:    "synced",
		LastSync: time.Now().Format(time.RFC3339),
	}, nil
}

// ListFiles returns files in the repo (optionally under a subdirectory).
func ListFiles(repoPath, subdirectory string) ([]FileEntry, error) {
	root := repoPath
	if subdirectory != "" {
		root = filepath.Join(repoPath, subdirectory)
	}

	var entries []FileEntry
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if strings.HasPrefix(info.Name(), ".") {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		rel, _ := filepath.Rel(root, path)
		if rel == "." {
			return nil
		}

		entries = append(entries, FileEntry{
			Name:        info.Name(),
			Path:        rel,
			IsDirectory: info.IsDir(),
			Size:        info.Size(),
			Modified:    info.ModTime().Format(time.RFC3339),
		})
		return nil
	})
	return entries, err
}

// FileEntry represents a file in the repo listing.
type FileEntry struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	IsDirectory bool   `json:"isDirectory"`
	Size        int64  `json:"size"`
	Modified    string `json:"modified"`
}

// DetectConflicts pulls and checks for merge conflicts before pushing.
// Returns true if there are conflicts.
func DetectConflicts(repo *gogit.Repository, cfg *RepoConfig) (bool, error) {
	wt, err := repo.Worktree()
	if err != nil {
		return false, err
	}

	auth := &http.BasicAuth{
		Username: cfg.Username,
		Password: cfg.AccessToken,
	}

	err = wt.Pull(&gogit.PullOptions{
		RemoteName:    "origin",
		ReferenceName: plumbing.NewBranchReferenceName(cfg.Branch),
		Auth:          auth,
	})

	if err == nil || err == gogit.NoErrAlreadyUpToDate {
		return false, nil
	}

	// Check if the error is a merge conflict
	if strings.Contains(err.Error(), "conflict") || strings.Contains(err.Error(), "merge") {
		return true, nil
	}

	return false, err
}
