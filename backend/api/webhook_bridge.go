package api

import "md-office-backend/webhooks"

// FireEvent dispatches a webhook event
func FireEvent(event string, payload interface{}) {
	webhooks.FireEvent(event, payload)
}
