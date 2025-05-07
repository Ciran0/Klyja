// klyja/frontend/js/main.js
import * as THREE from 'three';
// --- Import OrbitControls ---
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Import WASM functions
import init, { Geco } from '/pkg/geco.js'; // Removed greet for clarity

console.log("main.js loaded.");

// --- Make Geco instance and key functions globally accessible (simple approach) ---
// Better patterns: Use event emitters, state management libraries, or pass instances around.
window.gecoInstance = null;
window.saveWasmData = null; // Placeholder for save function
window.loadWasmData = null; // Placeholder for load function
window.renderWasmState = null; // Placeholder for render function

// --- Three.js variables (global within the module scope) ---
let scene, camera, renderer, controls, mainSphereMesh;
let visualObjects = []; // Array to keep track of added points/lines meshes for easy removal

// --- Constants ---
const SPHERE_RADIUS = 5; // Define sphere radius

async function startApp() {
    console.log('Initializing application...');
    try {
        // 1. Initialize WASM
        await init();
        window.gecoInstance = new Geco(); // Assign to global scope
        console.log('WASM module initialized. Animation Name:', gecoInstance.get_animation_name());

        // Make save/load functions globally available (implement later in Step 23)
        window.saveWasmData = saveAnimationData;
        window.loadWasmData = loadAnimationData;
        window.renderWasmState = renderCurrentWasmState; // Assign render function

        // Update Alpine state initially
       // const alpineState = Alpine.raw(document.querySelector('[x-data]').__x.getUnobservedData());
       // alpineState.wasmAnimationName = gecoInstance.get_animation_name();
       // alpineState.currentAnimationName = gecoInstance.get_animation_name(); // Sync input


        // 2. Initialize Three.js
        initThreeJS();
        console.log('Three.js initialized.');

        // 3. Initial Render of WASM state
        renderCurrentWasmState();

        // 4. Setup Event Listeners (Raycasting - implement in Step 21)
        setupRaycasting();

        console.log('Application started successfully.');
        // Update status via Alpine after full init
        //alpineState.statusMessage = 'Application initialized successfully.';

    } catch (error) {
        console.error("Failed to initialize the application:", error);
        //const alpineState = Alpine.raw(document.querySelector('[x-data]').__x.getUnobservedData());
        //if(alpineState) alpineState.statusMessage = `Error initializing: ${error.message}`;
    }
}

function initThreeJS() {
    const viewerContainer = document.getElementById('viewer-container');
    if (!viewerContainer) throw new Error('Viewer container not found!');

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x282c34); // Darker background

    // Camera
    camera = new THREE.PerspectiveCamera(
        75, // fov
        viewerContainer.clientWidth / viewerContainer.clientHeight, // aspect
        0.1, // near
        1000 // far
    );
    camera.position.z = SPHERE_RADIUS * 2.5; // Position camera based on radius

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(viewerContainer.clientWidth, viewerContainer.clientHeight);
    viewerContainer.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    // Main Sphere
    const sphereGeometry = new THREE.SphereGeometry(SPHERE_RADIUS, 64, 32); // More segments
    const sphereMaterial = new THREE.MeshStandardMaterial({ // Use StandardMaterial for lighting
        color: 0x0077ff,
        wireframe: false, // Show solid sphere
        metalness: 0.2,
        roughness: 0.7,
     });
    mainSphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
    scene.add(mainSphereMesh);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Smooth rotation
    controls.dampingFactor = 0.05;
    controls.minDistance = SPHERE_RADIUS + 1; // Prevent zooming inside
    controls.maxDistance = SPHERE_RADIUS * 10;

    // Animation Loop
    function animate() {
        requestAnimationFrame(animate);
        controls.update(); // Update controls if damping enabled
        renderer.render(scene, camera);
    }
    animate();

    // Handle Resize
    window.addEventListener('resize', () => {
        camera.aspect = viewerContainer.clientWidth / viewerContainer.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(viewerContainer.clientWidth, viewerContainer.clientHeight);
    });
}

// --- Rendering Function ---
function renderCurrentWasmState() {
    if (!window.gecoInstance || !scene) {
        console.error("Geco instance or Three.js scene not ready for rendering.");
        return;
    }
    console.log("Rendering current WASM state...");

    // 1. Clear previous visual objects
    visualObjects.forEach(obj => scene.remove(obj));
    visualObjects = []; // Reset the array

    // 2. Get current state from WASM
    const polygonsJson = window.gecoInstance.get_polygons_json();
    let polygonsData = [];
    try {
        polygonsData = JSON.parse(polygonsJson);
    } catch (e) {
        console.error("Failed to parse polygons JSON:", e);
        // Update status via Alpine
        //const alpineState = Alpine.raw(document.querySelector('[x-data]').__x.getUnobservedData());
        //if(alpineState) alpineState.statusMessage = `Error parsing state: ${e.message}`;
        return; // Don't proceed if data is invalid
    }

    console.log("Parsed State:", polygonsData);

    // 3. Create Three.js objects for the data
    const pointMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red points
    const pointGeometry = new THREE.SphereGeometry(0.1, 16, 8); // Small sphere geometry for points

    polygonsData.forEach(polygon => {
        if (polygon.points) {
            polygon.points.forEach(animatedPoint => {
                if (animatedPoint.initial_position) {
                    const pos = animatedPoint.initial_position;

                    // Create a mesh for the point
                    const pointMesh = new THREE.Mesh(pointGeometry, pointMaterial);

                    // --- Position the point ON the sphere surface ---
                    // We assume points (x,y,z) from WASM are already on the sphere.
                    // If they were normalized vectors, we'd multiply by radius.
                    pointMesh.position.set(pos.x, pos.y, pos.z || 0); // Use 0 if Z is null/undefined

                    // Add to scene and track it
                    scene.add(pointMesh);
                    visualObjects.push(pointMesh);
                }
            });
        }
        // TODO: Render lines connecting the points for each polygon later
    });
    console.log(`Rendered ${visualObjects.length} points.`);
}

// --- Raycasting Setup ---
function setupRaycasting() {
    if (!renderer || !camera || !mainSphereMesh || !window.gecoInstance) {
         console.error("Cannot setup raycasting - dependencies missing.");
         return;
    }
    console.log("Setting up raycasting...");

    const raycaster = new THREE.Raycaster();
    const mouseNDC = new THREE.Vector2(); // Normalized Device Coordinates (-1 to +1)

    renderer.domElement.addEventListener('click', (event) => {
        // --- Calculate Mouse Coordinates in NDC ---
        // 1. Get mouse position relative to the canvas
        const rect = renderer.domElement.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        // 2. Convert to NDC (-1 to +1 range)
        mouseNDC.x = (mouseX / rect.width) * 2 - 1;
        mouseNDC.y = -(mouseY / rect.height) * 2 + 1; // Y is inverted in NDC

        // --- Perform Raycasting ---
        raycaster.setFromCamera(mouseNDC, camera);
        const intersects = raycaster.intersectObject(mainSphereMesh); // Check intersection with the main sphere

        if (intersects.length > 0) {
            const intersectionPoint = intersects[0].point; // The THREE.Vector3 point on the sphere surface
            console.log("Sphere clicked at 3D coordinates:", intersectionPoint);

            // --- Update status via Alpine ---
            //const alpineState = Alpine.raw(document.querySelector('[x-data]').__x.getUnobservedData());
            //if(alpineState) alpineState.statusMessage = `Sphere clicked at: (${intersectionPoint.x.toFixed(2)}, ${intersectionPoint.y.toFixed(2)}, ${intersectionPoint.z.toFixed(2)})`;

            // --- Call WASM to add the point (Step 22) ---
            try {
                 window.gecoInstance.add_point_to_active_polygon(
                     intersectionPoint.x,
                     intersectionPoint.y,
                     intersectionPoint.z
                 );
                 // --- Re-render the scene to show the new point ---
                 renderCurrentWasmState();
            } catch(e) {
                 console.error("Error calling add_point_to_active_polygon:", e);
                 //if(alpineState) alpineState.statusMessage = `Error adding point: ${e.message}`;
            }

        } else {
            console.log("Click did not intersect the sphere.");
        }
    });
}

// --- Save/Load Functions ---
async function saveAnimationData() {
    console.log("Attempting to save animation data...");
    if (!window.gecoInstance) {
        throw new Error("Geco instance not available.");
    }

    // 1. Get Protobuf bytes from WASM
    const protoBytes = window.gecoInstance.get_animation_protobuf(); // Returns Uint8Array
    console.log(`Got ${protoBytes.length} bytes from WASM.`);

    // 2. Send bytes to backend
    const response = await fetch('/api/save_animation', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/octet-stream'
        },
        body: protoBytes
    });

    if (!response.ok) {
        // Try to get error message from response body
        const errorText = await response.text().catch(() => 'Failed to get error details');
        console.error('Save failed:', response.status, response.statusText, errorText);
        throw new Error(`Save failed (${response.status}): ${errorText || response.statusText}`);
    }

    // Status 201 Created is expected on success
    if (response.status === 201) {
         console.log('Save successful!');
         // No return needed, promise resolves successfully
    } else {
        console.warn('Save request returned unexpected status:', response.status);
        // Treat unexpected success codes as success anyway? Or throw error?
        // Let's treat it as success for now.
    }
}

async function loadAnimationData(id) {
    console.log(`Attempting to load animation data for ID: ${id}...`);
    if (!window.gecoInstance) {
        throw new Error("Geco instance not available.");
    }
    if (typeof id !== 'number' || isNaN(id)) {
        throw new Error("Invalid ID provided for loading.");
    }

    // 1. Fetch data from backend
    const response = await fetch(`/api/load_animation/${id}`);

    if (!response.ok) {
        const errorText = await response.text().catch(() => 'Failed to get error details');
        console.error('Load failed:', response.status, response.statusText, errorText);
        throw new Error(`Load failed (${response.status}): ${errorText || response.statusText}`);
    }

    // 2. Get response body as ArrayBuffer, convert to Uint8Array
    const arrayBuffer = await response.arrayBuffer();
    const protoBytes = new Uint8Array(arrayBuffer);
    console.log(`Received ${protoBytes.length} bytes for animation ${id}`);

// 3. Call WASM to load the data, render, and get the new name
    try {
        // This call can throw if WASM's load_animation_protobuf returns Err(JsValue)
        window.gecoInstance.load_animation_protobuf(protoBytes);
        console.log("Loaded animation into WASM.");

        // 4. Re-render the scene with loaded data
        renderCurrentWasmState(); // Ensure this function is robust

        // 5. Return the new animation name
        const newAnimationName = window.gecoInstance.get_animation_name();
        console.log(`Animation ID ${id} loaded, new name in WASM: ${newAnimationName}`);
        return newAnimationName;

    } catch (e) {
        // This 'e' could be a JsValue error from wasm-bindgen if load_animation_protobuf returns Err(JsValue)
        // Or any other JS error during renderCurrentWasmState or get_animation_name
        console.error("Error during WASM load, state retrieval, or rendering:", e);
        let errorMessage = "Failed to process loaded data in WASM or update view.";
        if (e instanceof Error && e.message) { // Standard JS error
            errorMessage = e.message;
        } else if (typeof e === 'string') { // JsValue might be a string from WASM
            errorMessage = e;
        } else { // Try to serialize JsValue if it's an object
            try { errorMessage = JSON.stringify(e); } catch (_) {}
        }
        throw new Error(errorMessage); // Re-throw a standard Error
    }
}

// --- Start the app ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}
