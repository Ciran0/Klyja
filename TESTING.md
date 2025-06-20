# Testing in Klyja

This document provides a comprehensive guide to running the tests for the Klyja project. The project is configured with a robust testing strategy that covers all three of its core components: the Rust **Backend**, the **Frontend** application, and the Rust-to-WASM **Geco** module.

## Prerequisites

Before running any tests, ensure you have the following tools installed and configured:
* **Rust Toolchain:** Including `cargo`.
* **Node.js:** Version 20.x or higher, with `npm`.
* **wasm-pack:** For building and testing the WebAssembly module.
* **Docker & Docker Compose:** Required for running the PostgreSQL test database environment.

## Full Test Suite Execution

To run the entire test suite as it is executed in the CI/CD pipeline, you first need to start the test database and install frontend dependencies.

**1. Start the Test Database:**
```bash
docker-compose up -d
```

**2. Install Frontend Dependencies:**
```bash
npm install --prefix frontend
```

**3. Run All Tests and Generate Coverage:**

The most comprehensive way to run all tests is to execute the scripts for each component sequentially, which also generates code coverage reports.

```bash
#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

echo "--- Running Backend Tests & Coverage ---"
# Uses cargo-tarpaulin to generate a Cobertura XML coverage report
cargo tarpaulin --packages backend --engine Llvm --out Xml --output-dir target/coverage/backend -- --test-threads=1

echo "--- Running Geco (WASM) Lib Tests & Coverage ---"
# Tests the Rust library logic of the WASM module
cargo tarpaulin --packages geco --engine Llvm --out Xml --output-dir target/coverage/geco --lib -- --test-threads=1

echo "--- Running Geco (WASM) Headless Browser Tests ---"
# Tests the WASM module's browser integration
(cd geco && wasm-pack test --headless --firefox)

echo "--- Running Frontend Tests & Coverage ---"
npm run test:coverage --prefix frontend

echo "--- All tests completed successfully! ---"
```

## Component-Specific Testing

You can also run tests for each part of the application individually.

### 1. Backend (`backend/`)

The backend is a Rust crate tested with a combination of unit and integration tests. The integration tests are particularly robust, as they automatically create and tear down a temporary, isolated PostgreSQL database for each test run.

* **Key Libraries:** `axum-test`, `rstest`, `diesel`, `tokio-test`, `tempfile`.
* **Test Database:** The test setup in `backend/tests/common/test_db.rs` connects to the running Docker container and programmatically creates a new database for tests, ensuring a clean state.

**Running Tests:**
```bash
# Run all backend unit and integration tests
cargo test -p backend
```

**Generating Coverage:**
The `cargo-tarpaulin` tool is used to generate test coverage reports.
```bash
cargo tarpaulin --packages backend --engine Llvm --out Html --output-dir target/coverage/backend -- --test-threads=1
# An HTML report will be available at: target/coverage/backend/tarpaulin-report.html
```

**What's Tested:**
* **API Endpoints:** Full request/response cycle for `/api/save_animation`, `/api/load_animation`, and user auth endpoints (`/api/me`, `/api/my_animations`).
* **Database Logic:** CRUD operations and data integrity.
* **Authentication & Authorization:** Secure session management and ensuring users can only access their own data.
* **Error Handling:** Testing for correct HTTP status codes on failure (e.g., `401 Unauthorized`, `404 Not Found`).
* **Protobuf Serialization:** Correctly handling binary data from the frontend.

### 2. Geometry Core / WASM (`geco/`)

The `geco` crate has two distinct types of tests: standard Rust unit tests for the core logic and WASM-specific tests that run in a headless browser to ensure browser compatibility.

* **Key Libraries:** `wasm-bindgen-test`, `js-sys`.

**Running Tests:**

1.  **Rust Unit Tests (command line):**
    ```bash
    # This tests the pure Rust logic, like the interpolation functions.
    cargo test -p geco --lib
    ```

2.  **WebAssembly Browser Tests:**
    This command compiles the crate to WASM and runs tests annotated with `#[wasm_bindgen_test]` in a real browser environment.
    ```bash
    # Run tests in a headless Firefox instance
    (cd geco && wasm-pack test --headless --firefox)

    # You can also run in other installed browsers:
    # wasm-pack test --chrome
    # wasm-pack test --safari
    ```

**Generating Coverage:**
Coverage is generated from the Rust unit tests.
```bash
cargo tarpaulin --packages geco --engine Llvm --out Html --output-dir target/coverage/geco --lib -- --test-threads=1
# An HTML report will be available at: target/coverage/geco/tarpaulin-report.html
```

**What's Tested:**
* Core data structures (`MapAnimation`, `Feature`, `Point`).
* Spherical linear interpolation (`slerp`) logic.
* State management functions exposed to JavaScript (`create_feature`, `add_point`, etc.).
* Protobuf serialization/deserialization cycle.
* Error handling for invalid operations (e.g., adding a duplicate point).

### 3. Frontend (`frontend/`)

The frontend application is tested using **Vitest**, a modern and fast testing framework. Tests run in a simulated DOM environment (`happy-dom`) and include unit tests for individual modules and integration tests for the `KlyjaApp` class.

* **Key Libraries:** `vitest`, `@vitest/coverage-v8`, `@testing-library/dom`.
* **Setup:** Mocks for `three.js`, the WASM module, and the `ApiClient` are configured in `frontend/tests/setup.js` to isolate components during testing.

**Running Tests:**

```bash
# Run all frontend tests once
npm test --prefix frontend

# Run tests in watch mode for active development
npm run test:watch --prefix frontend

# Run tests with the Vitest UI for an interactive experience
npm run test:ui --prefix frontend
```

**Generating Coverage:**
```bash
npm run test:coverage --prefix frontend
# An HTML report will be available at: frontend/coverage/index.html
```

**What's Tested:**
* **UI State Management:** `KlyjaApp` logic for handling user input and updating the UI.
* **API Client:** Mocking `fetch` to test `ApiClient`'s ability to correctly save and load data.
* **WASM Manager:** Verifying that the `WasmManager` class calls the correct underlying WASM functions.
* **User Interactions:** Simulating button clicks and inputs to ensure the application state changes as expected.
* **Rendering Logic:** Ensuring the `ThreeViewer` is called with the correct data from the WASM module.

## Future Test Areas

While the current test coverage is comprehensive, the following areas could be enhanced in the future:

* **End-to-End (E2E) Tests:** A suite that runs the entire application stack (backend, frontend, and database) and simulates real user workflows using a browser automation tool like Playwright or Cypress.
* **Performance Tests:**
    * Benchmarking key backend API endpoints under load.
    * Measuring the performance of Protobuf serialization/deserialization with very large animation datasets.
    * Testing the frontend rendering framerate with a high number of polygons and points.
* **Fuzz Testing:** Providing malformed or random Protobuf data to the backend and WASM load functions to ensure they handle unexpected input gracefully without panicking.
* **Visual Regression Testing:** For the `ThreeViewer`, capturing screenshots of the rendered output and comparing them against baseline images to automatically detect unintended visual changes.
