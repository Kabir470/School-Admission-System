// Development default: no runtime override, so the app falls back to VITE_API_URL and
// then to http://localhost:8080. In the Docker image this file is overwritten at
// container start with the value of the API_URL environment variable
// (see docker/40-write-config.sh).
window.__APP_CONFIG__ = window.__APP_CONFIG__ || {};
