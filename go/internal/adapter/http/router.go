package http

import (
	"net/http"
	"path/filepath"

	"travel-coordinates/go/internal/adapter/http/handler"
	"travel-coordinates/go/internal/adapter/http/middleware"
	authsvc "travel-coordinates/go/internal/service/auth"
	geosvc "travel-coordinates/go/internal/service/geo"
	place "travel-coordinates/go/internal/service/place"
)

type Server struct {
	handler     *handler.PlaceHandler
	authHandler *handler.AuthHandler
	mux         *http.ServeMux
	jwtSecret   string
	webDir      string
	dataDir     string
}

func New(placeService *place.Service, authService *authsvc.Service, geoService *geosvc.GeoService, dataDir string, webDir string, jwtSecret string) *Server {
	h := handler.NewPlaceHandler(placeService)
	ah := handler.NewAuthHandler(authService)
	gh := handler.NewGeoHandler(geoService)
	mux := http.NewServeMux()
	server := &Server{
		handler:     h,
		authHandler: ah,
		mux:         mux,
		jwtSecret:   jwtSecret,
		webDir:      webDir,
		dataDir:     dataDir,
	}

	// public
	mux.HandleFunc("/healthz", h.Healthz)

	// geo (public)
	mux.HandleFunc("GET /api/geo/suggest", gh.Suggest)
	mux.HandleFunc("GET /api/geo/reverse", gh.Reverse)

	// auth (no JWT required)
	mux.HandleFunc("POST /api/auth/send-code", ah.SendCode)
	mux.HandleFunc("POST /api/auth/login", ah.Login)

	// protected (JWT required)
	protected := http.NewServeMux()
	protected.HandleFunc("GET /api/places", h.ListPlaces)
	protected.HandleFunc("POST /api/places", h.CreatePlace)
	protected.HandleFunc("GET /api/places/{id}", h.GetPlace)
	protected.HandleFunc("PUT /api/places/{id}", h.UpdatePlace)
	protected.HandleFunc("DELETE /api/places/{id}", h.DeletePlace)
	protected.HandleFunc("POST /api/places/{id}/photos", h.AddPhoto)
	protected.HandleFunc("DELETE /api/places/{id}/photos/{photoId}", h.DeletePhoto)
	protected.HandleFunc("POST /api/places/{id}/posts", h.AddPost)
	protected.HandleFunc("DELETE /api/places/{id}/posts/{postId}", h.DeletePost)
	protected.HandleFunc("GET /api/auth/me", ah.Me)
	mux.Handle("/api/", middleware.AuthRequired(jwtSecret)(protected))

	// media (public URLs for uploaded files)
	mux.Handle("GET /uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(filepath.Join(dataDir, "uploads")))))
	mux.HandleFunc("GET /api/media/{userID}/{placeID}/{filename}", h.ServeMedia)

	// serve frontend (exact root only — SPA routes handled by frontend router)
	if webDir != "" {
		assetDir := filepath.Join(webDir, "assets")
		mux.Handle("GET /assets/", http.StripPrefix("/assets/", http.FileServer(http.Dir(assetDir))))
		mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
			http.ServeFile(w, r, filepath.Join(webDir, "index.html"))
		})
	}

	return server
}

func (s *Server) Mux() *http.ServeMux {
	return s.mux
}
