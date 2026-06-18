package storage

import (
	"fmt"
	"math/rand"
	"time"
)

func NewID(prefix string) string {
	return fmt.Sprintf("%s_%d_%04d", prefix, time.Now().UnixNano(), rand.Intn(10000))
}
