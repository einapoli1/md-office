package api

import (
	"sync"
	"time"
)

// RateLimiter implements per-key token bucket rate limiting
type RateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*bucket
	rate    int           // requests per window
	window  time.Duration // window duration
}

type bucket struct {
	tokens    int
	lastReset time.Time
}

// NewRateLimiter creates a rate limiter (e.g., 60 requests per minute)
func NewRateLimiter(rate int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		buckets: make(map[string]*bucket),
		rate:    rate,
		window:  window,
	}
}

// Allow checks if a request is allowed for the given key
func (rl *RateLimiter) Allow(key string) (bool, int, time.Time) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	b, ok := rl.buckets[key]
	if !ok {
		b = &bucket{tokens: rl.rate, lastReset: time.Now()}
		rl.buckets[key] = b
	}

	// Reset if window has passed
	if time.Since(b.lastReset) >= rl.window {
		b.tokens = rl.rate
		b.lastReset = time.Now()
	}

	if b.tokens <= 0 {
		resetAt := b.lastReset.Add(rl.window)
		return false, 0, resetAt
	}

	b.tokens--
	return true, b.tokens, b.lastReset.Add(rl.window)
}
