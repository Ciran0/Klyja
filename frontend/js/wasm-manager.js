// frontend/js/wasm-manager.js
// Use dynamic import for better test compatibility
const loadWasm = async () => {
  if (typeof window !== 'undefined' && window.location.protocol !== 'file:') {
    // Browser environment - use absolute path
    return import('geco/pkg/geco.js');
  } else {
    // Test environment - this will be mocked
    return import('../../geco/pkg/geco.js');
  }
};

export class WasmManager {
  constructor() {
    this.gecoInstance = null;
    this.initialized = false;
    this.wasmModule = null;
  }

  async init() {
    if (this.initialized) return;
    
    try {
      // Load WASM module dynamically
      this.wasmModule = await loadWasm();
      const { default: init, Geco } = this.wasmModule;
      
      await init();
      this.gecoInstance = new Geco();
      this.initialized = true;
      console.log('WASM module initialized. Animation Name:', this.gecoInstance.get_animation_name());
    } catch (error) {
      console.error('Failed to initialize WASM:', error);
      throw error;
    }
  }

  getAnimationName() {
    this.ensureInitialized();
    return this.gecoInstance.get_animation_name();
  }

  setAnimationName(name) {
    this.ensureInitialized();
    this.gecoInstance.set_animation_name(name);
  }

  addStaticPolygon(polygonId, x, y) {
    this.ensureInitialized();
    this.gecoInstance.add_static_polygon(polygonId, x, y);
  }

  addPointToActivePolygon(x, y, z) {
    this.ensureInitialized();
    this.gecoInstance.add_point_to_active_polygon(x, y, z);
  }

  getPolygonsData() {
    this.ensureInitialized();
    const json = this.gecoInstance.get_polygons_json();
    try {
      return JSON.parse(json);
    } catch (e) {
      console.error('Failed to parse polygons JSON:', e);
      return [];
    }
  }

  getAnimationProtobuf() {
    this.ensureInitialized();
    return this.gecoInstance.get_animation_protobuf();
  }

  loadAnimationProtobuf(data) {
    this.ensureInitialized();
    this.gecoInstance.load_animation_protobuf(data);
  }

  ensureInitialized() {
    if (!this.initialized || !this.gecoInstance) {
      throw new Error('WASM Manager not initialized');
    }
  }
}
