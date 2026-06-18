// Package place implements the gRPC PlaceService server.
// Generated from api/proto/place/v1/place.proto when gRPC transport is enabled.
package place

import (
	place "travel-coordinates/go/internal/service/place"
)

// Server delegates business logic to the service layer.
type Server struct {
	service *place.Service
}

// NewServer creates a gRPC PlaceService server.
func NewServer(svc *place.Service) *Server {
	return &Server{service: svc}
}
