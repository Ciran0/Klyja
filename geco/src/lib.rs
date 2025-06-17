// klyja/geco/src/lib.rs
use prost::Message;
use wasm_bindgen::prelude::*;
// --- Add serde for JSON serialization ---
use serde::Serialize; // Needed for get_polygons_json

// --- Protobuf Includes ---
pub mod protobuf_gen {
    // Use include! with OUT_DIR
    include!(concat!(env!("OUT_DIR"), "/klyja.map_animation.v1.rs"));

    // --- Add Serialize derive for relevant structs ---
    // Need to add #[derive(serde::Serialize)] to the structs in the generated code
    // This requires modifying the build script slightly or using feature flags in prost-build
    // Let's try adding it via build script attributes first.
    // If that fails, we might need prost-serde feature or manual JSON construction.
    // Update: Let's create *separate* serializable structs within Geco to avoid build script complexity for now.
}
use protobuf_gen::{AnimatedPoint, MapAnimation, Point, Polygon};

// --- Simple Structs for JSON Serialization ---
// Define simplified structs matching protobuf structure but with Serialize
#[derive(Serialize)]
struct SimplePoint {
    x: f32,
    y: f32,
    z: Option<f32>,
}
impl From<&Point> for SimplePoint {
    fn from(p: &Point) -> Self {
        SimplePoint {
            x: p.x,
            y: p.y,
            z: p.z,
        }
    }
}

#[derive(Serialize)]
struct SimpleAnimatedPoint {
    point_id: String,
    initial_position: Option<SimplePoint>, // Use Option<> for message fields
                                           // Skip movements for now for simplicity
}
impl From<&AnimatedPoint> for SimpleAnimatedPoint {
    fn from(ap: &AnimatedPoint) -> Self {
        SimpleAnimatedPoint {
            point_id: ap.point_id.clone(),
            initial_position: ap.initial_position.as_ref().map(SimplePoint::from),
        }
    }
}

#[derive(Serialize)]
struct SimplePolygon {
    polygon_id: String,
    points: Vec<SimpleAnimatedPoint>,
    properties: std::collections::HashMap<String, String>, // Protobuf map -> HashMap
}
impl From<&Polygon> for SimplePolygon {
    fn from(poly: &Polygon) -> Self {
        SimplePolygon {
            polygon_id: poly.polygon_id.clone(),
            points: poly.points.iter().map(SimpleAnimatedPoint::from).collect(),
            properties: poly.properties.clone(), // Clone the map
        }
    }
}
// --- End Simple Structs ---

// Optional logging setup...
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
    fn alert(s: &str); // Keep alert if used by greet
}
macro_rules! console_log { ($($t:tt)*) => (log(&format_args!($($t)*).to_string())) }

#[wasm_bindgen]
pub struct Geco {
    animation_state: MapAnimation,
    // --- Track the currently active polygon for adding points ---
    active_polygon_id: Option<String>,
}

#[wasm_bindgen]
impl Geco {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        console_log!("Geco::new() called");
        Geco {
            animation_state: MapAnimation {
                animation_id: format!("id-{}", uuid::Uuid::new_v4()), // Use UUID for default ID
                name: "Untitled Animation".to_string(),
                total_frames: 0,
                polygons: vec![],
            },
            active_polygon_id: None, // No active polygon initially
        }
    }

    // --- Name Management ---
    pub fn set_animation_name(&mut self, name: String) {
        console_log!("Setting animation name to: {}", name);
        self.animation_state.name = name;
    }
    pub fn get_animation_name(&self) -> String {
        self.animation_state.name.clone()
    }

    // --- Geometry Management ---
    pub fn add_static_polygon(&mut self, polygon_id: String, point_x: f32, point_y: f32) {
        console_log!("Adding static polygon: {}", polygon_id);
        let point = Point {
            x: point_x,
            y: point_y,
            z: Some(0.0),
        }; // Add default Z
        let animated_point = AnimatedPoint {
            point_id: format!("{}-pt0", polygon_id),
            initial_position: Some(point),
            movements: vec![],
        };
        let polygon = Polygon {
            polygon_id: polygon_id.clone(),
            points: vec![animated_point],
            properties: Default::default(),
        };
        self.animation_state.polygons.push(polygon);
        // --- Set the newly added polygon as active ---
        self.active_polygon_id = Some(polygon_id.clone());
        console_log!(
            "Polygon '{}' added and set as active. Total polygons: {}",
            polygon_id,
            self.animation_state.polygons.len()
        );
    }

    /// Adds a point to the currently active polygon.
    pub fn add_point_to_active_polygon(&mut self, x: f32, y: f32, z: f32) {
        console_log!("Attempting to add point ({}, {}, {})", x, y, z);
        if let Some(active_id) = &self.active_polygon_id {
            console_log!("Active polygon ID: {}", active_id);
            // Find the active polygon by ID
            if let Some(polygon) = self
                .animation_state
                .polygons
                .iter_mut()
                .find(|p| p.polygon_id == *active_id)
            {
                let point_index = polygon.points.len();
                let point_id = format!("{}-pt{}", active_id, point_index);
                console_log!("New point ID: {}", point_id);

                let point = Point { x, y, z: Some(z) };
                let animated_point = AnimatedPoint {
                    point_id: point_id.clone(),
                    initial_position: Some(point),
                    movements: vec![], // Static point initially
                };
                polygon.points.push(animated_point);
                console_log!(
                    "Added point {} to polygon {}. Total points: {}",
                    point_id,
                    active_id,
                    polygon.points.len()
                );
            } else {
                console_log!(
                    "Error: Active polygon ID '{}' not found in state!",
                    active_id
                );
                self.active_polygon_id = None; // Reset if ID is invalid
            }
        } else {
            console_log!("Warning: No active polygon set. Cannot add point.");
        }
    }

    // --- Getter for JS Rendering ---
    /// Returns the current polygon state as a JSON string.
    #[wasm_bindgen]
    pub fn get_polygons_json(&self) -> String {
        console_log!("Serializing polygon state to JSON...");
        // Convert internal Protobuf structs to simple serializable structs
        let simple_polygons: Vec<SimplePolygon> = self
            .animation_state
            .polygons
            .iter()
            .map(SimplePolygon::from)
            .collect();

        // Serialize the simple structs to JSON
        serde_json::to_string(&simple_polygons).unwrap_or_else(|e| {
            console_log!("Error serializing polygons to JSON: {}", e);
            "[]".to_string() // Return empty JSON array on error
        })
    }

    // --- Serialization / Deserialization ---
    pub fn get_animation_protobuf(&self) -> Vec<u8> {
        // ... (keep implementation from previous step)
        console_log!("Serializing animation state to Protobuf...");
        self.animation_state.encode_to_vec()
    }
    pub fn load_animation_protobuf(&mut self, data: &[u8]) -> Result<(), JsValue> {
        // ... (keep implementation from previous step)
        console_log!("Deserializing Protobuf data ({} bytes)...", data.len());
        match MapAnimation::decode(data) {
            Ok(decoded_state) => {
                self.animation_state = decoded_state;
                // Reset active polygon on load
                self.active_polygon_id = self
                    .animation_state
                    .polygons
                    .last()
                    .map(|p| p.polygon_id.clone());
                console_log!(
                    "Protobuf deserialized successfully. Name: {}. Active polygon: {:?}",
                    self.animation_state.name,
                    self.active_polygon_id
                );
                Ok(())
            }
            Err(e) => {
                let error_msg = format!("Failed to decode Protobuf: {}", e);
                console_log!("Error: {}", error_msg);
                Err(JsValue::from_str(&error_msg))
            }
        }
    }
}

// --- Add Dependencies ---
// Need uuid for default IDs and serde_json for the getter
// Add to geco/Cargo.toml:
// serde = { version = "1", features = ["derive"] }
// serde_json = "1.0"
// uuid = { version = "1", features = ["v4", "wasm-bindgen"] }
// --- Keep the greet function for basic testing if desired ---

// Include the test module
#[cfg(test)]
#[path = "lib_test.rs"]
mod tests;
