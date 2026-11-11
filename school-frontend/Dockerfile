# syntax=docker/dockerfile:1

# ---- deps: install once, shared by the build and test stages -------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- test: `docker compose --profile test run --rm frontend-tests` --------------------
FROM deps AS test
COPY . .
CMD ["npm", "test"]

# ---- build: type-check and bundle ----------------------------------------------------
FROM deps AS build
COPY . .
RUN npm run build

# ---- final: static files behind nginx ------------------------------------------------
FROM nginx:1.27-alpine AS final
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# The official nginx image runs every script in /docker-entrypoint.d before it starts
# nginx. This one writes /config.js from the API_URL environment variable, so the backend
# URL is decided when the container starts, not when the image was built.
COPY --chmod=755 docker/40-write-config.sh /docker-entrypoint.d/40-write-config.sh
ENV API_URL=http://localhost:8080
EXPOSE 80
