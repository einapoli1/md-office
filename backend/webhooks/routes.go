package webhooks

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
)

type apiResponse struct {
	Data  interface{} `json:"data,omitempty"`
	Error string      `json:"error,omitempty"`
}

type createSubRequest struct {
	URL    string   `json:"url"`
	Events []string `json:"events"`
	Secret string   `json:"secret"`
}

type updateSubRequest struct {
	URL    string   `json:"url"`
	Events []string `json:"events"`
	Secret string   `json:"secret,omitempty"`
	Active bool     `json:"active"`
}

// RegisterRoutes adds webhook management endpoints
// getUserID is a function that extracts userID from the fiber context (set by auth middleware)
func RegisterRoutes(group fiber.Router, getUserID func(c *fiber.Ctx) string) {
	wh := group.Group("/webhooks")

	wh.Get("/", func(c *fiber.Ctx) error {
		userID := getUserID(c)
		if userID == "" {
			return c.Status(401).JSON(apiResponse{Error: "Authentication required"})
		}
		subs := List(userID)
		if subs == nil {
			subs = []Subscription{}
		}
		return c.JSON(apiResponse{Data: subs})
	})

	wh.Get("/:id", func(c *fiber.Ctx) error {
		userID := getUserID(c)
		if userID == "" {
			return c.Status(401).JSON(apiResponse{Error: "Authentication required"})
		}
		sub, err := Get(c.Params("id"), userID)
		if err != nil {
			return c.Status(404).JSON(apiResponse{Error: err.Error()})
		}
		return c.JSON(apiResponse{Data: sub})
	})

	wh.Post("/", func(c *fiber.Ctx) error {
		userID := getUserID(c)
		if userID == "" {
			return c.Status(401).JSON(apiResponse{Error: "Authentication required"})
		}
		var req createSubRequest
		if err := c.BodyParser(&req); err != nil || req.URL == "" || len(req.Events) == 0 {
			return c.Status(400).JSON(apiResponse{Error: "url and events are required"})
		}
		sub, err := Create(userID, req.URL, req.Secret, req.Events)
		if err != nil {
			return c.Status(500).JSON(apiResponse{Error: err.Error()})
		}
		return c.Status(201).JSON(apiResponse{Data: sub})
	})

	wh.Put("/:id", func(c *fiber.Ctx) error {
		userID := getUserID(c)
		if userID == "" {
			return c.Status(401).JSON(apiResponse{Error: "Authentication required"})
		}
		var req updateSubRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(apiResponse{Error: "Invalid request body"})
		}
		sub, err := Update(c.Params("id"), userID, req.URL, req.Secret, req.Events, req.Active)
		if err != nil {
			return c.Status(404).JSON(apiResponse{Error: err.Error()})
		}
		return c.JSON(apiResponse{Data: sub})
	})

	wh.Delete("/:id", func(c *fiber.Ctx) error {
		userID := getUserID(c)
		if userID == "" {
			return c.Status(401).JSON(apiResponse{Error: "Authentication required"})
		}
		if err := Delete(c.Params("id"), userID); err != nil {
			return c.Status(404).JSON(apiResponse{Error: err.Error()})
		}
		return c.JSON(apiResponse{Data: "Deleted"})
	})

	wh.Get("/logs/recent", func(c *fiber.Ctx) error {
		userID := getUserID(c)
		if userID == "" {
			return c.Status(401).JSON(apiResponse{Error: "Authentication required"})
		}
		limitStr := c.Query("limit", "50")
		limit, _ := strconv.Atoi(limitStr)
		if limit <= 0 || limit > 200 {
			limit = 50
		}
		logs := GetLogs(userID, limit)
		if logs == nil {
			logs = []DeliveryLog{}
		}
		return c.JSON(apiResponse{Data: logs})
	})
}
