package place

import (
	"testing"
	"time"
)

var now = time.Date(2026, 6, 18, 12, 0, 0, 0, time.UTC)

func TestNewPlace(t *testing.T) {
	place, err := NewPlace("p1", "u1", PlaceDetails{
		Name:       "Test",
		Latitude:   31.23,
		Longitude:  121.47,
		TravelDate: "2026-06-18",
		Note:       "hello",
		PlaceType:  "city",
		Country:    "China",
		City:       "Shanghai",
	}, now)

	if err != nil {
		t.Fatalf("NewPlace() error = %v", err)
	}
	if place.ID != "p1" {
		t.Errorf("place.ID = %q, want %q", place.ID, "p1")
	}
	if place.Name != "Test" {
		t.Errorf("place.Name = %q, want %q", place.Name, "Test")
	}
	if place.CreatedAt != now {
		t.Errorf("place.CreatedAt = %v, want %v", place.CreatedAt, now)
	}
	if len(place.Photos) != 0 {
		t.Errorf("new place should have 0 photos")
	}
	if len(place.Posts) != 0 {
		t.Errorf("new place should have 0 posts")
	}
}

func TestNewPlaceRequiresName(t *testing.T) {
	_, err := NewPlace("p1", "u1", PlaceDetails{Name: ""}, now)
	if err != ErrNameRequired {
		t.Fatalf("NewPlace() error = %v, want %v", err, ErrNameRequired)
	}
}

func TestNewPlaceTrimsName(t *testing.T) {
	place, err := NewPlace("p1", "u1", PlaceDetails{Name: "  Hello  "}, now)
	if err != nil {
		t.Fatalf("NewPlace() error = %v", err)
	}
	if place.Name != "Hello" {
		t.Errorf("place.Name = %q, want %q", place.Name, "Hello")
	}
}

func TestPlaceUpdate(t *testing.T) {
	place, _ := NewPlace("p1", "u1", PlaceDetails{Name: "Old"}, now)

	later := now.Add(time.Hour)
	err := place.Update(PlaceDetails{
		Name:       "New",
		Latitude:   35.0,
		Longitude:  135.0,
		TravelDate: "2026-07-01",
		Note:       "updated",
		PlaceType:  "nature",
		Country:    "Japan",
		City:       "Kyoto",
	}, later)

	if err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	if place.Name != "New" {
		t.Errorf("place.Name = %q, want %q", place.Name, "New")
	}
	if place.Latitude != 35.0 {
		t.Errorf("place.Latitude = %v, want %v", place.Latitude, 35.0)
	}
	if place.UpdatedAt != later {
		t.Errorf("place.UpdatedAt = %v, want %v", place.UpdatedAt, later)
	}
}

func TestPlaceUpdateRequiresName(t *testing.T) {
	place, _ := NewPlace("p1", "u1", PlaceDetails{Name: "Old"}, now)
	err := place.Update(PlaceDetails{Name: ""}, now)
	if err != ErrNameRequired {
		t.Fatalf("Update() error = %v, want %v", err, ErrNameRequired)
	}
}

func TestAddPhoto(t *testing.T) {
	place, _ := NewPlace("p1", "u1", PlaceDetails{Name: "Test"}, now)
	later := now.Add(time.Hour)

	place.AddPhoto(Photo{ID: "photo1", URL: "/p/img.jpg"}, later)

	if len(place.Photos) != 1 {
		t.Fatalf("len(place.Photos) = %d, want 1", len(place.Photos))
	}
	if place.Photos[0].ID != "photo1" {
		t.Errorf("photo.ID = %q, want %q", place.Photos[0].ID, "photo1")
	}
	if place.UpdatedAt != later {
		t.Errorf("place.UpdatedAt = %v, want %v", place.UpdatedAt, later)
	}
}

func TestRemovePhoto(t *testing.T) {
	place, _ := NewPlace("p1", "u1", PlaceDetails{Name: "Test"}, now)
	place.AddPhoto(Photo{ID: "p1", URL: "a.jpg"}, now)
	place.AddPhoto(Photo{ID: "p2", URL: "b.jpg"}, now)

	removed, err := place.RemovePhoto("p1", now.Add(time.Hour))
	if err != nil {
		t.Fatalf("RemovePhoto() error = %v", err)
	}
	if removed.ID != "p1" {
		t.Errorf("removed.ID = %q, want %q", removed.ID, "p1")
	}
	if len(place.Photos) != 1 {
		t.Errorf("len(place.Photos) = %d, want 1", len(place.Photos))
	}
	if place.Photos[0].ID != "p2" {
		t.Errorf("remaining photo.ID = %q, want %q", place.Photos[0].ID, "p2")
	}
}

func TestRemovePhotoNotFound(t *testing.T) {
	place, _ := NewPlace("p1", "u1", PlaceDetails{Name: "Test"}, now)
	_, err := place.RemovePhoto("nonexistent", now)
	if err != ErrNotFound {
		t.Fatalf("RemovePhoto() error = %v, want %v", err, ErrNotFound)
	}
}

func TestAddPost(t *testing.T) {
	place, _ := NewPlace("p1", "u1", PlaceDetails{Name: "Test"}, now)
	later := now.Add(time.Hour)

	place.AddPost(Post{ID: "post1", Title: "Hello", Content: "World"}, later)

	if len(place.Posts) != 1 {
		t.Fatalf("len(place.Posts) = %d, want 1", len(place.Posts))
	}
	if place.Posts[0].ID != "post1" {
		t.Errorf("post.ID = %q, want %q", place.Posts[0].ID, "post1")
	}
	if place.UpdatedAt != later {
		t.Errorf("place.UpdatedAt = %v, want %v", place.UpdatedAt, later)
	}
}

func TestRemovePost(t *testing.T) {
	place, _ := NewPlace("p1", "u1", PlaceDetails{Name: "Test"}, now)
	place.AddPost(Post{ID: "p1", Title: "A"}, now)
	place.AddPost(Post{ID: "p2", Title: "B"}, now)

	err := place.RemovePost("p1", now.Add(time.Hour))
	if err != nil {
		t.Fatalf("RemovePost() error = %v", err)
	}
	if len(place.Posts) != 1 {
		t.Errorf("len(place.Posts) = %d, want 1", len(place.Posts))
	}
	if place.Posts[0].ID != "p2" {
		t.Errorf("remaining post.ID = %q, want %q", place.Posts[0].ID, "p2")
	}
}

func TestRemovePostNotFound(t *testing.T) {
	place, _ := NewPlace("p1", "u1", PlaceDetails{Name: "Test"}, now)
	err := place.RemovePost("nonexistent", now)
	if err != ErrNotFound {
		t.Fatalf("RemovePost() error = %v, want %v", err, ErrNotFound)
	}
}
