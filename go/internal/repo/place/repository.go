package place

import domain "travel-coordinates/go/internal/domain/place"

type Repository interface {
	List(userID string) ([]domain.Place, error)
	FindByID(userID string, placeID string) (domain.Place, error)
	Save(place domain.Place) error
	Delete(userID string, placeID string) error
}
