# Stage 1: Build Geco (WASM)
FROM rust:1.78 AS geco-builder
WORKDIR /app
RUN apt-get update && \
    apt-get install -y curl protobuf-compiler && \
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh -s -- -y && \
    rm -rf /var/lib/apt/lists/*

COPY ./geco ./geco
COPY ./protobuf ./protobuf
RUN cd geco && wasm-pack build --target web --out-dir ../target/geco_pkg --release

# Stage 2: Build Frontend (Node.js)
FROM node:20-slim AS frontend-builder
WORKDIR /app
COPY ./frontend ./frontend
# Copy WASM output from geco-builder to a location accessible by the frontend build if needed
# However, your vite.config.js externals geco.js, so we just need to ensure it's served by the backend.
# We'll copy the final geco_pkg to the runtime stage later.
RUN cd frontend && npm install && npm run build
# frontend/dist will contain the built assets

# Stage 3: Build Backend (Rust)
FROM rust:1.78 AS backend-builder
WORKDIR /app

RUN apt-get update && \
    apt-get install -y protobuf-compiler && \
    rm -rf /var/lib/apt/lists/*

COPY . .

# More detailed debugging for the backend build
RUN cd backend && \
    echo "--- Current directory before build: $(pwd)" && \
    echo "--- Listing contents of current directory (should be /app/backend):" && \
    ls -Al && \
    echo "--- Checking for CARGO_TARGET_DIR env var: [${CARGO_TARGET_DIR}]" && \
    echo "--- Building backend (cargo build --release)..." && \
    cargo build --release && \
    BUILD_EXIT_CODE=$? && \
    echo "--- Cargo build finished. Exit status: ${BUILD_EXIT_CODE}" && \
    if [ ${BUILD_EXIT_CODE} -ne 0 ]; then echo "!!! CARGO BUILD FAILED WITH NON-ZERO EXIT CODE !!!"; fi && \
    echo "--- Listing /app/backend/target/release/ after build:" && \
    ls -Al /app/backend/target/release/ || echo "!!! /app/backend/target/release/ not found or ls failed" && \
    echo "--- Listing /app/backend/target/ after build:" && \
    ls -Al /app/backend/target/ || echo "!!! /app/backend/target/ not found or ls failed" && \
    echo "--- Listing /app/target/ (in case CARGO_TARGET_DIR was /app/target):" && \
    ls -Al /app/target/ || echo "!!! /app/target/ not found or ls failed" && \
    echo "--- Final current directory: $(pwd)" && \
    if [ ${BUILD_EXIT_CODE} -ne 0 ]; then exit ${BUILD_EXIT_CODE}; fi # Ensure Docker step fails if cargo build failed

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
COPY --from=backend-builder /app/target/release/backend /app/backend/klyja_backend

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
