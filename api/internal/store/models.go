package store

import "time"

type Place struct {
	ID         string    `json:"id"`
	UserID     string    `json:"user_id"`
	Name       string    `json:"name"`
	Latitude   float64   `json:"latitude"`
	Longitude  float64   `json:"longitude"`
	TravelDate string    `json:"travel_date"`
	Note       string    `json:"note"`
	PlaceType  string    `json:"place_type"`
	Country    string    `json:"country"`
	City       string    `json:"city"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
	Photos     []Photo   `json:"photos"`
	Posts      []Post    `json:"posts"`
}

type Photo struct {
	ID          string    `json:"id"`
	Filename    string    `json:"filename"`
	ContentType string    `json:"content_type"`
	Path        string    `json:"path"`
	URL         string    `json:"url"`
	CreatedAt   time.Time `json:"created_at"`
}

type Post struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	ImagePath string    `json:"image_path"`
	ImageURL  string    `json:"image_url"`
	CreatedAt time.Time `json:"created_at"`
}

type PlaceInput struct {
	Name       string  `json:"name"`
	Latitude   float64 `json:"latitude"`
	Longitude  float64 `json:"longitude"`
	TravelDate string  `json:"travel_date"`
	Note       string  `json:"note"`
	PlaceType  string  `json:"place_type"`
	Country    string  `json:"country"`
	City       string  `json:"city"`
}

type PostInput struct {
	Title     string `json:"title"`
	Content   string `json:"content"`
	ImagePath string `json:"image_path"`
}

type PhotoInput struct {
	Filename    string
	ContentType string
	File        interface {
		Read(p []byte) (n int, err error)
	}
}

type PostAttachmentInput struct {
	Filename    string
	ContentType string
	File        interface {
		Read(p []byte) (n int, err error)
	}
}

type persistedState struct {
	Places map[string][]Place `json:"places"`
}
