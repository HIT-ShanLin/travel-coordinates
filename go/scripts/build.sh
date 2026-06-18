#!/usr/bin/env sh
set -eu

echo "=== test ==="
go test ./... -count=1

echo "=== build ==="
CGO_ENABLED=0 go build -trimpath -o server ./cmd/server

echo "=== done ==="
echo "binary: ./server"
