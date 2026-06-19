package auth

import (
	"context"
	"crypto/rand"
	"database/sql"
	"fmt"
	"math/big"
	"time"

	"github.com/redis/go-redis/v9"

	"travel-coordinates/go/internal/adapter/sms"
	pkgjwt "travel-coordinates/go/pkg/jwt"
)

type User struct {
	ID        string    `json:"id"`
	Phone     string    `json:"phone"`
	Nickname  string    `json:"nickname"`
	AvatarURL string    `json:"avatar_url"`
	CreatedAt time.Time `json:"created_at"`
}

type Service struct {
	db     *sql.DB
	redis  *redis.Client
	sms    *sms.AliyunClient
	jwtSec string
}

func New(db *sql.DB, redisCli *redis.Client, smsCli *sms.AliyunClient, jwtSecret string) *Service {
	return &Service{
		db:     db,
		redis:  redisCli,
		sms:    smsCli,
		jwtSec: jwtSecret,
	}
}

func (s *Service) SendCode(ctx context.Context, phone string) error {
	// generate 6-digit code
	code, err := randomCode(6)
	if err != nil {
		return fmt.Errorf("generate code: %w", err)
	}

	// store in Redis with 5min TTL
	key := "sms:" + phone
	if err := s.redis.Set(ctx, key, code, 5*time.Minute).Err(); err != nil {
		return fmt.Errorf("redis set: %w", err)
	}

	// send via Alibaba Cloud SMS
	if err := s.sms.SendCode(phone, code); err != nil {
		// don't fail — code is stored, SMS may have issues
		fmt.Printf("SMS send failed for %s: %v\n", phone, err)
	}

	return nil
}

func (s *Service) Login(ctx context.Context, phone, code string) (*User, string, error) {
	// verify code
	key := "sms:" + phone
	stored, err := s.redis.Get(ctx, key).Result()
	if err == redis.Nil {
		return nil, "", fmt.Errorf("验证码已过期或未发送")
	}
	if err != nil {
		return nil, "", fmt.Errorf("redis get: %w", err)
	}
	if stored != code {
		return nil, "", fmt.Errorf("验证码错误")
	}

	// delete used code
	s.redis.Del(ctx, key)

	// find or create user
	user, err := s.findUserByPhone(ctx, phone)
	if err != nil && err != sql.ErrNoRows {
		return nil, "", fmt.Errorf("find user: %w", err)
	}
	if user == nil {
		user, err = s.createUser(ctx, phone)
		if err != nil {
			return nil, "", fmt.Errorf("create user: %w", err)
		}
	}

	// sign JWT
	token, err := pkgjwt.Sign(user.ID, user.Phone, s.jwtSec)
	if err != nil {
		return nil, "", fmt.Errorf("jwt sign: %w", err)
	}

	return user, token, nil
}

func (s *Service) GetMe(ctx context.Context, userID string) (*User, error) {
	return s.findUserByID(ctx, userID)
}

// --- private ---

func (s *Service) findUserByPhone(ctx context.Context, phone string) (*User, error) {
	var u User
	err := s.db.QueryRowContext(ctx,
		"SELECT id, phone, COALESCE(nickname,''), COALESCE(avatar_url,''), created_at FROM users WHERE phone = ?",
		phone,
	).Scan(&u.ID, &u.Phone, &u.Nickname, &u.AvatarURL, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Service) findUserByID(ctx context.Context, id string) (*User, error) {
	var u User
	err := s.db.QueryRowContext(ctx,
		"SELECT id, phone, COALESCE(nickname,''), COALESCE(avatar_url,''), created_at FROM users WHERE id = ?",
		id,
	).Scan(&u.ID, &u.Phone, &u.Nickname, &u.AvatarURL, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Service) createUser(ctx context.Context, phone string) (*User, error) {
	id := newID("user")
	now := time.Now().UTC()
	_, err := s.db.ExecContext(ctx,
		"INSERT INTO users (id, phone, created_at) VALUES (?, ?, ?)",
		id, phone, now,
	)
	if err != nil {
		return nil, fmt.Errorf("insert user: %w", err)
	}
	return &User{ID: id, Phone: phone, CreatedAt: now}, nil
}

func randomCode(length int) (string, error) {
	code := ""
	for i := 0; i < length; i++ {
		n, err := rand.Int(rand.Reader, big.NewInt(10))
		if err != nil {
			return "", err
		}
		code += fmt.Sprintf("%d", n.Int64())
	}
	return code, nil
}

func newID(prefix string) string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("%s-%x", prefix, b)
}
