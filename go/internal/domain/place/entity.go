package place

import (
	"strings"
	"time"
)

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
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	PlaceID   string    `json:"place_id"`
	URL       string    `json:"url"`
	CreatedAt time.Time `json:"created_at"`
}

type Post struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	PlaceID   string    `json:"place_id"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	PhotoID   string    `json:"photo_id"`
	CreatedAt time.Time `json:"created_at"`
}

type PlaceDetails struct {
	Name       string
	Latitude   float64
	Longitude  float64
	TravelDate string
	Note       string
	PlaceType  string
	Country    string
	City       string
}

func NewPlace(id string, userID string, details PlaceDetails, now time.Time) (Place, error) {
	name := strings.TrimSpace(details.Name)
	if name == "" {
		return Place{}, ErrNameRequired
	}
	return Place{
		ID:         id,
		UserID:     userID,
		Name:       name,
		Latitude:   details.Latitude,
		Longitude:  details.Longitude,
		TravelDate: strings.TrimSpace(details.TravelDate),
		Note:       strings.TrimSpace(details.Note),
		PlaceType:  strings.TrimSpace(details.PlaceType),
		Country:    strings.TrimSpace(details.Country),
		City:       strings.TrimSpace(details.City),
		CreatedAt:  now,
		UpdatedAt:  now,
		Photos:     []Photo{},
		Posts:      []Post{},
	}, nil
}

func (p *Place) Update(details PlaceDetails, now time.Time) error {
	name := strings.TrimSpace(details.Name)
	if name == "" {
		return ErrNameRequired
	}
	p.Name = name
	p.Latitude = details.Latitude
	p.Longitude = details.Longitude
	p.TravelDate = strings.TrimSpace(details.TravelDate)
	p.Note = strings.TrimSpace(details.Note)
	p.PlaceType = strings.TrimSpace(details.PlaceType)
	p.Country = strings.TrimSpace(details.Country)
	p.City = strings.TrimSpace(details.City)
	p.UpdatedAt = now
	return nil
}

func (p *Place) AddPhoto(photo Photo, now time.Time) {
	p.Photos = append(p.Photos, photo)
	p.UpdatedAt = now
}

func (p *Place) RemovePhoto(photoID string, now time.Time) (Photo, error) {
	for index, photo := range p.Photos {
		if photo.ID != photoID {
			continue
		}
		p.Photos = append(p.Photos[:index], p.Photos[index+1:]...)
		p.UpdatedAt = now
		return photo, nil
	}
	return Photo{}, ErrNotFound
}

func (p *Place) AddPost(post Post, now time.Time) {
	p.Posts = append(p.Posts, post)
	p.UpdatedAt = now
}

func (p *Place) RemovePost(postID string, now time.Time) error {
	for index, post := range p.Posts {
		if post.ID != postID {
			continue
		}
		p.Posts = append(p.Posts[:index], p.Posts[index+1:]...)
		p.UpdatedAt = now
		return nil
	}
	return ErrNotFound
}
