// frontend/js/app-state.js
// Extracted Alpine.js state for better testability

export function createAppState() {
  return {
    currentAnimationName: 'Untitled',
    wasmAnimationName: 'Loading...',
    newPolygonId: 'poly1',
    animationIdToLoad: '',
    statusMessage: 'App Loaded.',
    
    // Store references to external dependencies
    _deps: {
      gecoInstance: null,
      saveWasmData: null,
      loadWasmData: null,
      renderWasmState: null
    },

    // Initialize with dependencies
    initWithDeps(deps) {
      this._deps = { ...this._deps, ...deps };
    },

    async init() {
      console.log("Alpine init() called.");
      this.statusMessage = 'Alpine Initialized. Waiting for WASM...';
      
      try {
        // Wait for WASM with timeout
        await this.waitForWasm(5000);
        
        if (this._deps.gecoInstance) {
          this.wasmAnimationName = this._deps.gecoInstance.get_animation_name();
          this.currentAnimationName = this.wasmAnimationName;
          this.statusMessage = 'Ready.';
        }
      } catch (error) {
        this.statusMessage = `Error: ${error.message}`;
        console.error("WASM initialization error:", error);
      }
    },

    async waitForWasm(timeout = 5000) {
      const startTime = Date.now();
      
      while (!this._deps.gecoInstance && (Date.now() - startTime < timeout)) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (!this._deps.gecoInstance) {
        throw new Error('WASM failed to initialize in time');
      }
    },

    updateWasmName(newName) {
      if (this._deps.gecoInstance) {
        this._deps.gecoInstance.set_animation_name(newName);
        this.wasmAnimationName = this._deps.gecoInstance.get_animation_name();
        this.statusMessage = `Set WASM name to ${this.wasmAnimationName}`;
      } else {
        this.statusMessage = 'Error: Geco instance not ready.';
      }
    },

    addPolygonPlaceholder() {
      if (this._deps.gecoInstance && this.newPolygonId) {
        this._deps.gecoInstance.add_static_polygon(this.newPolygonId, 0.0, 5.0);
        this.statusMessage = `Added polygon ${this.newPolygonId}. Click sphere to add points.`;
        
        if (this._deps.renderWasmState) {
          this._deps.renderWasmState();
        }
        
        // Increment polygon ID
        const match = this.newPolygonId.match(/^poly(\d+)$/);
        if (match) {
          const nextId = parseInt(match[1]) + 1;
          this.newPolygonId = `poly${nextId}`;
        }
      } else {
        this.statusMessage = 'Error: Geco instance not ready or missing polygon ID.';
      }
    },

    async saveAnimation() {
      this.statusMessage = 'Saving...';
      
      if (this._deps.saveWasmData) {
        try {
          await this._deps.saveWasmData();
          this.statusMessage = 'Save successful!';
        } catch (err) {
          this.statusMessage = `Save failed: ${err.message}`;
        }
      } else {
        this.statusMessage = 'Error: Save function not ready.';
      }
    },

    async loadAnimation() {
      const id = parseInt(this.animationIdToLoad);
      
      if (isNaN(id)) {
        this.statusMessage = 'Please enter a valid number ID to load.';
        return;
      }
      
      this.statusMessage = `Loading animation ID: ${id}...`;

      if (this._deps.loadWasmData) {
        try {
          const newAnimationName = await this._deps.loadWasmData(id);
          this.wasmAnimationName = newAnimationName;
          this.currentAnimationName = newAnimationName;
          this.statusMessage = `Load successful! (ID: ${id}, Name: '${this.wasmAnimationName}')`;
          console.log(`Alpine UI updated with new name: ${this.wasmAnimationName}`);
        } catch (err) {
          this.statusMessage = `Load failed: ${err.message}`;
          console.error("Error in loadAnimation (Alpine handler):", err);
        }
      } else {
        this.statusMessage = 'Error: Load function (loadWasmData) is not ready.';
        console.error('loadWasmData is not defined.');
      }
    }
  };
}
