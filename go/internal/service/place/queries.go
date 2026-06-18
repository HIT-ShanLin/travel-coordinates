package place

// ListPlacesQuery is the input for listing all places for a user.
type ListPlacesQuery struct {
	UserID string
}

// GetPlaceQuery is the input for fetching a single place.
type GetPlaceQuery struct {
	UserID  string
	PlaceID string
}

// DownloadMediaQuery is the input for downloading media.
type DownloadMediaQuery struct {
	UserID   string
	PlaceID  string
	Filename string
}
