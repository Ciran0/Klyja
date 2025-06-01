// frontend/js/main.js
import { ThreeViewer } from './three-viewer.js';
import { WasmManager } from './wasm-manager.js';
import { ApiClient } from './api-client.js';

export class KlyjaApp {
    constructor() {
        this.viewer = null;
        this.wasmManager = null;
        this.apiClient = null;
        this.initialized = false;

        this.uiState = {
            currentAnimationName: 'Untitled Animation',
            wasmAnimationName: 'Loading...',
            statusMessage: 'App Loaded.',
            // New animation-related state
            currentFrame: 0,
            totalFrames: 100, // Will be synced with WASM
            activeFeatureId: null,
            lastSphereClickCoords: { x: 0, y: 0, z: 0 },
            // UI input states (mirrors input fields for easier access)
            featureNameInput: 'MyFeature',
            featureTypeInput: 1, // Default to Polygon
            featureAppearanceFrameInput: 0,
            featureDisappearanceFrameInput: 100,
            pointIdInput: 'p1',
        };
        this.dom = {};
    }

    cacheDOMElements() {
        // Existing
        this.dom.animNameInput = document.getElementById('anim-name-input');
        this.dom.wasmNameSpan = document.getElementById('wasm-name-span');
        this.dom.saveButton = document.getElementById('save-button');
        this.dom.loadIdInput = document.getElementById('load-id-input');
        this.dom.loadButton = document.getElementById('load-button');
        this.dom.statusMessageDiv = document.getElementById('status-message-div');

        // New UI elements
        this.dom.totalFramesInput = document.getElementById('total-frames-input');
        this.dom.setTotalFramesButton = document.getElementById('set-total-frames-button');
        this.dom.frameSlider = document.getElementById('frame-slider');
        this.dom.currentFrameDisplay = document.getElementById('current-frame-display');
        this.dom.maxFrameDisplay = document.getElementById('max-frame-display');
        
        this.dom.activeFeatureIdDisplay = document.getElementById('active-feature-id-display');
        this.dom.featureNameInput = document.getElementById('feature-name-input');
        this.dom.featureTypeSelect = document.getElementById('feature-type-select');
        this.dom.featureAppearanceFrameInput = document.getElementById('feature-appearance-frame-input');
        this.dom.featureDisappearanceFrameInput = document.getElementById('feature-disappearance-frame-input');
        this.dom.createFeatureButton = document.getElementById('create-feature-button');
        
        this.dom.pointIdInput = document.getElementById('point-id-input');
        this.dom.sphereClickCoordsDisplay = document.getElementById('sphere-click-coords');
        this.dom.addPointButton = document.getElementById('add-point-button');
        this.dom.addKeyframeButton = document.getElementById('add-keyframe-button');
    }

    bindUIEvents() {
        // Animation Name
        this.dom.animNameInput.addEventListener('input', (e) => {
            this.uiState.currentAnimationName = e.target.value;
            if (this.wasmManager && this.wasmManager.initialized) {
                this.wasmManager.setAnimationName(this.uiState.currentAnimationName);
                this.uiState.wasmAnimationName = this.wasmManager.getAnimationName();
                this.syncUIToState();
            }
        });

        // Total Frames
        this.dom.totalFramesInput.addEventListener('input', (e) => {
            this.uiState.totalFrames = parseInt(e.target.value, 10) || this.uiState.totalFrames;
        });
        this.dom.setTotalFramesButton.addEventListener('click', () => {
            if (this.wasmManager && this.wasmManager.initialized) {
                this.wasmManager.setTotalFrames(this.uiState.totalFrames);
                this.uiState.totalFrames = this.wasmManager.getTotalFrames(); // Get actual value from WASM
                this.dom.frameSlider.max = this.uiState.totalFrames;
                this.dom.featureDisappearanceFrameInput.value = this.uiState.totalFrames; // Sensible default
                this.syncUIToState();
                this.renderCurrentFrame();
            }
        });

        // Frame Slider (Timeline)
        this.dom.frameSlider.addEventListener('input', (e) => {
            this.uiState.currentFrame = parseInt(e.target.value, 10);
            this.syncUIToState();
            this.renderCurrentFrame();
        });

        // Feature Creation
        this.dom.featureNameInput.addEventListener('input', (e) => this.uiState.featureNameInput = e.target.value);
        this.dom.featureTypeSelect.addEventListener('change', (e) => this.uiState.featureTypeInput = parseInt(e.target.value, 10));
        this.dom.featureAppearanceFrameInput.addEventListener('input', (e) => this.uiState.featureAppearanceFrameInput = parseInt(e.target.value, 10));
        this.dom.featureDisappearanceFrameInput.addEventListener('input', (e) => this.uiState.featureDisappearanceFrameInput = parseInt(e.target.value, 10));
        
        this.dom.createFeatureButton.addEventListener('click', () => this.handleCreateFeature());

        // Point & Keyframe Addition
        this.dom.pointIdInput.addEventListener('input', (e) => this.uiState.pointIdInput = e.target.value);
        this.dom.addPointButton.addEventListener('click', () => this.handleAddPointToFeature());
        this.dom.addKeyframeButton.addEventListener('click', () => this.handleAddKeyframeToPoint());

        // Save/Load (existing)
        this.dom.saveButton.addEventListener('click', () => this.saveAnimationWithUIUpdate());
        this.dom.loadIdInput.addEventListener('input', (e) => this.uiState.animationIdToLoad = e.target.value);
        this.dom.loadButton.addEventListener('click', () => this.loadAnimationWithUIUpdate());
    }

    syncUIToState() {
        // Existing
        if (this.dom.animNameInput) this.dom.animNameInput.value = this.uiState.currentAnimationName;
        if (this.dom.wasmNameSpan) this.dom.wasmNameSpan.textContent = this.uiState.wasmAnimationName;
        if (this.dom.loadIdInput) this.dom.loadIdInput.value = this.uiState.animationIdToLoad;
        if (this.dom.statusMessageDiv) this.dom.statusMessageDiv.textContent = this.uiState.statusMessage;

        // New
        if (this.dom.totalFramesInput) this.dom.totalFramesInput.value = this.uiState.totalFrames;
        if (this.dom.frameSlider) {
            this.dom.frameSlider.value = this.uiState.currentFrame;
            this.dom.frameSlider.max = this.uiState.totalFrames;
        }
        if (this.dom.currentFrameDisplay) this.dom.currentFrameDisplay.textContent = this.uiState.currentFrame;
        if (this.dom.maxFrameDisplay) this.dom.maxFrameDisplay.textContent = this.uiState.totalFrames;
        
        if (this.dom.activeFeatureIdDisplay) this.dom.activeFeatureIdDisplay.textContent = this.uiState.activeFeatureId || 'None';
        if (this.dom.featureNameInput) this.dom.featureNameInput.value = this.uiState.featureNameInput;
        if (this.dom.featureTypeSelect) this.dom.featureTypeSelect.value = this.uiState.featureTypeInput;
        if (this.dom.featureAppearanceFrameInput) this.dom.featureAppearanceFrameInput.value = this.uiState.featureAppearanceFrameInput;
        if (this.dom.featureDisappearanceFrameInput) this.dom.featureDisappearanceFrameInput.value = this.uiState.featureDisappearanceFrameInput;
        if (this.dom.pointIdInput) this.dom.pointIdInput.value = this.uiState.pointIdInput;
        if (this.dom.sphereClickCoordsDisplay) this.dom.sphereClickCoordsDisplay.textContent = `(x: ${this.uiState.lastSphereClickCoords.x.toFixed(2)}, y: ${this.uiState.lastSphereClickCoords.y.toFixed(2)}, z: ${this.uiState.lastSphereClickCoords.z.toFixed(2)})`;
    }
    
    updateStatus(message) {
        this.uiState.statusMessage = message;
        this.syncUIToState();
    }

    async init() {
        if (this.initialized) return;
        console.log('Initializing Klyja application (Feature Edition)...');
        this.updateStatus('Initializing components...');
        this.cacheDOMElements();
        
        try {
            this.wasmManager = new WasmManager();
            await this.wasmManager.init();
            this.uiState.wasmAnimationName = this.wasmManager.getAnimationName();
            this.uiState.currentAnimationName = this.uiState.wasmAnimationName;
            this.uiState.totalFrames = this.wasmManager.getTotalFrames(); // Get initial total frames
            this.uiState.featureDisappearanceFrameInput = this.uiState.totalFrames; // Default

            this.syncUIToState(); // Sync once before binding events to set initial values
            this.bindUIEvents();   // Bind events after elements are cached and initial state synced

            this.apiClient = new ApiClient();
            this.viewer = new ThreeViewer('viewer-container', { sphereRadius: 1 });
            this.viewer.init();
            this.viewer.onSphereClick = (x, y, z) => this.handleSphereClick(x, y, z);
            
            this.renderCurrentFrame(); // Initial render at frame 0
            this.initialized = true;
            this.updateStatus('Application initialized successfully.');
            this.syncUIToState(); 

        } catch (error) {
            console.error('Error during KlyjaApp initialization:', error);
            this.updateStatus(`Initialization Error: ${error.message || 'Unknown error'}. Check console.`);
            this.initialized = false;
        }
    }

    // --- New Event Handlers ---
    handleCreateFeature() {
        if (!this.wasmManager || !this.wasmManager.initialized) {
            this.updateStatus('WASM not ready.'); return;
        }
        try {
            const name = this.uiState.featureNameInput;
            const typeVal = this.uiState.featureTypeInput;
            const appearance = this.uiState.featureAppearanceFrameInput;
            const disappearance = this.uiState.featureDisappearanceFrameInput;
            
            const featureId = this.wasmManager.createFeature(name, typeVal, appearance, disappearance);
            this.uiState.activeFeatureId = featureId; // Set as active
            this.updateStatus(`Created feature '${name}' (ID: ${featureId}). It is now active.`);
            this.syncUIToState();
            this.renderCurrentFrame();
        } catch (e) {
            this.updateStatus(`Error creating feature: ${e.message || e}`);
            console.error("Error creating feature:", e);
        }
    }

    handleAddPointToFeature() {
        if (!this.wasmManager || !this.wasmManager.initialized) {
            this.updateStatus('WASM not ready.'); return;
        }
        if (!this.uiState.activeFeatureId) {
            this.updateStatus('No active feature selected to add point to.'); return;
        }
        try {
            const pointId = this.uiState.pointIdInput; // Can be empty for auto-ID
            const frame = this.uiState.currentFrame;
            const { x, y, z } = this.uiState.lastSphereClickCoords;

            const newPointId = this.wasmManager.addPointToActiveFeature(pointId, frame, x, y, z);
            this.updateStatus(`Added point '${newPointId}' to feature '${this.uiState.activeFeatureId}' at frame ${frame}.`);
            if (!pointId) this.uiState.pointIdInput = newPointId; // Update UI if ID was generated
            this.syncUIToState();
            this.renderCurrentFrame();
        } catch (e) {
            this.updateStatus(`Error adding point: ${e.message || e}`);
            console.error("Error adding point:", e);
        }
    }

    handleAddKeyframeToPoint() {
        if (!this.wasmManager || !this.wasmManager.initialized) {
            this.updateStatus('WASM not ready.'); return;
        }
        if (!this.uiState.activeFeatureId) {
            this.updateStatus('No active feature selected.'); return;
        }
        if (!this.uiState.pointIdInput) {
            this.updateStatus('Please enter a Point ID to add a keyframe to.'); return;
        }
        try {
            const featureId = this.uiState.activeFeatureId;
            const pointId = this.uiState.pointIdInput;
            const frame = this.uiState.currentFrame;
            const { x, y, z } = this.uiState.lastSphereClickCoords;

            this.wasmManager.addPositionKeyframeToPoint(featureId, pointId, frame, x, y, z);
            this.updateStatus(`Added keyframe to point '${pointId}' in feature '${featureId}' at frame ${frame}.`);
            this.syncUIToState();
            this.renderCurrentFrame();
        } catch (e) {
            this.updateStatus(`Error adding keyframe: ${e.message || e}`);
            console.error("Error adding keyframe:", e);
        }
    }
    
    handleSphereClick(x, y, z) { // Now just updates coordinates
        this.uiState.lastSphereClickCoords = { x, y, z };
        this.syncUIToState(); // Update the displayed coordinates
        // console.log("Sphere clicked, coords stored:", this.uiState.lastSphereClickCoords);
    }

    renderCurrentFrame() { // Renamed from renderCurrentState
        if (!this.viewer || !this.wasmManager || !this.wasmManager.initialized) {
            console.error("Cannot render - components not ready");
            this.updateStatus('Cannot render: components not fully initialized.');
            return;
        }
        const frame = this.uiState.currentFrame;
        // console.log(`Requesting render for frame: ${frame}`);
        try {
            const featuresDataJson = this.wasmManager.getRenderableFeaturesJsonAtFrame(frame);
            const featuresData = JSON.parse(featuresDataJson);
            this.viewer.renderFeatures(featuresData); // Call new method in ThreeViewer
        } catch (e) {
            console.error("Error during renderCurrentFrame:", e);
            this.updateStatus(`Render error: ${e.message || e}`);
        }
    }

    async saveAnimationWithUIUpdate() {
        this.updateStatus('Saving animation...');
        if (!this.wasmManager || !this.wasmManager.initialized || !this.apiClient) {
            this.updateStatus('Cannot save: components not ready.');
            console.error('Attempted to save when components were not ready.');
            return; // Or throw an error
        }

        try {
            const currentNameInUI = this.dom.animNameInput.value;
            if (this.wasmManager.getAnimationName() !== currentNameInUI) {
                this.wasmManager.setAnimationName(currentNameInUI);
                this.uiState.currentAnimationName = currentNameInUI;
                this.uiState.wasmAnimationName = currentNameInUI; // Update UI state
            }
            const protobufData = this.wasmManager.getAnimationProtobuf();
            if (!protobufData || protobufData.length === 0) {
                this.updateStatus('Save failed: No animation data to save.');
                console.error('Save failed: protobufData is empty.');
                return;
            }

            const result = await this.apiClient.saveAnimation(protobufData);
            this.updateStatus(`Save successful! Animation ID: ${result.id}`);
            console.log('Save successful:', result);

            if (this.dom.loadIdInput) {
                this.dom.loadIdInput.value = result.id;
                this.uiState.animationIdToLoad = result.id.toString();
            }
            this.syncUIToState(); // Reflect potential changes in UI state
            return result;

        } catch (error) {
            this.updateStatus(`Save failed: ${error.message || 'Unknown error'}`);
            console.error('Save failed:', error);
            throw error; // Re-throw if you want calling code to handle it further
        }
    }

    async loadAnimationWithUIUpdate() { 
        // ... as before, but after load, make sure to sync totalFrames and currentFrame to UI
        // Example addition after successful load:
        // this.uiState.totalFrames = this.wasmManager.getTotalFrames();
        // this.uiState.currentFrame = 0; // Reset to first frame
        // this.syncUIToState();
        // this.renderCurrentFrame();

        // --- Existing loadAnimationWithUIUpdate code ---
        const idToLoad = this.uiState.animationIdToLoad;
        const numericId = parseInt(idToLoad);

        if (isNaN(numericId)) {
            this.updateStatus('Please enter a valid number ID to load.');
            return;
        }
        this.updateStatus(`Loading animation ID: ${numericId}...`);
        if (!this.wasmManager || !this.wasmManager.initialized || !this.apiClient) {
            this.updateStatus('Cannot load: components not ready.');
            return;
        }
        try {
            const protobufData = await this.apiClient.loadAnimation(numericId);
            this.wasmManager.loadAnimationProtobuf(protobufData);
            
            // Update state from loaded animation
            this.uiState.currentAnimationName = this.wasmManager.getAnimationName();
            this.uiState.wasmAnimationName = this.uiState.currentAnimationName;
            this.uiState.totalFrames = this.wasmManager.getTotalFrames();
            this.uiState.currentFrame = 0; // Reset to first frame on load
            // this.uiState.animationIdToLoad = ''; // Optional: Clear input after load
            
            this.syncUIToState(); // Refresh UI
            this.renderCurrentFrame(); // Render the newly loaded state at frame 0
            
            this.updateStatus(`Animation loaded: '${this.uiState.currentAnimationName}' (ID: ${numericId})`);
            console.log(`Animation loaded, name: ${this.uiState.currentAnimationName}`);
            return this.uiState.currentAnimationName;
        } catch (error) {
            this.updateStatus(`Load failed: ${error.message}`);
            console.error('Load failed:', error);
            throw error;
        }
    }
    dispose() {
        if (this.viewer) {
            this.viewer.dispose();
        }
    }
}

let klyjaApp = null;

// Define startApp as a constant before it's used in the if/else block below.
const startApp = async () => {
    console.log("startApp called"); // For debugging
    klyjaApp = new KlyjaApp();
    try {
        await klyjaApp.init();
    } catch (error) {
        // Log the error from init more explicitly if it happens here
        console.error("Error during klyjaApp.init():", error); 
        const statusDiv = document.getElementById('status-message-div');
        // Check if klyjaApp was even created before checking klyjaApp.initialized
        if (statusDiv && (!klyjaApp || !klyjaApp.initialized)) { 
            statusDiv.textContent = 'Critical error during application startup. Check console.';
        }
    }
};

// This is the entry point logic for your application.
if (document.readyState === 'loading') {
    // The DOM is not yet ready, so wait for the DOMContentLoaded event.
    document.addEventListener('DOMContentLoaded', () => {
        console.log("DOMContentLoaded event fired. Calling startApp...");
        startApp();
    });
} else {
    // The DOM is already loaded, so we can start the app immediately.
    console.log("DOM already loaded. Calling startApp directly...");
    startApp();
}

// Your export line (currently commented out) would go here if you needed to export klyjaApp
// export { klyjaApp };
