package middleware

import (
	"context"
	"net/http"
	"strings"

	pkgjwt "travel-coordinates/go/pkg/jwt"
)

type contextKey string

const UserIDKey contextKey = "user_id"

func AuthRequired(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// When no secret is configured, skip authentication (dev/test mode)
			if secret == "" {
				ctx := context.WithValue(r.Context(), UserIDKey, "0001")
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}
			header := r.Header.Get("Authorization")
			if header == "" || !strings.HasPrefix(header, "Bearer ") {
				http.Error(w, `{"error":"missing authorization header"}`, http.StatusUnauthorized)
				return
			}
			tokenStr := strings.TrimPrefix(header, "Bearer ")
			claims, err := pkgjwt.Verify(tokenStr, secret)
			if err != nil {
				http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
				return
			}
			ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetUserID(ctx context.Context) string {
	uid, _ := ctx.Value(UserIDKey).(string)
	return uid
}
