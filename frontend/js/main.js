import { ThreeViewer } from './three-viewer.js';
import { WasmManager } from './wasm-manager.js';
import { ApiClient } from './api-client.js';
// createAppState is no longer used directly for Alpine, but its structure can inspire KlyjaApp's state

export class KlyjaApp {
    constructor() {
        this.viewer = null;
        this.wasmManager = null;
        this.apiClient = null;
        this.initialized = false;

        // UI-related state, previously in appState
        this.uiState = {
            currentAnimationName: 'Untitled Animation',
            wasmAnimationName: 'Loading...',
            newPolygonId: 'poly1',
            animationIdToLoad: '',
            statusMessage: 'App Loaded.',
        };

        // DOM element references
        this.dom = {};
    }

    cacheDOMElements() {
        this.dom.animNameInput = document.getElementById('anim-name-input');
        this.dom.wasmNameSpan = document.getElementById('wasm-name-span');
        this.dom.polyIdInput = document.getElementById('poly-id-input');
        this.dom.addPolyButton = document.getElementById('add-poly-button');
        this.dom.saveButton = document.getElementById('save-button');
        this.dom.loadIdInput = document.getElementById('load-id-input');
        this.dom.loadButton = document.getElementById('load-button');
        this.dom.statusMessageDiv = document.getElementById('status-message-div');
    }

    bindUIEvents() {
        this.dom.animNameInput.addEventListener('input', (e) => {
            this.uiState.currentAnimationName = e.target.value;
            this.updateWasmName(e.target.value);
        });

        this.dom.polyIdInput.addEventListener('input', (e) => {
            this.uiState.newPolygonId = e.target.value;
        });

        this.dom.addPolyButton.addEventListener('click', () => this.addPolygonPlaceholder());
        this.dom.saveButton.addEventListener('click', () => this.saveAnimationWithUIUpdate());
        
        this.dom.loadIdInput.addEventListener('input', (e) => {
            this.uiState.animationIdToLoad = e.target.value;
        });
        this.dom.loadButton.addEventListener('click', () => this.loadAnimationWithUIUpdate());
    }

    syncUIToState() {
        if (this.dom.animNameInput) this.dom.animNameInput.value = this.uiState.currentAnimationName;
        if (this.dom.wasmNameSpan) this.dom.wasmNameSpan.textContent = this.uiState.wasmAnimationName;
        if (this.dom.polyIdInput) this.dom.polyIdInput.value = this.uiState.newPolygonId;
        if (this.dom.loadIdInput) this.dom.loadIdInput.value = this.uiState.animationIdToLoad;
        if (this.dom.statusMessageDiv) this.dom.statusMessageDiv.textContent = this.uiState.statusMessage;
    }

    updateStatus(message) {
        this.uiState.statusMessage = message;
        this.syncUIToState();
    }

    async init() {
        if (this.initialized) return;
        console.log('Initializing Klyja application (Vanilla JS)...');
        this.updateStatus('Initializing components...');

        this.cacheDOMElements(); // Get references to DOM elements
        this.syncUIToState();   // Set initial values from state
        this.bindUIEvents();   // Add event listeners

        try {
            this.wasmManager = new WasmManager();
            await this.wasmManager.init();
            this.uiState.wasmAnimationName = this.wasmManager.getAnimationName();
            this.uiState.currentAnimationName = this.uiState.wasmAnimationName; // Sync names
            this.updateStatus('WASM Ready.');

            this.apiClient = new ApiClient();

            this.viewer = new ThreeViewer('viewer-container', { sphereRadius: 5 });
            this.viewer.init();
            this.viewer.onSphereClick = (x, y, z) => this.handleSphereClick(x, y, z);
            
            this.renderCurrentState();
            this.initialized = true;
            this.updateStatus('Application initialized successfully.');
            this.syncUIToState(); // Final sync after init

        } catch (error) {
            console.error("Failed to initialize the application:", error);
            this.updateStatus(`Initialization Error: ${error.message}`);
            throw error;
        }
    }

    updateWasmName(newName) {
        if (this.wasmManager && this.wasmManager.initialized) {
            try {
                this.wasmManager.setAnimationName(newName);
                this.uiState.wasmAnimationName = this.wasmManager.getAnimationName();
                this.updateStatus(`Set WASM name to ${this.uiState.wasmAnimationName}`);
            } catch (e) {
                this.updateStatus(`Error setting WASM name: ${e.message}`);
            }
        } else {
            this.updateStatus('Error: WASM not ready to update name.');
        }
        this.syncUIToState();
    }

    addPolygonPlaceholder() {
        if (this.wasmManager && this.wasmManager.initialized && this.uiState.newPolygonId) {
            try {
                this.wasmManager.addStaticPolygon(this.uiState.newPolygonId, 0.0, 5.0); // Example coords
                this.updateStatus(`Added polygon ${this.uiState.newPolygonId}. Click sphere to add points.`);
                this.renderCurrentState();

                const match = this.uiState.newPolygonId.match(/^poly(\d+)$/);
                if (match) {
                    const nextId = parseInt(match[1]) + 1;
                    this.uiState.newPolygonId = `poly${nextId}`;
                }
            } catch (e) {
                 this.updateStatus(`Error adding polygon: ${e.message}`);
            }
        } else {
            this.updateStatus('Error: WASM not ready or missing polygon ID.');
        }
        this.syncUIToState();
    }

    handleSphereClick(x, y, z) {
        console.log("Sphere clicked at:", x, y, z);
        if (this.wasmManager && this.wasmManager.initialized) {
            try {
                this.wasmManager.addPointToActivePolygon(x, y, z);
                this.renderCurrentState();
                this.updateStatus('Point added to active polygon.');
            } catch (e) {
                console.error("Error adding point:", e);
                this.updateStatus(`Error adding point: ${e.message}`);
            }
        } else {
            this.updateStatus('WASM not ready to add point.');
        }
    }

    renderCurrentState() {
        if (!this.viewer || !this.wasmManager || !this.wasmManager.initialized) {
            console.error("Cannot render - components not ready");
            this.updateStatus('Cannot render: components not fully initialized.');
            return;
        }
        console.log("Rendering current WASM state...");
        const polygonsData = this.wasmManager.getPolygonsData();
        this.viewer.renderPolygons(polygonsData);
    }

    async saveAnimationWithUIUpdate() {
        this.updateStatus("Saving animation...");
        if (!this.wasmManager || !this.wasmManager.initialized || !this.apiClient) {
            this.updateStatus('Cannot save: components not ready.');
            return;
        }
        try {
            const protobufData = this.wasmManager.getAnimationProtobuf();
            const result = await this.apiClient.saveAnimation(protobufData);
            this.updateStatus(`Save successful! ID: ${result.id}`);
            console.log('Save successful:', result);
            return result;
        } catch (error) {
            this.updateStatus(`Save failed: ${error.message}`);
            console.error('Save failed:', error);
            throw error;
        }
    }

    async loadAnimationWithUIUpdate() {
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
            this.renderCurrentState();
            
            this.uiState.currentAnimationName = this.wasmManager.getAnimationName();
            this.uiState.wasmAnimationName = this.uiState.currentAnimationName;
            // this.uiState.animationIdToLoad = ''; // Clear input after load
            this.updateStatus(`Animation loaded: '${this.uiState.currentAnimationName}' (ID: ${numericId})`);
            this.syncUIToState(); // Refresh UI with new name and cleared load ID
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
        // Remove event listeners if any were added to window or document directly
    }
}

// Create and initialize the app
let klyjaApp = null;

async function startApp() {
    klyjaApp = new KlyjaApp();
    try {
        await klyjaApp.init();
    } catch (error) {
        // Error is already logged and status updated by klyjaApp.init()
        const statusDiv = document.getElementById('status-message-div');
        if (statusDiv && !klyjaApp.initialized) { // Check if a more specific message was already set
            statusDiv.textContent = 'Critical error during application startup. Check console.';
        }
    }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}

// Export for testing or debugging if needed
export { klyjaApp };
