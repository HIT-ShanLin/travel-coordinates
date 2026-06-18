package storage

import (
	"context"
	"io"
)

type UploadInput struct {
	UserID      string
	PlaceID     string
	Kind        string
	IDPrefix    string
	Filename    string
	ContentType string
	File        io.Reader
}

type UploadResult struct {
	ID          string
	Filename    string
	ContentType string
	Path        string
	URL         string
}

type Storage interface {
	Upload(ctx context.Context, input UploadInput) (UploadResult, error)
	Delete(ctx context.Context, path string) error
	DeletePlace(ctx context.Context, userID string, placeID string) error
	Download(ctx context.Context, key string) ([]byte, string, error)
}
