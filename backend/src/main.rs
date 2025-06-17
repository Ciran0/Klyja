// klyja/backend/src/main.rs
use axum::{
    routing::{get, post},
    Router,
};
use diesel::r2d2::{self, ConnectionManager};
use diesel::PgConnection;
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use dotenvy::dotenv;
use std::env;
use std::net::SocketAddr;
use std::path::PathBuf;
use tower_http::{
    cors::{Any, CorsLayer},
    services::ServeDir,
    trace::TraceLayer,
};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

mod protobuf_gen {
    include!(concat!(env!("OUT_DIR"), "/klyja.map_animation.v1.rs"));
}

mod auth; // Include the new auth module
mod db;
mod errors;
mod handlers;
mod models;
mod schema;
mod services;

#[derive(OpenApi)]
#[openapi(
    paths(
        handlers::health_check_handler,
        handlers::save_animation_handler,
        handlers::load_animation_handler,
        auth::me_handler, // Add new endpoints to OpenAPI spec
        auth::my_animations_handler,
    ),
    components(schemas(
        models::Animation,
        models::User,
        auth::MeResponse,
        auth::UserAnimationInfo,
        errors::ErrorResponsePayload,
        handlers::SuccessfulSaveResponsePayload,
    )),
    tags(
        (name = "Klyja API", description = "API for Klyja Application")
    )
)]
struct ApiDoc;

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("../migrations");
pub type DbPool = r2d2::Pool<ConnectionManager<PgConnection>>;

#[tokio::main]
async fn main() {
    dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let manager = ConnectionManager::<PgConnection>::new(database_url);
    let pool = r2d2::Pool::builder()
        .build(manager)
        .expect("Failed to create database connection pool.");

    {
        tracing::info!("Attempting to run database migrations...");
        let mut conn = pool
            .get()
            .expect("Failed to get DB connection for migrations");
        match conn.run_pending_migrations(MIGRATIONS) {
            Ok(_) => tracing::info!("Database migrations executed successfully."),
            Err(e) => tracing::error!("Failed to run database migrations: {}", e),
        }
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let project_root = manifest_dir
        .parent()
        .expect("Failed to get project root directory");

    let frontend_path = project_root.join("frontend/dist");
    let wasm_pkg_path = project_root.join("geco/pkg");

    tracing::info!(
        "Serving frontend static files from: {}",
        frontend_path.display()
    );
    tracing::info!(
        "Serving WASM package files from: {}",
        wasm_pkg_path.display()
    );

    // --- AUTH ROUTES ---
    let auth_routes = Router::new()
        .route("/:provider", get(auth::auth_redirect_handler))
        .route("/:provider/callback", get(auth::auth_callback_handler))
        .route("/logout", get(auth::logout_handler));

    // --- API ROUTES ---
    let api_routes = Router::new()
        .nest("/auth", auth_routes) // nest auth routes under /api/auth
        .route("/health", get(handlers::health_check_handler))
        .route("/save_animation", post(handlers::save_animation_handler))
        .route("/load_animation/:id", get(handlers::load_animation_handler))
        .route("/me", get(auth::me_handler))
        .route("/my_animations", get(auth::my_animations_handler));

    let static_files_service = ServeDir::new(frontend_path).append_index_html_on_directories(true);
    let wasm_pkg_service = ServeDir::new(wasm_pkg_path).append_index_html_on_directories(false);

    let app = Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .nest("/api", api_routes)
        .nest_service("/pkg", wasm_pkg_service)
        .fallback_service(static_files_service)
        .with_state(pool.clone())
        .layer(TraceLayer::new_for_http())
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        );

    let port_str = env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let port = port_str
        .parse::<u16>()
        .expect("PORT must be a valid u16 number");
    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    tracing::debug!("Server listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app.into_make_service())
        .await
        .unwrap();
}
