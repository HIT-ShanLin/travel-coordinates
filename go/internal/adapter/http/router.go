package http

import (
	"net/http"
	"path/filepath"

	"travel-coordinates/go/internal/adapter/http/handler"
	place "travel-coordinates/go/internal/service/place"
)

type Server struct {
	handler *handler.PlaceHandler
	mux     *http.ServeMux
	webDir  string
	dataDir string
}

func New(service *place.Service, dataDir string, webDir string) *Server {
	h := handler.NewPlaceHandler(service)
	mux := http.NewServeMux()
	server := &Server{handler: h, mux: mux, webDir: webDir, dataDir: dataDir}

	mux.Handle("GET /uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(filepath.Join(dataDir, "uploads")))))
	mux.HandleFunc("GET /api/media/{userID}/{placeID}/{filename}", h.ServeMedia)
	mux.HandleFunc("GET /healthz", h.Healthz)
	mux.HandleFunc("GET /api/places", h.ListPlaces)
	mux.HandleFunc("POST /api/places", h.CreatePlace)
	mux.HandleFunc("GET /api/places/{id}", h.GetPlace)
	mux.HandleFunc("PUT /api/places/{id}", h.UpdatePlace)
	mux.HandleFunc("DELETE /api/places/{id}", h.DeletePlace)
	mux.HandleFunc("POST /api/places/{id}/photos", h.AddPhoto)
	mux.HandleFunc("DELETE /api/places/{id}/photos/{photoId}", h.DeletePhoto)
	mux.HandleFunc("POST /api/places/{id}/posts", h.AddPost)
	mux.HandleFunc("DELETE /api/places/{id}/posts/{postId}", h.DeletePost)

	if webDir != "" {
		assetDir := filepath.Join(webDir, "assets")
		mux.Handle("GET /assets/", http.StripPrefix("/assets/", http.FileServer(http.Dir(assetDir))))
		mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
			http.ServeFile(w, r, filepath.Join(webDir, "index.html"))
		})
	}

	return server
}

func (s *Server) Mux() *http.ServeMux {
	return s.mux
}
