package http

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"travel-coordinates/api/internal/store"
)

func TestPlaceCreateListAndDelete(t *testing.T) {
	srv := New(newTestStore(t))

	body := bytes.NewBufferString(`{"name":"Taipei","latitude":25.033,"longitude":121.5654,"travel_date":"2026-06-17","note":"night market","place_type":"city","country":"Taiwan","city":"Taipei"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/places", body)
	rec := httptest.NewRecorder()
	srv.Mux().ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST /api/places status = %d, want %d", rec.Code, http.StatusCreated)
	}

	var created store.Place
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatalf("unmarshal created place: %v", err)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/places", nil)
	listRec := httptest.NewRecorder()
	srv.Mux().ServeHTTP(listRec, listReq)
	if listRec.Code != http.StatusOK {
		t.Fatalf("GET /api/places status = %d, want %d", listRec.Code, http.StatusOK)
	}
	if !bytes.Contains(listRec.Body.Bytes(), []byte(created.ID)) {
		t.Fatalf("GET /api/places body does not contain created id")
	}

	delReq := httptest.NewRequest(http.MethodDelete, "/api/places/"+created.ID, nil)
	delReq.SetPathValue("id", created.ID)
	delRec := httptest.NewRecorder()
	srv.Mux().ServeHTTP(delRec, delReq)
	if delRec.Code != http.StatusNoContent {
		t.Fatalf("DELETE /api/places/{id} status = %d, want %d", delRec.Code, http.StatusNoContent)
	}
}

func TestPhotoAndPostHandlers(t *testing.T) {
	srv := New(newTestStore(t))

	createReq := httptest.NewRequest(http.MethodPost, "/api/places", bytes.NewBufferString(`{"name":"Busan","latitude":35.1796,"longitude":129.0756}`))
	createRec := httptest.NewRecorder()
	srv.Mux().ServeHTTP(createRec, createReq)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("POST /api/places status = %d, want %d", createRec.Code, http.StatusCreated)
	}

	var created store.Place
	if err := json.Unmarshal(createRec.Body.Bytes(), &created); err != nil {
		t.Fatalf("unmarshal created place: %v", err)
	}

	var photoBody bytes.Buffer
	writer := multipart.NewWriter(&photoBody)
	part, err := writer.CreateFormFile("file", "sea.jpg")
	if err != nil {
		t.Fatalf("CreateFormFile: %v", err)
	}
	_, _ = io.Copy(part, bytes.NewBufferString("binary-photo"))
	if err := writer.Close(); err != nil {
		t.Fatalf("writer.Close: %v", err)
	}

	photoReq := httptest.NewRequest(http.MethodPost, "/api/places/"+created.ID+"/photos", &photoBody)
	photoReq.Header.Set("Content-Type", writer.FormDataContentType())
	photoReq.SetPathValue("id", created.ID)
	photoRec := httptest.NewRecorder()
	srv.Mux().ServeHTTP(photoRec, photoReq)
	if photoRec.Code != http.StatusCreated {
		t.Fatalf("POST /api/places/{id}/photos status = %d, want %d", photoRec.Code, http.StatusCreated)
	}

	postReq := httptest.NewRequest(http.MethodPost, "/api/places/"+created.ID+"/posts", bytes.NewBufferString(`{"title":"Lunch","content":"Seafood stew was excellent."}`))
	postReq.SetPathValue("id", created.ID)
	postRec := httptest.NewRecorder()
	srv.Mux().ServeHTTP(postRec, postReq)
	if postRec.Code != http.StatusCreated {
		t.Fatalf("POST /api/places/{id}/posts status = %d, want %d", postRec.Code, http.StatusCreated)
	}
}

func newTestStore(t *testing.T) *store.Store {
	t.Helper()
	s, err := store.New(t.TempDir())
	if err != nil {
		t.Fatalf("store.New() error = %v", err)
	}
	return s
}
