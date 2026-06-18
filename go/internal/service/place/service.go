package place

import (
	"context"
	"fmt"
	"strings"
	"time"

	"travel-coordinates/go/internal/adapter/storage"
	domain "travel-coordinates/go/internal/domain/place"
	repo "travel-coordinates/go/internal/repo/place"
)

type Service struct {
	repository repo.Repository
	storage    storage.Storage
	now        func() time.Time
	newID      func(prefix string) string
}

func New(repository repo.Repository, mediaStorage storage.Storage) *Service {
	return &Service{
		repository: repository,
		storage:    mediaStorage,
		now:        func() time.Time { return time.Now().UTC() },
		newID:      storage.NewID,
	}
}

func (s *Service) ListPlaces(ctx context.Context, userID string) ([]domain.Place, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	places, err := s.repository.List(userID)
	if err != nil {
		return nil, err
	}
	if places == nil {
		return []domain.Place{}, nil
	}
	return places, nil
}

func (s *Service) CreatePlace(ctx context.Context, userID string, input PlaceInput) (domain.Place, error) {
	if err := ctx.Err(); err != nil {
		return domain.Place{}, err
	}
	place, err := domain.NewPlace(s.newID("place"), userID, details(input), s.now())
	if err != nil {
		return domain.Place{}, err
	}
	if err := s.repository.Save(place); err != nil {
		return domain.Place{}, err
	}
	return place, nil
}

func (s *Service) GetPlace(ctx context.Context, userID string, placeID string) (domain.Place, error) {
	if err := ctx.Err(); err != nil {
		return domain.Place{}, err
	}
	return s.repository.FindByID(userID, placeID)
}

func (s *Service) UpdatePlace(ctx context.Context, userID string, placeID string, input PlaceInput) (domain.Place, error) {
	if err := ctx.Err(); err != nil {
		return domain.Place{}, err
	}
	place, err := s.repository.FindByID(userID, placeID)
	if err != nil {
		return domain.Place{}, err
	}
	if err := place.Update(details(input), s.now()); err != nil {
		return domain.Place{}, err
	}
	if err := s.repository.Save(place); err != nil {
		return domain.Place{}, err
	}
	return place, nil
}

func (s *Service) DeletePlace(ctx context.Context, userID string, placeID string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := s.repository.Delete(userID, placeID); err != nil {
		return err
	}
	return s.storage.DeletePlace(ctx, userID, placeID)
}

func (s *Service) AddPhoto(ctx context.Context, userID string, placeID string, input PhotoInput) (domain.Place, error) {
	place, err := s.repository.FindByID(userID, placeID)
	if err != nil {
		return domain.Place{}, err
	}
	result, err := s.storage.Upload(ctx, storage.UploadInput{
		UserID:      userID,
		PlaceID:     placeID,
		Kind:        "photos",
		IDPrefix:    "photo",
		Filename:    input.Filename,
		ContentType: input.ContentType,
		File:        input.File,
	})
	if err != nil {
		return domain.Place{}, err
	}
	now := s.now()
	place.AddPhoto(domain.Photo{
		ID:          result.ID,
		Filename:    result.Filename,
		ContentType: result.ContentType,
		Path:        result.Path,
		URL:         result.URL,
		CreatedAt:   now,
	}, now)
	if err := s.repository.Save(place); err != nil {
		return domain.Place{}, err
	}
	return place, nil
}

func (s *Service) DeletePhoto(ctx context.Context, userID string, placeID string, photoID string) error {
	place, err := s.repository.FindByID(userID, placeID)
	if err != nil {
		return err
	}
	photo, err := place.RemovePhoto(photoID, s.now())
	if err != nil {
		return err
	}
	if err := s.repository.Save(place); err != nil {
		return err
	}
	return s.storage.Delete(ctx, photo.Path)
}

func (s *Service) AddPost(ctx context.Context, userID string, placeID string, input PostInput) (domain.Place, error) {
	if err := domain.ValidatePost(input.Title, input.Content); err != nil {
		return domain.Place{}, err
	}
	place, err := s.repository.FindByID(userID, placeID)
	if err != nil {
		return domain.Place{}, err
	}
	now := s.now()
	place.AddPost(domain.Post{
		ID:        s.newID("post"),
		Title:     strings.TrimSpace(input.Title),
		Content:   strings.TrimSpace(input.Content),
		ImagePath: strings.TrimSpace(input.ImagePath),
		ImageURL:  strings.TrimSpace(input.ImagePath),
		CreatedAt: now,
	}, now)
	if err := s.repository.Save(place); err != nil {
		return domain.Place{}, err
	}
	return place, nil
}

func (s *Service) AddPostAttachment(ctx context.Context, userID string, placeID string, input PostAttachmentInput) (domain.Place, error) {
	if err := domain.ValidatePost(input.Title, input.Content); err != nil {
		return domain.Place{}, err
	}
	place, err := s.repository.FindByID(userID, placeID)
	if err != nil {
		return domain.Place{}, err
	}
	result, err := s.storage.Upload(ctx, storage.UploadInput{
		UserID:      userID,
		PlaceID:     placeID,
		Kind:        "posts",
		IDPrefix:    "postimg",
		Filename:    input.Filename,
		ContentType: input.ContentType,
		File:        input.File,
	})
	if err != nil {
		return domain.Place{}, err
	}
	now := s.now()
	place.AddPost(domain.Post{
		ID:        s.newID("post"),
		Title:     strings.TrimSpace(input.Title),
		Content:   strings.TrimSpace(input.Content),
		ImagePath: result.Path,
		ImageURL:  result.URL,
		CreatedAt: now,
	}, now)
	if err := s.repository.Save(place); err != nil {
		return domain.Place{}, err
	}
	return place, nil
}

func (s *Service) DeletePost(ctx context.Context, userID string, placeID string, postID string) error {
	place, err := s.repository.FindByID(userID, placeID)
	if err != nil {
		return err
	}
	if err := place.RemovePost(postID, s.now()); err != nil {
		return err
	}
	return s.repository.Save(place)
}

func (s *Service) DownloadMedia(ctx context.Context, userID string, placeID string, filename string) ([]byte, string, error) {
	photoKey := fmt.Sprintf("photos/%s/%s/%s", userID, placeID, filename)
	data, contentType, err := s.storage.Download(ctx, photoKey)
	if err == nil {
		return data, contentType, nil
	}
	postKey := fmt.Sprintf("posts/%s/%s/%s", userID, placeID, filename)
	return s.storage.Download(ctx, postKey)
}

func details(input PlaceInput) domain.PlaceDetails {
	return domain.PlaceDetails{
		Name:       input.Name,
		Latitude:   input.Latitude,
		Longitude:  input.Longitude,
		TravelDate: input.TravelDate,
		Note:       input.Note,
		PlaceType:  input.PlaceType,
		Country:    input.Country,
		City:       input.City,
	}
}
