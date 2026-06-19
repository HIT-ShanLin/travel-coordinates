package place

import (
	"database/sql"
	"fmt"
	"time"

	domain "travel-coordinates/go/internal/domain/place"

	_ "github.com/go-sql-driver/mysql"
)

type MySQLRepository struct {
	db *sql.DB
}

func NewMySQLRepository(dsn string) (*MySQLRepository, error) {
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("mysql open: %w", err)
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("mysql ping: %w", err)
	}
	return &MySQLRepository{db: db}, nil
}

func (r *MySQLRepository) List(userID string) ([]domain.Place, error) {
	rows, err := r.db.Query(
		"SELECT id, user_id, name, latitude, longitude, country, city, travel_date, note, place_type, created_at, updated_at FROM places WHERE user_id = ? ORDER BY created_at DESC",
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("list places: %w", err)
	}
	defer rows.Close()

	var places []domain.Place
	for rows.Next() {
		var p domain.Place
		if err := rows.Scan(&p.ID, &p.UserID, &p.Name, &p.Latitude, &p.Longitude,
			&p.Country, &p.City, &p.TravelDate, &p.Note, &p.PlaceType,
			&p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan place: %w", err)
		}
		places = append(places, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// load photos and posts for each place
	for i := range places {
		photos, err := r.photosForPlace(places[i].ID)
		if err != nil {
			return nil, err
		}
		places[i].Photos = photos

		posts, err := r.postsForPlace(places[i].ID)
		if err != nil {
			return nil, err
		}
		places[i].Posts = posts
	}

	return places, nil
}

func (r *MySQLRepository) FindByID(userID string, placeID string) (domain.Place, error) {
	var p domain.Place
	err := r.db.QueryRow(
		"SELECT id, user_id, name, latitude, longitude, country, city, travel_date, note, place_type, created_at, updated_at FROM places WHERE user_id = ? AND id = ?",
		userID, placeID,
	).Scan(&p.ID, &p.UserID, &p.Name, &p.Latitude, &p.Longitude,
		&p.Country, &p.City, &p.TravelDate, &p.Note, &p.PlaceType,
		&p.CreatedAt, &p.UpdatedAt)
	if err == sql.ErrNoRows {
		return domain.Place{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Place{}, fmt.Errorf("find place: %w", err)
	}

	photos, err := r.photosForPlace(p.ID)
	if err != nil {
		return domain.Place{}, err
	}
	p.Photos = photos

	posts, err := r.postsForPlace(p.ID)
	if err != nil {
		return domain.Place{}, err
	}
	p.Posts = posts

	return p, nil
}

func (r *MySQLRepository) Save(place domain.Place) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	// upsert place
	_, err = tx.Exec(`
		INSERT INTO places (id, user_id, name, latitude, longitude, country, city, travel_date, note, place_type, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			name=VALUES(name), latitude=VALUES(latitude), longitude=VALUES(longitude),
			country=VALUES(country), city=VALUES(city), travel_date=VALUES(travel_date),
			note=VALUES(note), place_type=VALUES(place_type), updated_at=VALUES(updated_at)
	`, place.ID, place.UserID, place.Name, place.Latitude, place.Longitude,
		place.Country, place.City, place.TravelDate, place.Note, place.PlaceType,
		place.CreatedAt, place.UpdatedAt)
	if err != nil {
		return fmt.Errorf("upsert place: %w", err)
	}

	// replace photos: delete old, insert current
	if _, err := tx.Exec("DELETE FROM photos WHERE place_id = ?", place.ID); err != nil {
		return fmt.Errorf("delete photos: %w", err)
	}
	for _, ph := range place.Photos {
		_, err := tx.Exec(
			"INSERT INTO photos (id, user_id, place_id, url, created_at) VALUES (?, ?, ?, ?, ?)",
			ph.ID, ph.UserID, place.ID, ph.URL, ph.CreatedAt,
		)
		if err != nil {
			return fmt.Errorf("insert photo: %w", err)
		}
	}

	// replace posts: delete old, insert current
	if _, err := tx.Exec("DELETE FROM posts WHERE place_id = ?", place.ID); err != nil {
		return fmt.Errorf("delete posts: %w", err)
	}
	for _, po := range place.Posts {
		photoID := nullableString(po.PhotoID)
		_, err := tx.Exec(
			"INSERT INTO posts (id, user_id, place_id, title, content, photo_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
			po.ID, po.UserID, place.ID, po.Title, po.Content, photoID, po.CreatedAt,
		)
		if err != nil {
			return fmt.Errorf("insert post: %w", err)
		}
	}

	return tx.Commit()
}

func (r *MySQLRepository) Delete(userID string, placeID string) error {
	_, err := r.db.Exec("DELETE FROM places WHERE user_id = ? AND id = ?", userID, placeID)
	if err != nil {
		return fmt.Errorf("delete place: %w", err)
	}
	return nil
}

// --- helpers ---

func (r *MySQLRepository) photosForPlace(placeID string) ([]domain.Photo, error) {
	rows, err := r.db.Query(
		"SELECT id, user_id, place_id, url, created_at FROM photos WHERE place_id = ? ORDER BY created_at ASC",
		placeID,
	)
	if err != nil {
		return nil, fmt.Errorf("query photos: %w", err)
	}
	defer rows.Close()

	var photos []domain.Photo
	for rows.Next() {
		var ph domain.Photo
		if err := rows.Scan(&ph.ID, &ph.UserID, &ph.PlaceID, &ph.URL, &ph.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan photo: %w", err)
		}
		photos = append(photos, ph)
	}
	if photos == nil {
		photos = []domain.Photo{}
	}
	return photos, rows.Err()
}

func (r *MySQLRepository) postsForPlace(placeID string) ([]domain.Post, error) {
	rows, err := r.db.Query(
		"SELECT id, user_id, place_id, title, content, COALESCE(photo_id,''), created_at FROM posts WHERE place_id = ? ORDER BY created_at DESC",
		placeID,
	)
	if err != nil {
		return nil, fmt.Errorf("query posts: %w", err)
	}
	defer rows.Close()

	var posts []domain.Post
	for rows.Next() {
		var po domain.Post
		if err := rows.Scan(&po.ID, &po.UserID, &po.PlaceID, &po.Title, &po.Content, &po.PhotoID, &po.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan post: %w", err)
		}
		posts = append(posts, po)
	}
	if posts == nil {
		posts = []domain.Post{}
	}
	return posts, rows.Err()
}

func nullableString(s string) any {
	if s == "" {
		return nil
	}
	return s
}
