package bootstrap

import (
	"errors"
	"log"
	"net/http"

	httpadapter "travel-coordinates/go/internal/adapter/http"
	"travel-coordinates/go/internal/adapter/storage"
	"travel-coordinates/go/internal/adapter/storage/local"
	"travel-coordinates/go/internal/adapter/storage/r2"
	repo "travel-coordinates/go/internal/repo/place"
	service "travel-coordinates/go/internal/service/place"
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
	repository, err := repo.NewFileRepository(cfg.DataDir)
	if err != nil {
		return nil, err
	}
	mediaStorage, err := buildStorage(cfg)
	if err != nil {
		return nil, err
	}
	placeService := service.New(repository, mediaStorage)
	return httpadapter.New(placeService, cfg.DataDir, cfg.WebDir), nil
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
