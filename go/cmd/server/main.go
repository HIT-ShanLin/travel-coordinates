package main

import (
	"log"

	"travel-coordinates/go/internal/bootstrap"
)

func main() {
	if err := bootstrap.RunServer(); err != nil {
		log.Fatal(err)
	}
}
