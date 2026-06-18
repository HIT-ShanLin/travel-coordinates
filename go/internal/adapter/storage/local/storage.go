package local

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"travel-coordinates/go/internal/adapter/storage"
)

type Storage struct {
	root string
}

func New(root string) (*Storage, error) {
	if err := os.MkdirAll(filepath.Join(root, "uploads"), 0o755); err != nil {
		return nil, err
	}
	return &Storage{root: root}, nil
}

func (s *Storage) Upload(ctx context.Context, input storage.UploadInput) (storage.UploadResult, error) {
	if err := ctx.Err(); err != nil {
		return storage.UploadResult{}, err
	}
	ext := filepath.Ext(input.Filename)
	if ext == "" {
		ext = ".bin"
	}
	id := storage.NewID(input.IDPrefix)
	filename := id + ext
	dir := filepath.Join(s.root, "uploads", input.UserID, input.PlaceID)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return storage.UploadResult{}, err
	}
	fullPath := filepath.Join(dir, filename)
	file, err := os.Create(fullPath)
	if err != nil {
		return storage.UploadResult{}, err
	}
	if _, err := io.Copy(file, input.File); err != nil {
		_ = file.Close()
		return storage.UploadResult{}, err
	}
	if err := file.Close(); err != nil {
		return storage.UploadResult{}, err
	}
	return storage.UploadResult{
		ID:          id,
		Filename:    input.Filename,
		ContentType: input.ContentType,
		Path:        fullPath,
		URL:         fmt.Sprintf("/uploads/%s/%s/%s", input.UserID, input.PlaceID, filename),
	}, nil
}

func (s *Storage) Delete(ctx context.Context, path string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	return os.Remove(path)
}

func (s *Storage) DeletePlace(ctx context.Context, userID string, placeID string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	return os.RemoveAll(filepath.Join(s.root, "uploads", userID, placeID))
}

func (s *Storage) Download(ctx context.Context, key string) ([]byte, string, error) {
	return nil, "", fmt.Errorf("local storage download is served by static file server")
}
