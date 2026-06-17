package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math/rand"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"travel-coordinates/api/internal"
)

var ErrNotFound = errors.New("not found")

type Store struct {
	root string
	mu   sync.Mutex
	r2   *R2Client // nil if R2 not configured
}

func (s *Store) Root() string {
	return s.root
}

func New(root string, cfg internal.Config) (*Store, error) {
	if err := os.MkdirAll(filepath.Join(root, "uploads"), 0o755); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Join(root, "places"), 0o755); err != nil {
		return nil, err
	}
	s := &Store{root: root}
	if r2, err := NewR2Client(cfg); err == nil {
		s.r2 = r2
		log.Printf("using Cloudflare R2 (bucket: %s)", cfg.R2Bucket)
	} else {
		log.Printf("R2 not configured, using local storage")
	}
	return s, nil
}

func (s *Store) ListPlaces(userID string) ([]Place, error) {
	state, err := s.readState()
	if err != nil {
		return nil, err
	}
	places := append([]Place(nil), state.Places[userID]...)
	sort.Slice(places, func(i, j int) bool {
		return places[i].CreatedAt.After(places[j].CreatedAt)
	})
	return places, nil
}

func (s *Store) CreatePlace(userID string, input PlaceInput) (Place, error) {
	if strings.TrimSpace(input.Name) == "" {
		return Place{}, errors.New("name is required")
	}
	state, err := s.readState()
	if err != nil {
		return Place{}, err
	}
	place := Place{
		ID:         newID("place"),
		UserID:     userID,
		Name:       strings.TrimSpace(input.Name),
		Latitude:   input.Latitude,
		Longitude:  input.Longitude,
		TravelDate: strings.TrimSpace(input.TravelDate),
		Note:       strings.TrimSpace(input.Note),
		PlaceType:  strings.TrimSpace(input.PlaceType),
		Country:    strings.TrimSpace(input.Country),
		City:       strings.TrimSpace(input.City),
		CreatedAt:  time.Now().UTC(),
		UpdatedAt:  time.Now().UTC(),
		Photos:     []Photo{},
		Posts:      []Post{},
	}
	state.Places[userID] = append(state.Places[userID], place)
	return place, s.writeState(state)
}

func (s *Store) GetPlace(userID, id string) (Place, error) {
	state, err := s.readState()
	if err != nil {
		return Place{}, err
	}
	for _, place := range state.Places[userID] {
		if place.ID == id {
			return place, nil
		}
	}
	return Place{}, ErrNotFound
}

func (s *Store) UpdatePlace(userID, id string, input PlaceInput) (Place, error) {
	state, err := s.readState()
	if err != nil {
		return Place{}, err
	}
	for i, place := range state.Places[userID] {
		if place.ID != id {
			continue
		}
		place.Name = strings.TrimSpace(input.Name)
		if place.Name == "" {
			return Place{}, errors.New("name is required")
		}
		place.Latitude = input.Latitude
		place.Longitude = input.Longitude
		place.TravelDate = strings.TrimSpace(input.TravelDate)
		place.Note = strings.TrimSpace(input.Note)
		place.PlaceType = strings.TrimSpace(input.PlaceType)
		place.Country = strings.TrimSpace(input.Country)
		place.City = strings.TrimSpace(input.City)
		place.UpdatedAt = time.Now().UTC()
		state.Places[userID][i] = place
		return place, s.writeState(state)
	}
	return Place{}, ErrNotFound
}

func (s *Store) DeletePlace(userID, id string) error {
	state, err := s.readState()
	if err != nil {
		return err
	}
	places := state.Places[userID]
	for i, place := range places {
		if place.ID != id {
			continue
		}
		state.Places[userID] = append(places[:i], places[i+1:]...)
		if err := s.writeState(state); err != nil {
			return err
		}
		return os.RemoveAll(filepath.Join(s.root, "uploads", userID, id))
	}
	return ErrNotFound
}

func (s *Store) AddPhoto(userID, placeID string, input PhotoInput) (Place, error) {
	state, err := s.readState()
	if err != nil {
		return Place{}, err
	}
	for i, place := range state.Places[userID] {
		if place.ID != placeID {
			continue
		}
		ext := filepath.Ext(input.Filename)
		if ext == "" {
			ext = ".bin"
		}
		photoID := newID("photo")
		filename := photoID + ext

		var url string
		var fullPath string

		if s.r2 != nil {
			// Cloudflare R2
			key := fmt.Sprintf("photos/%s/%s/%s", userID, placeID, filename)
			_, err = s.r2.UploadReader(context.Background(), key, input.File, input.ContentType)
			if err != nil {
				return Place{}, err
			}
			fullPath = key
			url = r2MediaURL(userID, placeID, filename)
		} else {
			// local fallback
			if err := os.MkdirAll(filepath.Join(s.root, "uploads", userID, placeID), 0o755); err != nil {
				return Place{}, err
			}
			fullPath = filepath.Join(s.root, "uploads", userID, placeID, filename)
			file, err := os.Create(fullPath)
			if err != nil {
				return Place{}, err
			}
			if _, err := io.Copy(file, input.File); err != nil {
				_ = file.Close()
				return Place{}, err
			}
			if err := file.Close(); err != nil {
				return Place{}, err
			}
			url = publicURL(userID, placeID, filename)
		}

		photo := Photo{
			ID:          photoID,
			Filename:    input.Filename,
			ContentType: input.ContentType,
			Path:        fullPath,
			URL:         url,
			CreatedAt:   time.Now().UTC(),
		}
		place.Photos = append(place.Photos, photo)
		place.UpdatedAt = time.Now().UTC()
		state.Places[userID][i] = place
		return place, s.writeState(state)
	}
	return Place{}, ErrNotFound
}

func (s *Store) R2Download(key string) ([]byte, string, error) {
	if s.r2 == nil {
		return nil, "", fmt.Errorf("r2 not available")
	}
	return s.r2.Download(context.Background(), key)
}

func (s *Store) DeletePhoto(userID, placeID, photoID string) error {
	state, err := s.readState()
	if err != nil {
		return err
	}
	for i, place := range state.Places[userID] {
		if place.ID != placeID {
			continue
		}
		for j, photo := range place.Photos {
			if photo.ID != photoID {
				continue
			}
			place.Photos = append(place.Photos[:j], place.Photos[j+1:]...)
			state.Places[userID][i] = place
			if err := s.writeState(state); err != nil {
				return err
			}
			// Delete from R2 if configured, otherwise local
			if s.r2 != nil {
				return s.r2.Delete(context.Background(), photo.Path)
			}
			return os.Remove(photo.Path)
		}
		return ErrNotFound
	}
	return ErrNotFound
}

func (s *Store) AddPost(userID, placeID string, input PostInput) (Place, error) {
	if strings.TrimSpace(input.Content) == "" && strings.TrimSpace(input.Title) == "" {
		return Place{}, errors.New("title or content is required")
	}
	state, err := s.readState()
	if err != nil {
		return Place{}, err
	}
	for i, place := range state.Places[userID] {
		if place.ID != placeID {
			continue
		}
		post := Post{
			ID:        newID("post"),
			Title:     strings.TrimSpace(input.Title),
			Content:   strings.TrimSpace(input.Content),
			ImagePath: strings.TrimSpace(input.ImagePath),
			ImageURL:  strings.TrimSpace(input.ImagePath),
			CreatedAt: time.Now().UTC(),
		}
		place.Posts = append(place.Posts, post)
		place.UpdatedAt = time.Now().UTC()
		state.Places[userID][i] = place
		return place, s.writeState(state)
	}
	return Place{}, ErrNotFound
}

func (s *Store) AddPostAttachment(userID, placeID string, input PostInput, attachment PostAttachmentInput) (Place, error) {
	state, err := s.readState()
	if err != nil {
		return Place{}, err
	}
	for i, place := range state.Places[userID] {
		if place.ID != placeID {
			continue
		}
		ext := filepath.Ext(attachment.Filename)
		if ext == "" {
			ext = ".bin"
		}
		photoID := newID("postimg")
		filename := photoID + ext

		var imageURL string
		var imagePath string

		if s.r2 != nil {
			key := fmt.Sprintf("posts/%s/%s/%s", userID, placeID, filename)
			_, err = s.r2.UploadReader(context.Background(), key, attachment.File, attachment.ContentType)
			if err != nil {
				return Place{}, err
			}
			imagePath = key
			imageURL = r2MediaURL(userID, placeID, filename)
		} else {
			if err := os.MkdirAll(filepath.Join(s.root, "uploads", userID, placeID), 0o755); err != nil {
				return Place{}, err
			}
			imagePath = filepath.Join(s.root, "uploads", userID, placeID, filename)
			file, err := os.Create(imagePath)
			if err != nil {
				return Place{}, err
			}
			if _, err := io.Copy(file, attachment.File); err != nil {
				_ = file.Close()
				return Place{}, err
			}
			if err := file.Close(); err != nil {
				return Place{}, err
			}
			imageURL = publicURL(userID, placeID, filename)
		}

		post := Post{
			ID:        newID("post"),
			Title:     strings.TrimSpace(input.Title),
			Content:   strings.TrimSpace(input.Content),
			ImagePath: imagePath,
			ImageURL:  imageURL,
			CreatedAt: time.Now().UTC(),
		}
		place.Posts = append(place.Posts, post)
		place.UpdatedAt = time.Now().UTC()
		state.Places[userID][i] = place
		return place, s.writeState(state)
	}
	return Place{}, ErrNotFound
}

func (s *Store) DeletePost(userID, placeID, postID string) error {
	state, err := s.readState()
	if err != nil {
		return err
	}
	for i, place := range state.Places[userID] {
		if place.ID != placeID {
			continue
		}
		for j, post := range place.Posts {
			if post.ID != postID {
				continue
			}
			place.Posts = append(place.Posts[:j], place.Posts[j+1:]...)
			state.Places[userID][i] = place
			return s.writeState(state)
		}
		return ErrNotFound
	}
	return ErrNotFound
}

func (s *Store) statePath() string {
	return filepath.Join(s.root, "state.json")
}

func (s *Store) readState() (persistedState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	state := persistedState{Places: map[string][]Place{}}
	data, err := os.ReadFile(s.statePath())
	if errors.Is(err, os.ErrNotExist) {
		return state, nil
	}
	if err != nil {
		return state, err
	}
	if len(data) == 0 {
		return state, nil
	}
	if err := json.Unmarshal(data, &state); err != nil {
		return state, err
	}
	if state.Places == nil {
		state.Places = map[string][]Place{}
	}
	return state, nil
}

func (s *Store) writeState(state persistedState) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if state.Places == nil {
		state.Places = map[string][]Place{}
	}
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.statePath() + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, s.statePath())
}

func newID(prefix string) string {
	return fmt.Sprintf("%s_%d_%04d", prefix, time.Now().UnixNano(), rand.Intn(10000))
}

func publicURL(userID, placeID, filename string) string {
	return "/uploads/" + userID + "/" + placeID + "/" + filename
}

func r2MediaURL(userID, placeID, filename string) string {
	return fmt.Sprintf("/api/media/%s/%s/%s", userID, placeID, filename)
}
