# Testing in Klyja

This document explains how to run tests for the Klyja project.

## Running Tests

To run all tests in the workspace:

```bash
# From the project root
cargo test --workspace
```

To run tests for a specific crate:

```bash
# For backend tests
cd backend
cargo test

# For geco tests
cd geco
cargo test
```

To run tests with output:

```bash
cargo test -- --nocapture
```

## Test Structure

### Backend Tests

The backend tests are organized as follows:

- **Unit Tests**: Located in `src/lib.rs` inside the `tests` module
- **Integration Tests**: Located in `tests/basic_test.rs`

Current test coverage:
- Error handling tests for `AppError`
- Data model serialization tests
- Protocol buffer mapping tests

### WebAssembly (Geco) Tests

The WebAssembly tests are organized as follows:

- **Unit Tests**: Located in `src/lib_test.rs`
- **Basic Tests**: Located in `tests/basic_test.rs`
- **WASM Tests**: Located in `tests/wasm_tests.rs` - these tests require wasm-pack

Current test coverage:
- Tests for SimplePoint, SimpleAnimatedPoint, and SimplePolygon conversion
- Protocol buffer serialization/deserialization
- MapAnimation structure tests

## Future Test Areas

### Integration Tests

Integration tests for the backend are currently limited. Future extensions could include:

- Database interaction tests with a test database
- HTTP API tests using axum-test for the handlers
- End-to-end flow tests

### Performance Tests

Performance tests are not currently implemented. Future tests could include:

- Protocol buffer encoding/decoding performance
- Database query performance
- API endpoint performance

### Frontend Tests

Frontend tests have not been implemented yet. Future tests could include:

- JavaScript unit tests
- DOM manipulation tests
- WebAssembly integration tests

## Test Dependencies

### Backend Test Dependencies

```toml
[dev-dependencies]
tokio-test = "0.4"          # Utilities for testing async code
axum-test = "14.0"          # Testing utilities for Axum
mockall = "0.12"            # For creating mock objects
diesel-async = { version = "0.4", features = ["postgres"] } # For testing with async DB operations
assert_matches = "1.5"      # More ergonomic assertions
uuid = { version = "1.6", features = ["v4"] } # For generating test IDs
rand = "0.8"                # For generating random test data
rstest = "0.18"             # Parameterized tests
```

### Geco Test Dependencies

```toml
[dev-dependencies]
wasm-bindgen-test = "0.3"  # For testing WASM code
js-sys = "0.3"             # JavaScript interop utilities for testing
assert_matches = "1.5"     # For more readable assertions
```

## Test Environment Requirements

- For backend tests: A PostgreSQL database (use the one from docker-compose)
- For WASM tests: Node.js and wasm-pack installed for browser-based tests

## Running Specific Test Types

### Running WASM Tests in the Browser

```bash
cd geco
wasm-pack test --chrome  # or --firefox, --safari
```

### Running Only Unit Tests

```bash
cargo test --lib
```

### Running Only Integration Tests

```bash
cargo test --test '*'
```

## Test Strategy

- **Unit Tests**: Test individual functions and methods in isolation
- **Integration Tests**: Test services and other components working together
- **Browser Tests**: Test WebAssembly functionality in a browser environment
- **Fuzz Tests**: Could be added in the future to test handling of invalid inputs