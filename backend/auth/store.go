package auth

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// TokenRecord stores an encrypted OAuth token for a user+provider.
type TokenRecord struct {
	ID           int64
	UserID       string
	Provider     string // github, gitlab, bitbucket, gitea
	GiteaURL     string // only for gitea
	AccessToken  string
	RefreshToken string
	TokenType    string
	Expiry       time.Time
	Username     string // provider username
	AvatarURL    string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

var db *sql.DB
var encryptionKey []byte

// InitStore opens (or creates) the SQLite database and runs migrations.
func InitStore() error {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	dbDir := filepath.Join(homeDir, ".md-office")
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		return err
	}
	dbPath := filepath.Join(dbDir, "oauth_tokens.db")

	db, err = sql.Open("sqlite3", dbPath+"?_journal_mode=WAL")
	if err != nil {
		return fmt.Errorf("open db: %w", err)
	}

	// Create tables
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS oauth_tokens (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id TEXT NOT NULL,
			provider TEXT NOT NULL,
			gitea_url TEXT DEFAULT '',
			access_token TEXT NOT NULL,
			refresh_token TEXT DEFAULT '',
			token_type TEXT DEFAULT 'bearer',
			expiry DATETIME,
			username TEXT DEFAULT '',
			avatar_url TEXT DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(user_id, provider, gitea_url)
		);
		CREATE TABLE IF NOT EXISTS oauth_states (
			state TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			provider TEXT NOT NULL,
			gitea_url TEXT DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
	`)
	if err != nil {
		return fmt.Errorf("create tables: %w", err)
	}

	// Load or generate encryption key
	keyPath := filepath.Join(dbDir, ".token_key")
	encryptionKey, err = loadOrGenerateKey(keyPath)
	if err != nil {
		return fmt.Errorf("encryption key: %w", err)
	}

	return nil
}

func loadOrGenerateKey(path string) ([]byte, error) {
	data, err := os.ReadFile(path)
	if err == nil && len(data) == 64 {
		return hex.DecodeString(string(data))
	}
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return nil, err
	}
	if err := os.WriteFile(path, []byte(hex.EncodeToString(key)), 0600); err != nil {
		return nil, err
	}
	return key, nil
}

func encrypt(plaintext string) (string, error) {
	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return "", err
	}
	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, aesGCM.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := aesGCM.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func decrypt(encoded string) (string, error) {
	ciphertext, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return "", err
	}
	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonceSize := aesGCM.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}
	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := aesGCM.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

// SaveToken upserts an OAuth token for user+provider.
func SaveToken(rec *TokenRecord) error {
	encAccess, err := encrypt(rec.AccessToken)
	if err != nil {
		return err
	}
	encRefresh := ""
	if rec.RefreshToken != "" {
		encRefresh, err = encrypt(rec.RefreshToken)
		if err != nil {
			return err
		}
	}

	_, err = db.Exec(`
		INSERT INTO oauth_tokens (user_id, provider, gitea_url, access_token, refresh_token, token_type, expiry, username, avatar_url, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(user_id, provider, gitea_url) DO UPDATE SET
			access_token=excluded.access_token,
			refresh_token=excluded.refresh_token,
			token_type=excluded.token_type,
			expiry=excluded.expiry,
			username=excluded.username,
			avatar_url=excluded.avatar_url,
			updated_at=CURRENT_TIMESTAMP
	`, rec.UserID, rec.Provider, rec.GiteaURL, encAccess, encRefresh, rec.TokenType, rec.Expiry, rec.Username, rec.AvatarURL)
	return err
}

// GetToken retrieves decrypted token for user+provider.
func GetToken(userID, provider, giteaURL string) (*TokenRecord, error) {
	row := db.QueryRow(`
		SELECT id, user_id, provider, gitea_url, access_token, refresh_token, token_type, expiry, username, avatar_url, created_at, updated_at
		FROM oauth_tokens WHERE user_id=? AND provider=? AND gitea_url=?
	`, userID, provider, giteaURL)

	rec := &TokenRecord{}
	var encAccess, encRefresh string
	var expiry sql.NullTime
	err := row.Scan(&rec.ID, &rec.UserID, &rec.Provider, &rec.GiteaURL,
		&encAccess, &encRefresh, &rec.TokenType, &expiry,
		&rec.Username, &rec.AvatarURL, &rec.CreatedAt, &rec.UpdatedAt)
	if err != nil {
		return nil, err
	}

	rec.AccessToken, err = decrypt(encAccess)
	if err != nil {
		return nil, fmt.Errorf("decrypt access token: %w", err)
	}
	if encRefresh != "" {
		rec.RefreshToken, err = decrypt(encRefresh)
		if err != nil {
			return nil, fmt.Errorf("decrypt refresh token: %w", err)
		}
	}
	if expiry.Valid {
		rec.Expiry = expiry.Time
	}
	return rec, nil
}

// GetTokensForUser returns all provider connections for a user.
func GetTokensForUser(userID string) ([]*TokenRecord, error) {
	rows, err := db.Query(`
		SELECT id, user_id, provider, gitea_url, access_token, refresh_token, token_type, expiry, username, avatar_url, created_at, updated_at
		FROM oauth_tokens WHERE user_id=?
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tokens []*TokenRecord
	for rows.Next() {
		rec := &TokenRecord{}
		var encAccess, encRefresh string
		var expiry sql.NullTime
		err := rows.Scan(&rec.ID, &rec.UserID, &rec.Provider, &rec.GiteaURL,
			&encAccess, &encRefresh, &rec.TokenType, &expiry,
			&rec.Username, &rec.AvatarURL, &rec.CreatedAt, &rec.UpdatedAt)
		if err != nil {
			return nil, err
		}
		rec.AccessToken, _ = decrypt(encAccess)
		if encRefresh != "" {
			rec.RefreshToken, _ = decrypt(encRefresh)
		}
		if expiry.Valid {
			rec.Expiry = expiry.Time
		}
		tokens = append(tokens, rec)
	}
	return tokens, nil
}

// DeleteToken removes a provider connection.
func DeleteToken(userID, provider, giteaURL string) error {
	_, err := db.Exec(`DELETE FROM oauth_tokens WHERE user_id=? AND provider=? AND gitea_url=?`, userID, provider, giteaURL)
	return err
}

// SaveOAuthState stores a state parameter for CSRF validation.
func SaveOAuthState(state, userID, provider, giteaURL string) error {
	_, err := db.Exec(`INSERT INTO oauth_states (state, user_id, provider, gitea_url) VALUES (?, ?, ?, ?)`,
		state, userID, provider, giteaURL)
	return err
}

// ConsumeOAuthState retrieves and deletes an OAuth state.
func ConsumeOAuthState(state string) (userID, provider, giteaURL string, err error) {
	row := db.QueryRow(`SELECT user_id, provider, gitea_url FROM oauth_states WHERE state=?`, state)
	err = row.Scan(&userID, &provider, &giteaURL)
	if err != nil {
		return "", "", "", err
	}
	_, _ = db.Exec(`DELETE FROM oauth_states WHERE state=?`, state)
	// Cleanup old states
	_, _ = db.Exec(`DELETE FROM oauth_states WHERE created_at < datetime('now', '-1 hour')`)
	return
}
