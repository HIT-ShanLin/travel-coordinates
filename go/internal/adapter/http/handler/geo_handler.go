package handler

import (
	"fmt"
	"net/http"
	"strconv"

	"travel-coordinates/go/internal/service/geo"
)

// GeoHandler handles location search and reverse geocoding HTTP requests.
type GeoHandler struct {
	service *geo.GeoService
}

// NewGeoHandler creates a GeoHandler.
func NewGeoHandler(service *geo.GeoService) *GeoHandler {
	return &GeoHandler{service: service}
}

// Suggest handles GET /api/geo/suggest?q=<keyword>.
// Returns a list of matching locations from the cache or Amap API.
func (h *GeoHandler) Suggest(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		writeJSON(w, http.StatusOK, map[string]any{"suggestions": []geo.SuggestItem{}})
		return
	}
	items, err := h.service.Suggest(r.Context(), q)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"suggestions": items})
}

// Reverse handles GET /api/geo/reverse?lat=<lat>&lng=<lng>.
// Returns the address info (country, city, name) for the given coordinates.
func (h *GeoHandler) Reverse(w http.ResponseWriter, r *http.Request) {
	latStr := r.URL.Query().Get("lat")
	lngStr := r.URL.Query().Get("lng")
	if latStr == "" || lngStr == "" {
		writeError(w, http.StatusBadRequest, fmt.Errorf("lat and lng are required"))
		return
	}
	lat, err := strconv.ParseFloat(latStr, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Errorf("invalid lat"))
		return
	}
	lng, err := strconv.ParseFloat(lngStr, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Errorf("invalid lng"))
		return
	}
	rr, err := h.service.Reverse(r.Context(), lat, lng)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, rr)
}
