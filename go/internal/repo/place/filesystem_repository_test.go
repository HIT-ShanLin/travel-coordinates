package place

import (
	"testing"
	"time"

	domain "travel-coordinates/go/internal/domain/place"
)

func TestFileRepositorySaveAndLoad(t *testing.T) {
	repository, err := NewFileRepository(t.TempDir())
	if err != nil {
		t.Fatalf("NewFileRepository() error = %v", err)
	}
	created, err := domain.NewPlace("place_1", "0001", domain.PlaceDetails{
		Name:       "Kyoto",
		Latitude:   35.0116,
		Longitude:  135.7681,
		TravelDate: "2026-06-17",
		Note:       "Night walk near the river",
		PlaceType:  "city",
		Country:    "Japan",
		City:       "Kyoto",
	}, time.Now().UTC())
	if err != nil {
		t.Fatalf("NewPlace() error = %v", err)
	}
	if err := repository.Save(created); err != nil {
		t.Fatalf("Save() error = %v", err)
	}
	reopened, err := NewFileRepository(repository.Root())
	if err != nil {
		t.Fatalf("NewFileRepository() reopened error = %v", err)
	}
	places, err := reopened.List("0001")
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(places) != 1 {
		t.Fatalf("List() len = %d, want 1", len(places))
	}
	if places[0].ID != created.ID {
		t.Fatalf("List() id = %s, want %s", places[0].ID, created.ID)
	}
}
