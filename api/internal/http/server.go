package http

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"travel-coordinates/api/internal/store"
)

const defaultUserID = "0001"

type Server struct {
	store *store.Store
	mux   *http.ServeMux
}

func Run() {
	dataDir := envOr("TRAVEL_COORDINATES_DATA_DIR", filepath.Join("data"))
	addr := envOr("PORT", "8080")

	s, err := store.New(dataDir)
	if err != nil {
		log.Fatal(err)
	}

	server := New(s)
	log.Printf("travel coordinates api listening on :%s", addr)
	if err := http.ListenAndServe(":"+addr, server.Mux()); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}

func New(s *store.Store) *Server {
	mux := http.NewServeMux()
	server := &Server{store: s, mux: mux}

	mux.Handle("GET /uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(filepath.Join(s.Root(), "uploads")))))
	mux.HandleFunc("GET /healthz", server.healthz)
	mux.HandleFunc("GET /api/places", server.listPlaces)
	mux.HandleFunc("POST /api/places", server.createPlace)
	mux.HandleFunc("GET /api/places/{id}", server.getPlace)
	mux.HandleFunc("PUT /api/places/{id}", server.updatePlace)
	mux.HandleFunc("DELETE /api/places/{id}", server.deletePlace)
	mux.HandleFunc("POST /api/places/{id}/photos", server.addPhoto)
	mux.HandleFunc("DELETE /api/places/{id}/photos/{photoId}", server.deletePhoto)
	mux.HandleFunc("POST /api/places/{id}/posts", server.addPost)
	mux.HandleFunc("DELETE /api/places/{id}/posts/{postId}", server.deletePost)

	return server
}

func (s *Server) Mux() *http.ServeMux {
	return s.mux
}

func (s *Server) healthz(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) listPlaces(w http.ResponseWriter, r *http.Request) {
	places, err := s.store.ListPlaces(defaultUserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"places": places})
}

func (s *Server) createPlace(w http.ResponseWriter, r *http.Request) {
	var req store.PlaceInput
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	place, err := s.store.CreatePlace(defaultUserID, req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusCreated, place)
}

func (s *Server) getPlace(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	place, err := s.store.GetPlace(defaultUserID, id)
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	writeJSON(w, http.StatusOK, place)
}

func (s *Server) updatePlace(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req store.PlaceInput
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	place, err := s.store.UpdatePlace(defaultUserID, id, req)
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	writeJSON(w, http.StatusOK, place)
}

func (s *Server) deletePlace(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.store.DeletePlace(defaultUserID, id); err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) addPhoto(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := r.ParseMultipartForm(16 << 20); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	defer file.Close()

	place, err := s.store.AddPhoto(defaultUserID, id, store.PhotoInput{
		Filename:    header.Filename,
		ContentType: header.Header.Get("Content-Type"),
		File:        file,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusCreated, place)
}

func (s *Server) deletePhoto(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	photoID := r.PathValue("photoId")
	if err := s.store.DeletePhoto(defaultUserID, id, photoID); err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) addPost(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	contentType := r.Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "multipart/form-data") {
		if err := r.ParseMultipartForm(16 << 20); err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		req := store.PostInput{
			Title:   strings.TrimSpace(r.FormValue("title")),
			Content: strings.TrimSpace(r.FormValue("content")),
		}
		file, header, err := r.FormFile("file")
		if err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		defer file.Close()
		place, err := s.store.AddPostAttachment(defaultUserID, id, req, store.PostAttachmentInput{
			Filename:    header.Filename,
			ContentType: header.Header.Get("Content-Type"),
			File:        file,
		})
		if err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		writeJSON(w, http.StatusCreated, place)
		return
	}
	var req store.PostInput
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	place, err := s.store.AddPost(defaultUserID, id, req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusCreated, place)
}

func (s *Server) deletePost(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	postID := r.PathValue("postId")
	if err := s.store.DeletePost(defaultUserID, id, postID); err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func decodeJSON(r *http.Request, v any) error {
	defer r.Body.Close()
	dec := json.NewDecoder(io.LimitReader(r.Body, 2<<20))
	dec.DisallowUnknownFields()
	return dec.Decode(v)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

func envOr(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
