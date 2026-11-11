#!/bin/sh
# Runs at container start (see Dockerfile). Writes the runtime configuration the browser
# loads before the application bundle:
#
#   window.__APP_CONFIG__ = { apiUrl: "<API_URL>" };
#
# To point the UI at another backend, change API_URL and restart the container.
set -eu

# Drop CR/LF: a stray line ending (for example from a Windows .env file) would otherwise
# break the JavaScript string and silently leave the UI on its default URL.
api_url=$(printf '%s' "${API_URL:-http://localhost:8080}" | tr -d '\r\n')

# Escape backslashes and double quotes so the value is always a valid JavaScript string.
escaped=$(printf '%s' "$api_url" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')

printf 'window.__APP_CONFIG__ = { apiUrl: "%s" };\n' "$escaped" > /usr/share/nginx/html/config.js

echo "40-write-config.sh: UI will call the backend at $api_url"
