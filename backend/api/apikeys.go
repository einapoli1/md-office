package api

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// APIKey represents a stored API key
type APIKey struct {
	ID        string     `json:"id"`
	Name      string     `json:"name"`
	KeyHash   string     `json:"keyHash"`
	Prefix    string     `json:"prefix"`
	UserID    string     `json:"userId"`
	CreatedAt time.Time  `json:"createdAt"`
	LastUsed  *time.Time `json:"lastUsed,omitempty"`
	RevokedAt *time.Time `json:"revokedAt,omitempty"`
}

// APIKeyStore manages API keys on disk
type APIKeyStore struct {
	mu       sync.RWMutex
	filePath string
	keys     []APIKey
}

type apiKeyFile struct {
	Keys []APIKey `json:"keys"`
}

var keyStore *APIKeyStore

// InitAPIKeyStore initializes the API key store
func InitAPIKeyStore(configDir string) error {
	keyStore = &APIKeyStore{
		filePath: filepath.Join(configDir, "apikeys.json"),
	}
	return keyStore.load()
}

func (s *APIKeyStore) load() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := os.ReadFile(s.filePath)
	if err != nil {
		if os.IsNotExist(err) {
			s.keys = []APIKey{}
			return nil
		}
		return err
	}

	var f apiKeyFile
	if err := json.Unmarshal(data, &f); err != nil {
		return err
	}
	s.keys = f.Keys
	return nil
}

func (s *APIKeyStore) save() error {
	data, err := json.MarshalIndent(apiKeyFile{Keys: s.keys}, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, data, 0644)
}

func sha256Hex(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

// GenerateKey creates a new API key, returning the raw key (only shown once)
func GenerateKey(name, userID string) (string, *APIKey, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", nil, err
	}
	rawKey := "mdo_" + hex.EncodeToString(raw)
	prefix := rawKey[:12]
	hash := sha256Hex(rawKey)

	id := make([]byte, 8)
	rand.Read(id)

	key := APIKey{
		ID:        hex.EncodeToString(id),
		Name:      name,
		KeyHash:   hash,
		Prefix:    prefix,
		UserID:    userID,
		CreatedAt: time.Now(),
	}

	keyStore.mu.Lock()
	defer keyStore.mu.Unlock()

	keyStore.keys = append(keyStore.keys, key)
	if err := keyStore.save(); err != nil {
		return "", nil, err
	}

	return rawKey, &key, nil
}

// ValidateKey checks a raw API key and returns the associated key record
func ValidateKey(rawKey string) (*APIKey, error) {
	hash := sha256Hex(rawKey)

	keyStore.mu.Lock()
	defer keyStore.mu.Unlock()

	for i := range keyStore.keys {
		if keyStore.keys[i].KeyHash == hash && keyStore.keys[i].RevokedAt == nil {
			now := time.Now()
			keyStore.keys[i].LastUsed = &now
			_ = keyStore.save()
			return &keyStore.keys[i], nil
		}
	}
	return nil, fmt.Errorf("invalid API key")
}

// ListKeys returns all keys for a user (without hashes)
func ListKeys(userID string) []APIKey {
	keyStore.mu.RLock()
	defer keyStore.mu.RUnlock()

	var result []APIKey
	for _, k := range keyStore.keys {
		if k.UserID == userID {
			safe := k
			safe.KeyHash = ""
			result = append(result, safe)
		}
	}
	return result
}

// RevokeKey revokes an API key
func RevokeKey(keyID, userID string) error {
	keyStore.mu.Lock()
	defer keyStore.mu.Unlock()

	for i := range keyStore.keys {
		if keyStore.keys[i].ID == keyID && keyStore.keys[i].UserID == userID {
			now := time.Now()
			keyStore.keys[i].RevokedAt = &now
			return keyStore.save()
		}
	}
	return fmt.Errorf("key not found")
}
