// frontend/js/main.js
import { ThreeViewer } from './three-viewer.js';
import { WasmManager } from './wasm-manager.js';
import { ApiClient } from './api-client.js';
import { createAppState } from './app-state.js';

export class KlyjaApp {
  constructor() {
    this.viewer = null;
    this.wasmManager = null;
    this.apiClient = null;
    this.appState = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    
    console.log('Initializing Klyja application...');
    
    try {
      // Initialize modules
      this.wasmManager = new WasmManager();
      await this.wasmManager.init();
      
      this.apiClient = new ApiClient();
      
      this.viewer = new ThreeViewer('viewer-container', { sphereRadius: 5 });
      this.viewer.init();
      
      // Set up viewer click handler
      this.viewer.onSphereClick = (x, y, z) => this.handleSphereClick(x, y, z);
      
      // Create app state for Alpine
      this.appState = createAppState();
      
      // Set up dependencies for Alpine state
      this.appState.initWithDeps({
        gecoInstance: this.wasmManager.gecoInstance,
        saveWasmData: () => this.saveAnimation(),
        loadWasmData: (id) => this.loadAnimation(id),
        renderWasmState: () => this.renderCurrentState()
      });
      
      // Initial render
      this.renderCurrentState();
      
      // Make functions globally available for Alpine
      window.gecoInstance = this.wasmManager.gecoInstance;
      window.saveWasmData = () => this.saveAnimation();
      window.loadWasmData = (id) => this.loadAnimation(id);
      window.renderWasmState = () => this.renderCurrentState();
      
      this.initialized = true;
      console.log('Application initialized successfully.');
      
    } catch (error) {
      console.error("Failed to initialize the application:", error);
      throw error;
    }
  }

  handleSphereClick(x, y, z) {
    console.log("Sphere clicked at:", x, y, z);
    
    try {
      this.wasmManager.addPointToActivePolygon(x, y, z);
      this.renderCurrentState();
    } catch (e) {
      console.error("Error adding point:", e);
    }
  }

  renderCurrentState() {
    if (!this.viewer || !this.wasmManager) {
      console.error("Cannot render - components not ready");
      return;
    }
    
    console.log("Rendering current WASM state...");
    const polygonsData = this.wasmManager.getPolygonsData();
    this.viewer.renderPolygons(polygonsData);
  }

  async saveAnimation() {
    console.log("Saving animation...");
    
    try {
      const protobufData = this.wasmManager.getAnimationProtobuf();
      const result = await this.apiClient.saveAnimation(protobufData);
      console.log('Save successful:', result);
      return result;
    } catch (error) {
      console.error('Save failed:', error);
      throw error;
    }
  }

  async loadAnimation(id) {
    console.log(`Loading animation ${id}...`);
    
    try {
      // Load from backend
      const protobufData = await this.apiClient.loadAnimation(id);
      
      // Load into WASM
      this.wasmManager.loadAnimationProtobuf(protobufData);
      
      // Render
      this.renderCurrentState();
      
      // Return the new name
      const newName = this.wasmManager.getAnimationName();
      console.log(`Animation loaded, name: ${newName}`);
      return newName;
      
    } catch (error) {
      console.error('Load failed:', error);
      throw error;
    }
  }

  dispose() {
    if (this.viewer) {
      this.viewer.dispose();
    }
    // Clean up other resources as needed
  }
}

// Create and initialize the app
let app = null;

async function startApp() {
  app = new KlyjaApp();
  
  // Make app state available for Alpine
  window.appState = app.appState;
  
  try {
    await app.init();
  } catch (error) {
    console.error('Failed to start app:', error);
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

// Export for testing
export { app };
