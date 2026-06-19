package place

import "io"

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

type PhotoInput struct {
	Filename    string
	ContentType string
	File        io.Reader
}

type PostInput struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

type PostAttachmentInput struct {
	Title       string
	Content     string
	Filename    string
	ContentType string
	File        io.Reader
}
