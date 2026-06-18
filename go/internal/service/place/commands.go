package place

import "io"

// CreatePlaceCmd is the input for creating a new place.
type CreatePlaceCmd struct {
	UserID string
	Input  PlaceInput
}

// UpdatePlaceCmd is the input for updating an existing place.
type UpdatePlaceCmd struct {
	UserID  string
	PlaceID string
	Input   PlaceInput
}

// DeletePlaceCmd is the input for deleting a place.
type DeletePlaceCmd struct {
	UserID  string
	PlaceID string
}

// AddPhotoCmd is the input for uploading a photo.
type AddPhotoCmd struct {
	UserID  string
	PlaceID string
	Input   PhotoInput
}

// DeletePhotoCmd is the input for deleting a photo.
type DeletePhotoCmd struct {
	UserID  string
	PlaceID string
	PhotoID string
}

// AddPostCmd is the input for creating a post.
type AddPostCmd struct {
	UserID  string
	PlaceID string
	Input   PostInput
}

// AddPostAttachmentCmd is the input for creating a post with an image attachment.
type AddPostAttachmentCmd struct {
	UserID      string
	PlaceID     string
	Title       string
	Content     string
	Filename    string
	ContentType string
	File        io.Reader
}

// DeletePostCmd is the input for deleting a post.
type DeletePostCmd struct {
	UserID  string
	PlaceID string
	PostID  string
}
