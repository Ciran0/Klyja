// backend/tests/common/mod.rs
pub mod test_db;

// Re-export commonly used items
pub use test_db::{fixtures, TestDb};
