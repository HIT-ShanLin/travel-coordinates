package geo

import (
	"context"
	"crypto/md5"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// GeoService provides location search (suggest) and reverse geocoding backed by Amap API and MySQL cache.
type GeoService struct {
	db      *sql.DB
	amapKey string
	client  *http.Client
}

// SuggestItem is a single location suggestion returned by the Amap text search API.
type SuggestItem struct {
	Name    string  `json:"name"`
	Country string  `json:"country"`
	City    string  `json:"city"`
	Lat     float64 `json:"lat"`
	Lng     float64 `json:"lng"`
}

// ReverseResult is the result of a reverse geocoding lookup.
type ReverseResult struct {
	Country string  `json:"country"`
	City    string  `json:"city"`
	Name    string  `json:"name"`
	Lat     float64 `json:"lat"`
	Lng     float64 `json:"lng"`
}

// New creates a GeoService with the given DB connection and Amap API key.
func New(db *sql.DB, amapKey string) *GeoService {
	return &GeoService{
		db:      db,
		amapKey: amapKey,
		client:  &http.Client{Timeout: 5 * time.Second},
	}
}

// Suggest returns location suggestions for a keyword, using DB cache first.
func (s *GeoService) Suggest(ctx context.Context, keyword string) ([]SuggestItem, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if keyword == "" {
		return []SuggestItem{}, nil
	}

	// Check DB cache
	var cached string
	err := s.db.QueryRowContext(ctx,
		"SELECT response_json FROM geo_suggest_cache WHERE keyword = ?", keyword,
	).Scan(&cached)
	if err == nil {
		var items []SuggestItem
		if json.Unmarshal([]byte(cached), &items) == nil {
			return items, nil
		}
	}

	// Call Amap API
	items, err := s.callAmapSuggest(ctx, keyword)
	if err != nil {
		return nil, err
	}

	// Write cache
	data, _ := json.Marshal(items)
	_, _ = s.db.ExecContext(ctx,
		"INSERT INTO geo_suggest_cache (keyword, response_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE response_json = VALUES(response_json)",
		keyword, string(data),
	)

	return items, nil
}

// Reverse performs a reverse geocoding lookup (lat,lng -> address), using DB cache first.
func (s *GeoService) Reverse(ctx context.Context, lat, lng float64) (ReverseResult, error) {
	if err := ctx.Err(); err != nil {
		return ReverseResult{}, err
	}
	hash := fmt.Sprintf("%x", md5.Sum([]byte(fmt.Sprintf("%.6f,%.6f", lat, lng))))

	// Check DB cache
	var cached string
	var rr ReverseResult
	err := s.db.QueryRowContext(ctx,
		"SELECT response_json FROM geo_reverse_cache WHERE coord_hash = ?", hash,
	).Scan(&cached)
	if err == nil {
		if json.Unmarshal([]byte(cached), &rr) == nil {
			return rr, nil
		}
	}

	// Call Amap API
	rr, err = s.callAmapReverse(ctx, lat, lng)
	if err != nil {
		return ReverseResult{}, err
	}

	// Write cache
	data, _ := json.Marshal(rr)
	_, _ = s.db.ExecContext(ctx,
		"INSERT INTO geo_reverse_cache (coord_hash, lat, lng, country, city, name, response_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
		hash, lat, lng, rr.Country, rr.City, rr.Name, string(data),
	)

	return rr, nil
}

// --- Amap API calls ---------------------------------------------------------

func (s *GeoService) callAmapSuggest(ctx context.Context, keyword string) ([]SuggestItem, error) {
	u := fmt.Sprintf("https://restapi.amap.com/v5/place/text?key=%s&keywords=%s&types=&children=1&page=1&offset=10",
		s.amapKey, url.QueryEscape(keyword))

	req, err := http.NewRequestWithContext(ctx, "GET", u, nil)
	if err != nil {
		return nil, fmt.Errorf("amap suggest request: %w", err)
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("amap suggest call: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("amap suggest read: %w", err)
	}

	var result map[string]any
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("amap suggest json: %w", err)
	}

	status, _ := result["status"].(string)
	if status != "1" {
		info, _ := result["info"].(string)
		return nil, fmt.Errorf("amap suggest error: %s", info)
	}

	pois, _ := result["pois"].([]any)
	var items []SuggestItem
	for _, p := range pois {
		poi, ok := p.(map[string]any)
		if !ok {
			continue
		}
		loc, _ := poi["location"].(string)
		lat, lng := 0.0, 0.0
		if len(loc) > 0 {
			fmt.Sscanf(loc, "%f,%f", &lng, &lat)
		}
		pname, _ := poi["pname"].(string)
		cname, _ := poi["cityname"].(string)
		if cname == "" {
			cname = pname
		}
		name, _ := poi["name"].(string)
		items = append(items, SuggestItem{
			Name: name, Country: pname, City: cname,
			Lat: lat, Lng: lng,
		})
	}
	if items == nil {
		items = []SuggestItem{}
	}
	return items, nil
}

func (s *GeoService) callAmapReverse(ctx context.Context, lat, lng float64) (ReverseResult, error) {
	u := fmt.Sprintf("https://restapi.amap.com/v3/geocode/regeo?key=%s&location=%.6f,%.6f&extensions=base",
		s.amapKey, lng, lat)

	req, err := http.NewRequestWithContext(ctx, "GET", u, nil)
	if err != nil {
		return ReverseResult{}, fmt.Errorf("amap reverse request: %w", err)
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return ReverseResult{}, fmt.Errorf("amap reverse call: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return ReverseResult{}, fmt.Errorf("amap reverse read: %w", err)
	}

	var result map[string]any
	if err := json.Unmarshal(body, &result); err != nil {
		return ReverseResult{}, fmt.Errorf("amap reverse json: %w", err)
	}

	status, _ := result["status"].(string)
	if status != "1" {
		info, _ := result["info"].(string)
		return ReverseResult{}, fmt.Errorf("amap reverse error: %s", info)
	}

	regeo, _ := result["regeocode"].(map[string]any)
	if regeo == nil {
		return ReverseResult{}, fmt.Errorf("amap reverse: no regeocode in response")
	}
	addr, _ := regeo["addressComponent"].(map[string]any)
	province, _ := addr["province"].(string)
	city, _ := addr["city"].(string)
	if city == "" {
		city = province
	}
	district, _ := addr["district"].(string)
	name := district
	if name == "" {
		name = city
	}

	return ReverseResult{
		Country: province,
		City:    city,
		Name:    name,
		Lat:     lat,
		Lng:     lng,
	}, nil
}
