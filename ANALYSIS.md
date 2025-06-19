# Klyja Project Analysis

## 1\. Project Vision & Core Purpose

### 1.1. What is Klyja?

Klyja is a web application designed for worldbuilders, storytellers, and hobbyists to create and animate the geological history of fictional planets. It provides an intuitive, interactive 3D environment where users can draw continents, define tectonic plates, and animate their movements over millions of years.

### 1.2. The Problem It Solves

Creating believable fictional worlds often involves developing a deep history, including the evolution of its geography. However, existing tools are often inadequate:

  * **Fantasy Map Tools** (e.g., Inkarnate, Wonderdraft) are excellent for static, artistic maps but lack the capabilities for spherical projection, vector-based editing, and animation of tectonic movements.
  * **Scientific Software** (e.g., GPlates) is incredibly powerful for modeling Earth's tectonics but has a steep learning curve, is overly complex for fictional worldbuilding, and is not designed for creative, from-scratch workflows.

Klyja aims to fill this gap by providing a tool that is both **scientifically grounded** and **creatively intuitive**.

### 1.3. Target Audience

  * **Worldbuilders & Authors:** Individuals creating settings for novels, tabletop RPGs, and other creative projects.
  * **Hobbyist Geologists & Cartographers:** People passionate about map-making and planetary science.
  * **Educators:** Teachers and professors who need a simple tool to demonstrate the principles of plate tectonics.

-----

## 2\. System Architecture

Klyja is a modern, full-stack web application built with a clear separation of concerns, primarily using the Rust ecosystem. It is composed of three main, independently developed components that work in concert.

1.  **Frontend (Vanilla JS, Vite, Three.js)**

      * **Responsibility:** Renders the user interface, the 3D globe, and all visual elements. It captures user input and communicates with the other two components.
      * **Interaction:** It does not contain complex business logic. Instead, it sends user actions to the WASM module for state changes and to the Backend for persistence and authentication.

2.  **Backend (Rust, Axum)**

      * **Responsibility:** A stateless API server that handles user authentication (via GitHub OAuth2), data persistence, and serving the compiled frontend and WASM assets.
      * **Interaction:** Provides RESTful API endpoints for saving/loading animation data and managing user accounts. It interacts with the PostgreSQL database to store user and animation data.

3.  **Geometry & Animation Core (Rust to WASM - "Geco")**

      * **Responsibility:** The computational heart of the application. This module runs in the browser via WebAssembly. It manages the entire animation state in memory, including all geometric data, features, points, and keyframes. It performs all heavy calculations, such as spherical interpolation for plate movement.
      * **Interaction:** It exposes a clear, strongly-typed API to the Frontend, allowing the JavaScript code to manipulate the animation state without dealing with complex math.

-----

## 3\. Technology Stack Deep Dive

| Component | Technology | Rationale & Key Libraries |
| :--- | :--- | :--- |
| **Backend** | **Rust** | **Performance & Safety:** Provides C++-level performance with memory safety guarantees, ideal for a reliable server. A single language (Rust) can be used across the backend and the high-performance WASM module. |
| | `axum` | A modern, ergonomic, and modular web framework for building the API. |
| | `tokio` | The standard for asynchronous I/O in Rust, enabling a highly concurrent server. |
| | `diesel` | The most popular ORM in Rust, used for all database interactions with PostgreSQL. |
| | `oauth2`, `reqwest` | Used to implement the secure GitHub login flow. |
| | `utoipa` | Automatically generates an OpenAPI (Swagger) specification from code comments, making the API easy to explore and understand. |
| **Frontend** | **Vanilla JavaScript** | **Simplicity & Performance:** Avoids the overhead of large frameworks like React or Vue. The UI is state-driven but managed by a lightweight, custom application class (`KlyjaApp`). |
| | `Vite` | A next-generation frontend tooling system that provides an extremely fast development server and an optimized build process. |
| | `Three.js` | The de-facto standard for 3D graphics on the web. Used to render the interactive globe. |
| | **Custom GLSL Shaders** | Instead of creating thousands of Three.js objects for lines, Klyja uses a custom shader to draw all lines on the GPU. This is a highly performant approach, essential for a smooth user experience. |
| **Geometry Core** | **Rust to WASM** | **Near-Native Performance in the Browser:** Heavy geometry calculations (like spherical interpolation) would be too slow in JavaScript. Compiling Rust to WASM allows these operations to run at near-native speed. |
| | `wasm-bindgen` | Provides the bridge between Rust and JavaScript, allowing them to communicate seamlessly. |
| | `nalgebra` | A powerful linear algebra library for Rust, used for all 3D vector and matrix operations, including the crucial spherical linear interpolation (`slerp`). |
| **Database** | **PostgreSQL** | A robust, open-source relational database known for its reliability and feature set. |
| **Data Format** | **Protocol Buffers** | **Efficiency & Type Safety:** A language-agnostic, binary serialization format. It's more compact and faster to parse than JSON and ensures that the data structures are consistent between the Rust backend and the Rust WASM module. |

-----

## 4\. Core Features & User Stories

This section outlines the application's features, based on the original user stories and the current state of the codebase.

### 4.1. Account & Session Management (`backend/src/auth.rs`) - Implemented

  * **As a user, I want to sign up and log in to the application securely.**
      * **Implementation:** Secure login is implemented via GitHub OAuth2. The backend handles the OAuth flow, creates a user record, and establishes a session using secure HTTP-only cookies.
  * **As a user, I want to log out of my session.**
      * **Implementation:** A `/api/auth/logout` endpoint clears the session cookie and invalidates the session on the backend.
  * **As a user, I want to see my profile information.**
      * **Implementation:** The `/api/me` endpoint returns the current logged-in user's information.

### 4.2. Project Management (`backend/src/services.rs`, `frontend/js/main.js`) - Implemented

  * **As a user, I want to create a new project (animation).**
      * **Implementation:** The frontend initializes a new, blank animation state within the Geco WASM module.
  * **As a user, I want to save my project to the server.**
      * **Implementation:** The frontend retrieves the animation state as a Protobuf binary from WASM and sends it to the `/api/save_animation` endpoint. The backend stores this in the database, linked to the authenticated user.
  * **As a user, I want to see a list of my saved projects and load one.**
      * **Implementation:** The `/api/my_animations` endpoint fetches the list of projects for the user. Clicking a project calls the `/api/load_animation/:id` endpoint, which returns the Protobuf data. The frontend then loads this data into the WASM module, completely restoring the project state.

### 4.3. Drawing & Feature Editing (`geco/src/lib.rs`, `frontend/js/main.js`) - Implemented

  * **As a user, I want to create different types of features, like continents (polygons) or rift lines (polylines).**
      * **Implementation:** The UI allows creating a new "Feature" with a name, type (Polygon/Polyline), and an appearance/disappearance frame. This action is handled by the `Geco::create_feature` function in WASM.
  * **As a user, I want to draw features on the globe by placing nodes (points).**
      * **Implementation:** A "Click to add points" mode allows the user to click on the sphere. The `ThreeViewer` captures the 3D coordinates, and the `KlyjaApp` instructs the WASM module to add a new point to the currently active feature using `Geco::add_point_to_active_feature`.
  * **As a user, I want to select a feature to edit it.**
      * **Implementation:** The UI lists all features in the animation. Clicking a feature sets it as the `active_feature` in both the UI and the WASM module. Active features are highlighted in the 3D view for clear visual feedback.

### 4.4. Animation (`geco/src/lib.rs`) - Implemented

  * **As a user, I want to make plates drift over time.**
      * **Implementation:** This is achieved through keyframe animation. A user can select a point, move to a specific frame on the timeline, and add a "keyframe" at the current sphere coordinates.
  * **As a user, I want to see the interpolated movement between keyframes.**
      * **Implementation:** The core `interpolate_point_position` function in `geco/lib.rs` handles this. When the user scrubs the timeline, it calculates the position of every point for the given frame. It uses **Spherical Linear Interpolation (slerp)** via the `nalgebra` library to ensure points move correctly across the surface of the sphere, rather than in a straight line through it.

### 4.5. Planned & Future Features (from original `ANALYSIS.md`)

The following features were part of the original vision and represent the next steps for the project:

  * **Advanced Tectonics:**
      * Defining rifts to split features.
      * Automatically creating new oceanic crust between diverging plates.
      * Defining subduction zones.
      * Collision detection and management (orogeny, accreted terrain).
  * **Helper Tools:**
      * A tool to measure distances on the sphere.
      * Automatic indication of geological features (island arcs, hotspot trails).
  * **Exporting:**
      * Exporting map snapshots and full animation timelapses (e.g., as images, vectors, or video).

-----

## 5\. Data Models & Flow

### 5.1. Database Schema (`backend/migrations/`)

The PostgreSQL database is simple and focused on storing user data and the complete animation state.

  * `users`: Stores user information from the OAuth provider.
      * `id`, `provider`, `provider_id`, `email`, `display_name`, `created_at`, `updated_at`
  * `sessions`: Stores user session tokens for authentication.
      * `session_token`, `user_id`, `expires_at`, `created_at`
  * `animations`: Stores the animation projects.
      * `id`, `name`, `user_id` (foreign key to `users`), `created_at`, `updated_at`
      * `protobuf_data (BYTEA)`: This is the most important column. It stores the entire state of a given animation, serialized into a binary blob using Protocol Buffers.

### 5.2. Protobuf Schema (`protobuf/AnimationData.proto`)

This is the canonical definition of the animation data structure. It is shared between the `geco` (WASM) module and the `backend`.

```protobuf
// A simplified representation of the implied schema
message MapAnimation {
  string animation_id = 1;
  string name = 2;
  int32 total_frames = 3;
  repeated Feature features = 4;
}

message Feature {
  string feature_id = 1;
  string name = 2;
  FeatureType type = 3; // POLYGON or POLYLINE
  int32 appearance_frame = 4;
  int32 disappearance_frame = 5;
  repeated PointAnimationPath point_animation_paths = 6;
  repeated FeatureStructureSnapshot structure_snapshots = 7;
}

message PointAnimationPath {
  string point_id = 1;
  repeated PositionKeyframe keyframes = 2;
}

message PositionKeyframe {
  int32 frame = 1;
  Point position = 2;
}

message Point {
  float x = 1;
  float y = 2;
  float z = 3;
}

message FeatureStructureSnapshot {
    int32 frame = 1;
    repeated string ordered_point_ids = 2;
}
```

### 5.3. Data Flow (Save Operation)

1.  **User Action:** User clicks "Save".
2.  **Frontend:** The `KlyjaApp` calls `wasmManager.getAnimationProtobuf()`.
3.  **WASM (`geco`):** The `Geco` instance serializes its current `MapAnimation` state into a `Vec<u8>` (byte array).
4.  **Frontend:** The `ApiClient` sends this byte array in the body of a `POST` request to the `/api/save_animation` endpoint.
5.  **Backend:** The `save_animation_handler` receives the raw bytes. It passes them to the `AnimationService`, which deserializes the Protobuf to validate it, then stores the raw byte array in the `animations` table in the database.

The **load** operation is this exact process in reverse.

-----

## 6\. API Endpoints (`backend/main.rs`, `backend/auth.rs`)

The backend exposes a RESTful API. All data-mutating endpoints and user-specific data endpoints require authentication.

  * **Authentication**
      * `GET /api/auth/github`: Redirects the user to GitHub to log in.
      * `GET /api/auth/github/callback`: Endpoint for GitHub to redirect back to after login. Handles session creation.
      * `GET /api/auth/logout`: Clears the user's session.
  * **User**
      * `GET /api/me`: Returns information about the currently authenticated user.
      * `GET /api/my_animations`: Returns a list of all animations owned by the current user.
  * **Animations**
      * `POST /api/save_animation`: Saves an animation. The request body is the raw `MapAnimation` Protobuf data.
      * `GET /api/load_animation/{id}`: Loads a specific animation by its ID. Returns the raw `MapAnimation` Protobuf data.
  * **System**
      * `GET /api/health`: A simple health check endpoint.
  * **Documentation**
      * `/swagger-ui`: An interactive Swagger/OpenAPI documentation page for the API.

-----

## 7\. CI/CD & Operations (`.github/workflows/main.yml`)

The project is configured for professional-grade Continuous Integration and Continuous Deployment.

  * **On every push/pull request:**
    1.  **Checkout & Setup:** The environment is prepared with Rust, Node.js, and Protoc.
    2.  **Testing:** A comprehensive test suite is run:
          * Backend tests (`cargo test`).
          * WASM core logic tests (`cargo test --lib`).
          * WASM browser integration tests (`wasm-pack test --headless`).
          * Frontend tests with coverage (`npm run test:coverage`).
    3.  **Code Coverage:** Coverage reports from all three components are uploaded as artifacts and sent to Codecov.io for tracking.
  * **On push to `main` or `staging` branches:**
    1.  **Build Docker Image:** The `build-and-push-docker` job compiles the entire application (including the production frontend) and builds a Docker image.
    2.  **Push to Registry:** The image is pushed to GitHub Container Registry (`ghcr.io`).
  * **On push to `staging` branch:**
    1.  **Deploy:** The `deploy-to-staging` job is triggered, which calls a webhook to deploy the newly built Docker image to the staging environment on Render.com.

-----

## 8\. AI Developer Guide: Quick Reference

This section provides quick pointers for an AI assistant to navigate the codebase for common tasks.

  * **To add a new API endpoint:**

    1.  Add a new handler function in `backend/src/handlers.rs`.
    2.  If it involves new business logic, add a corresponding function in `backend/src/services.rs`.
    3.  Register the new route in `backend/src/main.rs`.
    4.  Add the `#[utoipa::path(...)]` macro to the handler to include it in the API documentation.

  * **To modify the 3D rendering or visualization:**

      * The core logic is in `frontend/js/three-viewer.js`.
      * The rendering of lines on the sphere is handled by the custom shaders in `frontend/glsl/`. `line_vertex.glsl` and `line_fragment.glsl`.

  * **To change the core animation or geometry logic:**

      * All core state management and mathematical calculations are in `geco/src/lib.rs`.
      * Specifically, for plate movement logic, review `interpolate_point_position` and its use of `nalgebra::slerp`.

  * **To change the application's data structure:**

    1.  **Start here:** Modify the message definitions in `protobuf/AnimationData.proto`.
    2.  Run `cargo build` in both the `backend` and `geco` directories to re-run their `build.rs` scripts, which will regenerate the Rust code from the `.proto` file.
    3.  Update the Rust code in both `backend` and `geco` that uses the modified message fields.

  * **To add a new UI component or interaction:**

    1.  Add the HTML to `frontend/index.html`.
    2.  In `frontend/js/main.js`:
          * Cache the new DOM element in `cacheDOMElements()`.
          * Add new state properties to `this.uiState` if needed.
          * Bind event listeners in `bindUIEvents()`.
          * Update the DOM from the state in `syncUIToState()`.
          * Create a new handler function for the interaction (e.g., `handleNewButtonClick()`).
