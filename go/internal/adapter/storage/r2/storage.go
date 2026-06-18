package r2

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"path/filepath"

	"travel-coordinates/go/internal/adapter/storage"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type Storage struct {
	client *s3.Client
	bucket string
	domain string
}

type Config struct {
	AccountID string
	AccessKey string
	SecretKey string
	Bucket    string
	Domain    string
	Endpoint  string
}

func (c Config) Enabled() bool {
	return c.AccountID != "" && c.AccessKey != "" && c.SecretKey != "" && c.Bucket != ""
}

func New(cfg Config) (*Storage, error) {
	if !cfg.Enabled() {
		return nil, fmt.Errorf("R2 not configured")
	}
	endpoint := cfg.Endpoint
	if endpoint == "" {
		endpoint = fmt.Sprintf("https://%s.r2.cloudflarestorage.com", cfg.AccountID)
	}
	awsCfg, err := config.LoadDefaultConfig(context.Background(),
		config.WithRegion("auto"),
		config.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, ""),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("r2 config: %w", err)
	}
	client := s3.NewFromConfig(awsCfg, func(options *s3.Options) {
		options.BaseEndpoint = aws.String(endpoint)
	})
	return &Storage{client: client, bucket: cfg.Bucket, domain: cfg.Domain}, nil
}

func (s *Storage) Upload(ctx context.Context, input storage.UploadInput) (storage.UploadResult, error) {
	ext := filepath.Ext(input.Filename)
	if ext == "" {
		ext = ".bin"
	}
	id := storage.NewID(input.IDPrefix)
	filename := id + ext
	key := fmt.Sprintf("%s/%s/%s/%s", input.Kind, input.UserID, input.PlaceID, filename)
	data, err := io.ReadAll(input.File)
	if err != nil {
		return storage.UploadResult{}, fmt.Errorf("r2 read: %w", err)
	}
	_, err = s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String(input.ContentType),
	})
	if err != nil {
		return storage.UploadResult{}, fmt.Errorf("r2 upload: %w", err)
	}
	log.Printf("r2 uploaded: %s (%d bytes)", key, len(data))
	return storage.UploadResult{
		ID:          id,
		Filename:    input.Filename,
		ContentType: input.ContentType,
		Path:        key,
		URL:         fmt.Sprintf("/api/media/%s/%s/%s", input.UserID, input.PlaceID, filename),
	}, nil
}

func (s *Storage) Delete(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("r2 delete: %w", err)
	}
	log.Printf("r2 deleted: %s", key)
	return nil
}

func (s *Storage) DeletePlace(ctx context.Context, userID string, placeID string) error {
	return nil
}

func (s *Storage) Download(ctx context.Context, key string) ([]byte, string, error) {
	output, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, "", fmt.Errorf("r2 download: %w", err)
	}
	defer output.Body.Close()
	data, err := io.ReadAll(output.Body)
	if err != nil {
		return nil, "", fmt.Errorf("r2 read: %w", err)
	}
	contentType := ""
	if output.ContentType != nil {
		contentType = *output.ContentType
	}
	return data, contentType, nil
}

func (s *Storage) PublicURL(key string) string {
	if s.domain != "" {
		return fmt.Sprintf("https://%s/%s", s.domain, key)
	}
	return fmt.Sprintf("https://%s.r2.cloudflarestorage.com/%s", s.bucket, key)
}
