package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"travel-coordinates/go/internal/adapter/http/middleware"
	place "travel-coordinates/go/internal/service/place"
)



type PlaceHandler struct {
	service *place.Service
}

func NewPlaceHandler(service *place.Service) *PlaceHandler {
	return &PlaceHandler{service: service}
}

// --- media proxy -----------------------------------------------------------

func (h *PlaceHandler) ServeMedia(w http.ResponseWriter, r *http.Request) {
	data, contentType, err := h.service.DownloadMedia(
		r.Context(),
		r.PathValue("userID"),
		r.PathValue("placeID"),
		r.PathValue("filename"),
	)
	if err != nil {
		writeError(w, http.StatusNotFound, fmt.Errorf("media not found"))
		return
	}
	if contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}
	w.Header().Set("Cache-Control", "public, max-age=86400")
	_, _ = w.Write(data)
}

// --- health ----------------------------------------------------------------

func (h *PlaceHandler) Healthz(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// --- places ----------------------------------------------------------------

func (h *PlaceHandler) ListPlaces(w http.ResponseWriter, r *http.Request) {
	places, err := h.service.ListPlaces(r.Context(), middleware.GetUserID(r.Context()))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"places": places})
}

func (h *PlaceHandler) CreatePlace(w http.ResponseWriter, r *http.Request) {
	var req place.PlaceInput
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	created, err := h.service.CreatePlace(r.Context(), middleware.GetUserID(r.Context()), req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (h *PlaceHandler) GetPlace(w http.ResponseWriter, r *http.Request) {
	found, err := h.service.GetPlace(r.Context(), middleware.GetUserID(r.Context()), r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	writeJSON(w, http.StatusOK, found)
}

func (h *PlaceHandler) UpdatePlace(w http.ResponseWriter, r *http.Request) {
	var req place.PlaceInput
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	updated, err := h.service.UpdatePlace(r.Context(), middleware.GetUserID(r.Context()), r.PathValue("id"), req)
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (h *PlaceHandler) DeletePlace(w http.ResponseWriter, r *http.Request) {
	if err := h.service.DeletePlace(r.Context(), middleware.GetUserID(r.Context()), r.PathValue("id")); err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- photos ----------------------------------------------------------------

func (h *PlaceHandler) AddPhoto(w http.ResponseWriter, r *http.Request) {
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
	updated, err := h.service.AddPhoto(r.Context(), middleware.GetUserID(r.Context()), r.PathValue("id"), place.PhotoInput{
		Filename:    header.Filename,
		ContentType: header.Header.Get("Content-Type"),
		File:        file,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusCreated, updated)
}

func (h *PlaceHandler) DeletePhoto(w http.ResponseWriter, r *http.Request) {
	err := h.service.DeletePhoto(r.Context(), middleware.GetUserID(r.Context()), r.PathValue("id"), r.PathValue("photoId"))
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- posts -----------------------------------------------------------------

func (h *PlaceHandler) AddPost(w http.ResponseWriter, r *http.Request) {
	placeID := r.PathValue("id")
	var req place.PostInput
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	updated, err := h.service.AddPost(r.Context(), middleware.GetUserID(r.Context()), placeID, req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusCreated, updated)
}

func (h *PlaceHandler) DeletePost(w http.ResponseWriter, r *http.Request) {
	err := h.service.DeletePost(r.Context(), middleware.GetUserID(r.Context()), r.PathValue("id"), r.PathValue("postId"))
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- helpers ---------------------------------------------------------------

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
