package store

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"

	"travel-coordinates/api/internal"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type R2Client struct {
	client *s3.Client
	bucket string
	domain string
}

func NewR2Client(cfg internal.Config) (*R2Client, error) {
	if !cfg.R2Enabled() {
		return nil, fmt.Errorf("R2 not configured")
	}

	// Use custom endpoint if set, otherwise default R2 endpoint
	endpoint := cfg.R2Endpoint
	if endpoint == "" {
		endpoint = fmt.Sprintf("https://%s.r2.cloudflarestorage.com", cfg.R2AccountID)
	}

	awsCfg, err := config.LoadDefaultConfig(context.Background(),
		config.WithRegion("auto"),
		config.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(cfg.R2AccessKey, cfg.R2SecretKey, ""),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("r2 config: %w", err)
	}

	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpoint)
	})

	return &R2Client{
		client: client,
		bucket: cfg.R2Bucket,
		domain: cfg.R2Domain,
	}, nil
}

func (r *R2Client) Upload(ctx context.Context, key string, data []byte, contentType string) (string, error) {
	_, err := r.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(r.bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return "", fmt.Errorf("r2 upload: %w", err)
	}

	url := r.PublicURL(key)
	log.Printf("r2 uploaded: %s (%d bytes)", key, len(data))
	return url, nil
}

func (r *R2Client) UploadReader(ctx context.Context, key string, rdr io.Reader, contentType string) (string, error) {
	data, err := io.ReadAll(rdr)
	if err != nil {
		return "", fmt.Errorf("r2 read: %w", err)
	}
	return r.Upload(ctx, key, data, contentType)
}

func (r *R2Client) Download(ctx context.Context, key string) ([]byte, string, error) {
	out, err := r.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(r.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, "", fmt.Errorf("r2 download: %w", err)
	}
	defer out.Body.Close()

	data, err := io.ReadAll(out.Body)
	if err != nil {
		return nil, "", fmt.Errorf("r2 read: %w", err)
	}
	ct := ""
	if out.ContentType != nil {
		ct = *out.ContentType
	}
	return data, ct, nil
}

func (r *R2Client) Delete(ctx context.Context, key string) error {
	_, err := r.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(r.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("r2 delete: %w", err)
	}
	log.Printf("r2 deleted: %s", key)
	return nil
}

func (r *R2Client) PublicURL(key string) string {
	if r.domain != "" {
		return fmt.Sprintf("https://%s/%s", r.domain, key)
	}
	return fmt.Sprintf("https://%s.r2.cloudflarestorage.com/%s", r.bucket, key)
}
