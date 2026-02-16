package webhooks

import (
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Subscription represents a webhook subscription
type Subscription struct {
	ID        string   `json:"id"`
	URL       string   `json:"url"`
	Events    []string `json:"events"`
	Secret    string   `json:"secret"`
	UserID    string   `json:"userId"`
	Active    bool     `json:"active"`
	CreatedAt time.Time `json:"createdAt"`
}

// DeliveryLog represents a webhook delivery attempt
type DeliveryLog struct {
	ID             string    `json:"id"`
	SubscriptionID string    `json:"subscriptionId"`
	Event          string    `json:"event"`
	URL            string    `json:"url"`
	StatusCode     int       `json:"statusCode"`
	Success        bool      `json:"success"`
	Attempt        int       `json:"attempt"`
	Error          string    `json:"error,omitempty"`
	Timestamp      time.Time `json:"timestamp"`
}

// Store manages webhook subscriptions and delivery logs
type Store struct {
	mu           sync.RWMutex
	filePath     string
	logPath      string
	subs         []Subscription
	logs         []DeliveryLog
	maxLogs      int
}

type subsFile struct {
	Subscriptions []Subscription `json:"subscriptions"`
}

type logsFile struct {
	Logs []DeliveryLog `json:"logs"`
}

var store *Store

// Init initializes the webhook store
func Init(configDir string) error {
	store = &Store{
		filePath: filepath.Join(configDir, "webhooks.json"),
		logPath:  filepath.Join(configDir, "webhook_logs.json"),
		maxLogs:  500,
	}
	if err := store.loadSubs(); err != nil {
		return err
	}
	return store.loadLogs()
}

func (s *Store) loadSubs() error {
	data, err := os.ReadFile(s.filePath)
	if err != nil {
		if os.IsNotExist(err) {
			s.subs = []Subscription{}
			return nil
		}
		return err
	}
	var f subsFile
	if err := json.Unmarshal(data, &f); err != nil {
		return err
	}
	s.subs = f.Subscriptions
	return nil
}

func (s *Store) saveSubs() error {
	data, err := json.MarshalIndent(subsFile{Subscriptions: s.subs}, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, data, 0644)
}

func (s *Store) loadLogs() error {
	data, err := os.ReadFile(s.logPath)
	if err != nil {
		if os.IsNotExist(err) {
			s.logs = []DeliveryLog{}
			return nil
		}
		return err
	}
	var f logsFile
	if err := json.Unmarshal(data, &f); err != nil {
		return err
	}
	s.logs = f.Logs
	return nil
}

func (s *Store) saveLogs() error {
	// Trim to maxLogs
	if len(s.logs) > s.maxLogs {
		s.logs = s.logs[len(s.logs)-s.maxLogs:]
	}
	data, err := json.MarshalIndent(logsFile{Logs: s.logs}, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.logPath, data, 0644)
}

func genID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// Create adds a new subscription
func Create(userID, url, secret string, events []string) (*Subscription, error) {
	store.mu.Lock()
	defer store.mu.Unlock()

	sub := Subscription{
		ID:        genID(),
		URL:       url,
		Events:    events,
		Secret:    secret,
		UserID:    userID,
		Active:    true,
		CreatedAt: time.Now(),
	}

	store.subs = append(store.subs, sub)
	return &sub, store.saveSubs()
}

// List returns all subscriptions for a user
func List(userID string) []Subscription {
	store.mu.RLock()
	defer store.mu.RUnlock()

	var result []Subscription
	for _, s := range store.subs {
		if s.UserID == userID {
			safe := s
			safe.Secret = "***"
			result = append(result, safe)
		}
	}
	return result
}

// Get returns a single subscription
func Get(id, userID string) (*Subscription, error) {
	store.mu.RLock()
	defer store.mu.RUnlock()

	for _, s := range store.subs {
		if s.ID == id && s.UserID == userID {
			safe := s
			safe.Secret = "***"
			return &safe, nil
		}
	}
	return nil, fmt.Errorf("subscription not found")
}

// Update modifies a subscription
func Update(id, userID, url, secret string, events []string, active bool) (*Subscription, error) {
	store.mu.Lock()
	defer store.mu.Unlock()

	for i := range store.subs {
		if store.subs[i].ID == id && store.subs[i].UserID == userID {
			store.subs[i].URL = url
			if secret != "" {
				store.subs[i].Secret = secret
			}
			store.subs[i].Events = events
			store.subs[i].Active = active
			if err := store.saveSubs(); err != nil {
				return nil, err
			}
			safe := store.subs[i]
			safe.Secret = "***"
			return &safe, nil
		}
	}
	return nil, fmt.Errorf("subscription not found")
}

// Delete removes a subscription
func Delete(id, userID string) error {
	store.mu.Lock()
	defer store.mu.Unlock()

	for i := range store.subs {
		if store.subs[i].ID == id && store.subs[i].UserID == userID {
			store.subs = append(store.subs[:i], store.subs[i+1:]...)
			return store.saveSubs()
		}
	}
	return fmt.Errorf("subscription not found")
}

// GetLogs returns delivery logs for a user's subscriptions
func GetLogs(userID string, limit int) []DeliveryLog {
	store.mu.RLock()
	defer store.mu.RUnlock()

	// Find user's subscription IDs
	subIDs := make(map[string]bool)
	for _, s := range store.subs {
		if s.UserID == userID {
			subIDs[s.ID] = true
		}
	}

	var result []DeliveryLog
	// Iterate in reverse for most recent first
	for i := len(store.logs) - 1; i >= 0; i-- {
		if subIDs[store.logs[i].SubscriptionID] {
			result = append(result, store.logs[i])
			if len(result) >= limit {
				break
			}
		}
	}
	return result
}

// FireEvent dispatches an event to all matching subscriptions
func FireEvent(event string, payload interface{}) {
	if store == nil {
		return
	}

	store.mu.RLock()
	var matching []Subscription
	for _, s := range store.subs {
		if !s.Active {
			continue
		}
		for _, e := range s.Events {
			if e == event || e == "*" {
				matching = append(matching, s)
				break
			}
		}
	}
	store.mu.RUnlock()

	for _, sub := range matching {
		go deliverWithRetry(sub, event, payload)
	}
}

func deliverWithRetry(sub Subscription, event string, payload interface{}) {
	body := map[string]interface{}{
		"event":     event,
		"payload":   payload,
		"timestamp": time.Now().Format(time.RFC3339),
		"id":        genID(),
	}

	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return
	}

	maxAttempts := 3
	delays := []time.Duration{0, 5 * time.Second, 30 * time.Second}

	for attempt := 0; attempt < maxAttempts; attempt++ {
		if attempt > 0 {
			time.Sleep(delays[attempt])
		}

		statusCode, deliveryErr := deliver(sub, bodyBytes)

		log := DeliveryLog{
			ID:             genID(),
			SubscriptionID: sub.ID,
			Event:          event,
			URL:            sub.URL,
			StatusCode:     statusCode,
			Success:        statusCode >= 200 && statusCode < 300,
			Attempt:        attempt + 1,
			Timestamp:      time.Now(),
		}
		if deliveryErr != nil {
			log.Error = deliveryErr.Error()
		}

		store.mu.Lock()
		store.logs = append(store.logs, log)
		_ = store.saveLogs()
		store.mu.Unlock()

		if log.Success {
			return
		}
	}
}

func deliver(sub Subscription, body []byte) (int, error) {
	req, err := http.NewRequest("POST", sub.URL, bytes.NewReader(body))
	if err != nil {
		return 0, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Webhook-Event", "md-office")

	// HMAC signature
	if sub.Secret != "" {
		mac := hmac.New(sha256.New, []byte(sub.Secret))
		mac.Write(body)
		sig := hex.EncodeToString(mac.Sum(nil))
		req.Header.Set("X-Signature-256", "sha256="+sig)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	return resp.StatusCode, nil
}
