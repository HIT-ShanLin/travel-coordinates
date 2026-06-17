package internal

import (
	"log"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
)

// Config holds all server configuration, sourced from env vars with sensible defaults.
type Config struct {
	// Server
	Port    string
	DataDir string
	WebDir  string

	// Cloudflare R2 (optional — falls back to local storage if unset)
	R2AccountID string
	R2AccessKey string
	R2SecretKey string
	R2Bucket    string
	R2Domain    string
	R2Endpoint  string // custom S3 endpoint, e.g. https://catalog.cloudflarestorage.com
}

// R2Enabled returns true if all R2 credentials are configured.
func (c Config) R2Enabled() bool {
	return c.R2AccountID != "" && c.R2AccessKey != "" && c.R2SecretKey != "" && c.R2Bucket != ""
}

func LoadConfig() Config {
	// Auto-load .env from current directory (no-op if file doesn't exist)
	if err := godotenv.Load(); err != nil {
		log.Printf("no .env file found, using system env vars only")
	}

	cfg := Config{
		Port:    envOr("PORT", "8080"),
		DataDir: envOr("TRAVEL_COORDINATES_DATA_DIR", filepath.Join("data")),
		WebDir:  resolveWebDir(),

		R2AccountID: os.Getenv("R2_ACCOUNT_ID"),
		R2AccessKey: os.Getenv("R2_ACCESS_KEY"),
		R2SecretKey: os.Getenv("R2_SECRET_KEY"),
		R2Bucket:    os.Getenv("R2_BUCKET"),
		R2Domain:    os.Getenv("R2_DOMAIN"),
		R2Endpoint:  os.Getenv("R2_ENDPOINT"),
	}
	return cfg
}

func envOr(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func resolveWebDir() string {
	if dir := os.Getenv("TRAVEL_COORDINATES_WEB_DIR"); dir != "" {
		return dir
	}
	candidates := []string{
		filepath.Join("..", "web", "dist"),
		filepath.Join("..", "..", "web", "dist"),
	}
	for _, dir := range candidates {
		if info, err := os.Stat(dir); err == nil && info.IsDir() {
			return dir
		}
	}
	return ""
}
