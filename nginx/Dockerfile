# Build context must be the repo root (set in docker-compose.yml)
FROM node:20-alpine AS frontend-builder

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=frontend-builder /build/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
