# Stage 1: Build Geco (WASM)
FROM rust:1.78 as geco-builder
WORKDIR /app
RUN apt-get update && apt-get install -y curl && \
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh -s -- -y
COPY ./geco ./geco
COPY ./protobuf ./protobuf
RUN cd geco && wasm-pack build --target web --out-dir ../target/geco_pkg --release

# Stage 2: Build Frontend (Node.js)
FROM node:20-slim as frontend-builder
WORKDIR /app
COPY ./frontend ./frontend
# Copy WASM output from geco-builder to a location accessible by the frontend build if needed
# However, your vite.config.js externals geco.js, so we just need to ensure it's served by the backend.
# We'll copy the final geco_pkg to the runtime stage later.
RUN cd frontend && npm install && npm run build
# frontend/dist will contain the built assets

# Stage 3: Build Backend (Rust)
FROM rust:1.78 as backend-builder
WORKDIR /app
COPY . .
# Ensure target directory exists for dependencies caching if used in CI later
RUN mkdir -p target
# Build backend
RUN cd backend && cargo build --release

# Stage 4: Final Runtime Image
FROM debian:bullseye-slim
WORKDIR /app

# Install any runtime dependencies (e.g., ca-certificates for HTTPS, libpq for diesel if not static)
RUN apt-get update && apt-get install -y ca-certificates libpq5 && rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV APP_ENV=production
ENV PORT=8080
# DATABASE_URL will be set at runtime by the deployment environment

# Create directories expected by the backend structure
# (project_root/backend, project_root/frontend/dist, project_root/geco/pkg)
# We will place the binary directly in /app/backend for simplicity
RUN mkdir -p /app/backend /app/frontend/dist /app/geco/pkg

# Copy built backend binary from backend-builder
COPY --from=backend-builder /app/backend/target/release/klyja_backend /app/backend/klyja_backend

# Copy built frontend assets from frontend-builder
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Copy built WASM assets from geco-builder
COPY --from=geco-builder /app/target/geco_pkg /app/geco/pkg

# Copy migrations (Diesel runs them embedded, but good to have if any other tool needed them)
# COPY ./migrations /app/migrations

# Expose the port the app runs on
EXPOSE 8080

# Set the working directory for the backend.
# CARGO_MANIFEST_DIR at compile time for backend was /app/backend.
# So, project_root becomes /app.
# The backend will look for:
# - /app/frontend/dist (correctly copied)
# - /app/geco/pkg (correctly copied)
WORKDIR /app/backend

# Command to run the backend application
CMD ["./klyja_backend"]
