#!/bin/sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

case "${1:-start}" in
  start)
    echo "Starting cloudflared tunnel (travel-coordinates)..."
    echo "  → https://travel.sltechblog.site"
    cloudflared tunnel --config "$SCRIPT_DIR/config.yml" run
    ;;
  stop)
    echo "Stopping cloudflared..."
    pkill -f "cloudflared tunnel.*663cdd3c" || echo "  already stopped"
    ;;
  status)
    if pgrep -f "cloudflared tunnel.*663cdd3c" > /dev/null; then
      echo "cloudflared is running"
      echo "  → https://travel.sltechblog.site"
    else
      echo "cloudflared is not running"
    fi
    ;;
  *)
    echo "Usage: $0 {start|stop|status}"
    exit 1
    ;;
esac
