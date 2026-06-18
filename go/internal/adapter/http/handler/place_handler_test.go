package handler_test

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	nethttp "net/http"
	"net/http/httptest"
	"testing"

	httpadapter "travel-coordinates/go/internal/adapter/http"
	"travel-coordinates/go/internal/adapter/storage/local"
	repo "travel-coordinates/go/internal/repo/place"
	service "travel-coordinates/go/internal/service/place"
)

func newTestServer(t *testing.T) *httpadapter.Server {
	t.Helper()
	root := t.TempDir()
	repository, err := repo.NewFileRepository(root)
	if err != nil {
		t.Fatalf("NewFileRepository() error = %v", err)
	}
	mediaStorage, err := local.New(root)
	if err != nil {
		t.Fatalf("local.New() error = %v", err)
	}
	return httpadapter.New(service.New(repository, mediaStorage), root, "")
}

func TestPlaceCreateListAndDelete(t *testing.T) {
	server := newTestServer(t)

	body := bytes.NewBufferString(`{"name":"Taipei","latitude":25.033,"longitude":121.5654,"travel_date":"2026-06-17","note":"night market","place_type":"city","country":"Taiwan","city":"Taipei"}`)
	req := httptest.NewRequest(nethttp.MethodPost, "/api/places", body)
	rec := httptest.NewRecorder()
	server.Mux().ServeHTTP(rec, req)
	if rec.Code != nethttp.StatusCreated {
		t.Fatalf("POST /api/places status = %d, want %d", rec.Code, nethttp.StatusCreated)
	}

	var created struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatalf("unmarshal created place: %v", err)
	}

	listReq := httptest.NewRequest(nethttp.MethodGet, "/api/places", nil)
	listRec := httptest.NewRecorder()
	server.Mux().ServeHTTP(listRec, listReq)
	if listRec.Code != nethttp.StatusOK {
		t.Fatalf("GET /api/places status = %d, want %d", listRec.Code, nethttp.StatusOK)
	}
	if !bytes.Contains(listRec.Body.Bytes(), []byte(created.ID)) {
		t.Fatalf("GET /api/places body does not contain created id")
	}

	delReq := httptest.NewRequest(nethttp.MethodDelete, "/api/places/"+created.ID, nil)
	delReq.SetPathValue("id", created.ID)
	delRec := httptest.NewRecorder()
	server.Mux().ServeHTTP(delRec, delReq)
	if delRec.Code != nethttp.StatusNoContent {
		t.Fatalf("DELETE /api/places/{id} status = %d, want %d", delRec.Code, nethttp.StatusNoContent)
	}
}

func TestPhotoAndPostHandlers(t *testing.T) {
	server := newTestServer(t)

	createReq := httptest.NewRequest(nethttp.MethodPost, "/api/places", bytes.NewBufferString(`{"name":"Busan","latitude":35.1796,"longitude":129.0756}`))
	createRec := httptest.NewRecorder()
	server.Mux().ServeHTTP(createRec, createReq)
	if createRec.Code != nethttp.StatusCreated {
		t.Fatalf("POST /api/places status = %d, want %d", createRec.Code, nethttp.StatusCreated)
	}
	var created struct {
		ID string `json:"id"`
	}
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
	photoReq := httptest.NewRequest(nethttp.MethodPost, "/api/places/"+created.ID+"/photos", &photoBody)
	photoReq.Header.Set("Content-Type", writer.FormDataContentType())
	photoReq.SetPathValue("id", created.ID)
	photoRec := httptest.NewRecorder()
	server.Mux().ServeHTTP(photoRec, photoReq)
	if photoRec.Code != nethttp.StatusCreated {
		t.Fatalf("POST /api/places/{id}/photos status = %d, want %d", photoRec.Code, nethttp.StatusCreated)
	}

	postReq := httptest.NewRequest(nethttp.MethodPost, "/api/places/"+created.ID+"/posts", bytes.NewBufferString(`{"title":"Lunch","content":"Seafood stew was excellent."}`))
	postReq.SetPathValue("id", created.ID)
	postRec := httptest.NewRecorder()
	server.Mux().ServeHTTP(postRec, postReq)
	if postRec.Code != nethttp.StatusCreated {
		t.Fatalf("POST /api/places/{id}/posts status = %d, want %d", postRec.Code, nethttp.StatusCreated)
	}
}
