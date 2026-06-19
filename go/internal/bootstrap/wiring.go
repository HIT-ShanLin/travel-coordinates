package bootstrap

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"

	"github.com/redis/go-redis/v9"

	httpadapter "travel-coordinates/go/internal/adapter/http"
	"travel-coordinates/go/internal/adapter/sms"
	"travel-coordinates/go/internal/adapter/storage"
	"travel-coordinates/go/internal/adapter/storage/local"
	"travel-coordinates/go/internal/adapter/storage/r2"
	repo "travel-coordinates/go/internal/repo/place"
	authsvc "travel-coordinates/go/internal/service/auth"
	placesvc "travel-coordinates/go/internal/service/place"
)

func RunServer() error {
	cfg := LoadConfig()
	server, err := BuildHTTPServer(cfg)
	if err != nil {
		return err
	}
	log.Printf("travel coordinates api listening on :%s", cfg.Port)
	err = http.ListenAndServe(":"+cfg.Port, server.Mux())
	if err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

func BuildHTTPServer(cfg Config) (*httpadapter.Server, error) {
	// MySQL
	db, err := sql.Open("mysql", cfg.MySQLDSN)
	if err != nil {
		return nil, fmt.Errorf("mysql open: %w", err)
	}
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("mysql ping: %w", err)
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)

	// Redis
	redisCli := redis.NewClient(&redis.Options{Addr: cfg.RedisAddr})
	if err := redisCli.Ping(ctx()).Err(); err != nil {
		return nil, fmt.Errorf("redis ping: %w", err)
	}

	// Place repository
	placeRepo, err := repo.NewMySQLRepositoryFromDB(db)
	if err != nil {
		return nil, fmt.Errorf("place repo: %w", err)
	}

	// Media storage
	mediaStorage, err := buildStorage(cfg)
	if err != nil {
		return nil, err
	}

	// Services
	placeService := placesvc.New(placeRepo, mediaStorage)

	smsCli := sms.New(cfg.SMSAccessKeyID, cfg.SMSAccessKeySecret, cfg.SMSSignName, cfg.SMSTemplateCode)
	authService := authsvc.New(db, redisCli, smsCli, cfg.JWTSecret)

	return httpadapter.New(placeService, authService, cfg.DataDir, cfg.WebDir, cfg.JWTSecret), nil
}

func buildStorage(cfg Config) (storage.Storage, error) {
	if cfg.R2Enabled() {
		mediaStorage, err := r2.New(r2.Config{
			AccountID: cfg.R2AccountID,
			AccessKey: cfg.R2AccessKey,
			SecretKey: cfg.R2SecretKey,
			Bucket:    cfg.R2Bucket,
			Domain:    cfg.R2Domain,
			Endpoint:  cfg.R2Endpoint,
		})
		if err == nil {
			log.Printf("using Cloudflare R2 (bucket: %s)", cfg.R2Bucket)
			return mediaStorage, nil
		}
		log.Printf("R2 not available, using local storage: %v", err)
	}
	return local.New(cfg.DataDir)
}

func ctx() context.Context {
	return context.Background()
}
