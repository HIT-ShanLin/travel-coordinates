package store

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func TestCreatePlacePersistsAndLoads(t *testing.T) {
	dir := t.TempDir()
	s, err := New(dir)
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	created, err := s.CreatePlace("0001", PlaceInput{
		Name:       "Kyoto",
		Latitude:   35.0116,
		Longitude:  135.7681,
		TravelDate: "2026-06-17",
		Note:       "Night walk near the river",
		PlaceType:  "city",
		Country:    "Japan",
		City:       "Kyoto",
	})
	if err != nil {
		t.Fatalf("CreatePlace() error = %v", err)
	}

	reopened, err := New(dir)
	if err != nil {
		t.Fatalf("New() reopened error = %v", err)
	}

	places, err := reopened.ListPlaces("0001")
	if err != nil {
		t.Fatalf("ListPlaces() error = %v", err)
	}
	if len(places) != 1 {
		t.Fatalf("ListPlaces() len = %d, want 1", len(places))
	}
	if places[0].ID != created.ID {
		t.Fatalf("ListPlaces() id = %s, want %s", places[0].ID, created.ID)
	}
	if places[0].Name != "Kyoto" {
		t.Fatalf("ListPlaces() name = %s, want Kyoto", places[0].Name)
	}
}

func TestAddPhotoAndPostRoundTrip(t *testing.T) {
	dir := t.TempDir()
	s, err := New(dir)
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	place, err := s.CreatePlace("0001", PlaceInput{Name: "Seoul"})
	if err != nil {
		t.Fatalf("CreatePlace() error = %v", err)
	}

	withPhoto, err := s.AddPhoto("0001", place.ID, PhotoInput{
		Filename:    "street.jpg",
		ContentType: "image/jpeg",
		File:        bytes.NewBufferString("photo-bytes"),
	})
	if err != nil {
		t.Fatalf("AddPhoto() error = %v", err)
	}
	if len(withPhoto.Photos) != 1 {
		t.Fatalf("AddPhoto() photos len = %d, want 1", len(withPhoto.Photos))
	}
	if _, err := os.Stat(withPhoto.Photos[0].Path); err != nil {
		t.Fatalf("AddPhoto() file missing: %v", err)
	}

	withPost, err := s.AddPost("0001", place.ID, PostInput{
		Title:   "Best noodles",
		Content: "The broth was worth the detour.",
	})
	if err != nil {
		t.Fatalf("AddPost() error = %v", err)
	}
	if len(withPost.Posts) != 1 {
		t.Fatalf("AddPost() posts len = %d, want 1", len(withPost.Posts))
	}

	reopened, err := New(dir)
	if err != nil {
		t.Fatalf("New() reopened error = %v", err)
	}
	got, err := reopened.GetPlace("0001", place.ID)
	if err != nil {
		t.Fatalf("GetPlace() error = %v", err)
	}
	if len(got.Photos) != 1 || len(got.Posts) != 1 {
		t.Fatalf("GetPlace() counts = %d photos, %d posts; want 1 and 1", len(got.Photos), len(got.Posts))
	}

	if err := reopened.DeletePhoto("0001", place.ID, got.Photos[0].ID); err != nil {
		t.Fatalf("DeletePhoto() error = %v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, "uploads", "0001", place.ID)); err != nil && !os.IsNotExist(err) {
		t.Fatalf("DeletePhoto() unexpected stat error: %v", err)
	}
}
