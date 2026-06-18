package place

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"sync"

	domain "travel-coordinates/go/internal/domain/place"
)

type FileRepository struct {
	root string
	mu   sync.Mutex
}

type persistedState struct {
	Places map[string][]domain.Place `json:"places"`
}

func NewFileRepository(root string) (*FileRepository, error) {
	if err := os.MkdirAll(filepath.Join(root, "places"), 0o755); err != nil {
		return nil, err
	}
	return &FileRepository{root: root}, nil
}

func (r *FileRepository) Root() string {
	return r.root
}

func (r *FileRepository) List(userID string) ([]domain.Place, error) {
	state, err := r.readState()
	if err != nil {
		return nil, err
	}
	places := append([]domain.Place(nil), state.Places[userID]...)
	sort.Slice(places, func(i, j int) bool {
		return places[i].CreatedAt.After(places[j].CreatedAt)
	})
	return places, nil
}

func (r *FileRepository) FindByID(userID string, placeID string) (domain.Place, error) {
	state, err := r.readState()
	if err != nil {
		return domain.Place{}, err
	}
	for _, place := range state.Places[userID] {
		if place.ID == placeID {
			return place, nil
		}
	}
	return domain.Place{}, domain.ErrNotFound
}

func (r *FileRepository) Save(place domain.Place) error {
	state, err := r.readState()
	if err != nil {
		return err
	}
	places := state.Places[place.UserID]
	for index, existing := range places {
		if existing.ID == place.ID {
			places[index] = place
			state.Places[place.UserID] = places
			return r.writeState(state)
		}
	}
	state.Places[place.UserID] = append(places, place)
	return r.writeState(state)
}

func (r *FileRepository) Delete(userID string, placeID string) error {
	state, err := r.readState()
	if err != nil {
		return err
	}
	places := state.Places[userID]
	for index, place := range places {
		if place.ID != placeID {
			continue
		}
		state.Places[userID] = append(places[:index], places[index+1:]...)
		return r.writeState(state)
	}
	return domain.ErrNotFound
}

func (r *FileRepository) statePath() string {
	return filepath.Join(r.root, "state.json")
}

func (r *FileRepository) readState() (persistedState, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	state := persistedState{Places: map[string][]domain.Place{}}
	data, err := os.ReadFile(r.statePath())
	if errors.Is(err, os.ErrNotExist) {
		return state, nil
	}
	if err != nil {
		return state, err
	}
	if len(data) == 0 {
		return state, nil
	}
	if err := json.Unmarshal(data, &state); err != nil {
		return state, err
	}
	if state.Places == nil {
		state.Places = map[string][]domain.Place{}
	}
	return state, nil
}

func (r *FileRepository) writeState(state persistedState) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if state.Places == nil {
		state.Places = map[string][]domain.Place{}
	}
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	tmp := r.statePath() + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, r.statePath())
}
