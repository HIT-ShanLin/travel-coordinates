package place

import "testing"

func TestValidatePost(t *testing.T) {
	tests := []struct {
		name    string
		title   string
		content string
		wantErr error
	}{
		{"both filled", "Hello", "World", nil},
		{"only title", "Hello", "", nil},
		{"only content", "", "World", nil},
		{"both empty", "", "", ErrPostBodyRequired},
		{"whitespace only", "   ", "   ", ErrPostBodyRequired},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePost(tt.title, tt.content)
			if err != tt.wantErr {
				t.Errorf("ValidatePost() error = %v, want %v", err, tt.wantErr)
			}
		})
	}
}
