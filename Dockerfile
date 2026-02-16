# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend
FROM golang:1.24-alpine AS backend-build
WORKDIR /app/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=1 go build -o /md-office .

# Stage 3: Final image
FROM alpine:3.20
RUN apk add --no-cache libc6-compat sqlite-libs ca-certificates
WORKDIR /app

COPY --from=backend-build /md-office /app/md-office
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

# Create data directory
RUN mkdir -p /data/workspace /root/.md-office

ENV PORT=8080
ENV WORKSPACE_PATH=/data/workspace
ENV DB_PATH=/data/md-office.db

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

ENTRYPOINT ["/app/md-office"]
