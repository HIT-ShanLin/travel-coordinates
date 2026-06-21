package bootstrap

import (
	"bufio"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port    string
	DataDir string
	WebDir  string

	// MySQL
	MySQLDSN string

	// Redis
	RedisAddr string

	// Amap
	AmapKey string

	// JWT
	JWTSecret string

	// Alibaba Cloud SMS
	SMSAccessKeyID     string
	SMSAccessKeySecret string
	SMSSignName        string
	SMSTemplateCode    string

	// R2
	R2AccountID string
	R2AccessKey string
	R2SecretKey string
	R2Bucket    string
	R2Domain    string
	R2Endpoint  string
}

func (c Config) R2Enabled() bool {
	return c.R2AccountID != "" && c.R2AccessKey != "" && c.R2SecretKey != "" && c.R2Bucket != ""
}

func LoadConfig() Config {
	if err := godotenv.Load(); err != nil {
		log.Printf("no .env file found, using system env vars only")
	}
	values := readConfigFile(filepath.Join("configs", "config.yaml"))
	cfg := Config{
		Port:               valueOr(values["port"], "8080"),
		DataDir:            valueOr(values["data_dir"], filepath.Join("data")),
		WebDir:             values["web_dir"],
		MySQLDSN:           values["mysql_dsn"],
		AmapKey:            values["amap_key"],
		RedisAddr:          valueOr(values["redis_addr"], "127.0.0.1:6379"),
		JWTSecret:          valueOr(values["jwt_secret"], "change-me"),
		SMSAccessKeyID:     values["sms_access_key_id"],
		SMSAccessKeySecret: values["sms_access_key_secret"],
		SMSSignName:        valueOr(values["sms_sign_name"], "云渚科技验证服务"),
		SMSTemplateCode:    valueOr(values["sms_template_code"], "100001"),
		R2AccountID:        values["r2_account_id"],
		R2AccessKey:        values["r2_access_key"],
		R2SecretKey:        values["r2_secret_key"],
		R2Bucket:           values["r2_bucket"],
		R2Domain:           values["r2_domain"],
		R2Endpoint:         values["r2_endpoint"],
	}
	cfg.Port = envOr("PORT", cfg.Port)
	cfg.DataDir = envOr("TRAVEL_COORDINATES_DATA_DIR", cfg.DataDir)
	cfg.WebDir = envOr("TRAVEL_COORDINATES_WEB_DIR", cfg.WebDir)
	cfg.AmapKey = envOr("AMAP_KEY", cfg.AmapKey)
	cfg.MySQLDSN = envOr("MYSQL_DSN", cfg.MySQLDSN)
	cfg.RedisAddr = envOr("REDIS_ADDR", cfg.RedisAddr)
	cfg.JWTSecret = envOr("JWT_SECRET", cfg.JWTSecret)
	cfg.SMSAccessKeyID = envOr("SMS_ACCESS_KEY_ID", cfg.SMSAccessKeyID)
	cfg.SMSAccessKeySecret = envOr("SMS_ACCESS_KEY_SECRET", cfg.SMSAccessKeySecret)
	cfg.SMSSignName = envOr("SMS_SIGN_NAME", cfg.SMSSignName)
	cfg.SMSTemplateCode = envOr("SMS_TEMPLATE_CODE", cfg.SMSTemplateCode)
	cfg.R2AccountID = envOr("R2_ACCOUNT_ID", cfg.R2AccountID)
	cfg.R2AccessKey = envOr("R2_ACCESS_KEY", cfg.R2AccessKey)
	cfg.R2SecretKey = envOr("R2_SECRET_KEY", cfg.R2SecretKey)
	cfg.R2Bucket = envOr("R2_BUCKET", cfg.R2Bucket)
	cfg.R2Domain = envOr("R2_DOMAIN", cfg.R2Domain)
	cfg.R2Endpoint = envOr("R2_ENDPOINT", cfg.R2Endpoint)
	if cfg.WebDir == "" {
		cfg.WebDir = resolveWebDir()
	}
	return cfg
}

func readConfigFile(path string) map[string]string {
	values := map[string]string{}
	file, err := os.Open(path)
	if err != nil {
		return values
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		values[strings.TrimSpace(key)] = strings.Trim(strings.TrimSpace(value), `"`)
	}
	return values
}

func valueOr(value string, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func envOr(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func resolveWebDir() string {
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
