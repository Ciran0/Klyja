# Klyja

Klyja (contraction of Klymene and Japetus, the parents of the titan Atlas) is a worldbuilding tool inspired by gplates that aims to help mapmakers create techtonic plates histories.
The goal is to give the users the hability to easily draw and animate tectonic plates on a sphere.

## Project Structure

- `backend/`: Rust backend using Axum and Diesel
- `frontend/`: HTML/CSS/JavaScript frontend
- `geco/`: WebAssembly module for animation logic
- `protobuf/`: Protocol buffer definitions
- `migrations/`: Database migration files

## Development Setup

1. Clone the repository
2. Install Rust and wasm-pack
3. Run `docker-compose up -d` to start the PostgreSQL database
4. Run `cargo build` to build the project

## Running the Application

```bash
cd backend
cargo run
```

This will start the server at http://localhost:8080.

## Testing

This project includes comprehensive testing for both backend and WebAssembly components:

```bash
# Run all tests in the workspace
cargo test --workspace

# Run backend tests only
cd backend
cargo test

# Run WebAssembly tests only
cd geco
cargo test
```

Current test coverage:
- Unit tests for error handling and models
- Protocol buffer serialization/deserialization
- WebAssembly component tests

For detailed information about testing, including test structure and future test areas, see [TESTING.md](TESTING.md).

## Database Setup

The application uses PostgreSQL with Diesel ORM. The database migrations are automatically run when the backend starts.

## License

[MIT or Apache-2.0]
