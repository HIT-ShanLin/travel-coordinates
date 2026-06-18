package place

import "errors"

var (
	ErrNotFound         = errors.New("not found")
	ErrNameRequired     = errors.New("name is required")
	ErrPostBodyRequired = errors.New("title or content is required")
)
