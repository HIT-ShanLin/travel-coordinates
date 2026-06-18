package place

import "strings"

func ValidatePost(title string, content string) error {
	if strings.TrimSpace(title) == "" && strings.TrimSpace(content) == "" {
		return ErrPostBodyRequired
	}
	return nil
}
