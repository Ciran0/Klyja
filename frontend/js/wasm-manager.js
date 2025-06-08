// frontend/js/wasm-manager.js
const loadWasm = async () => {
  return import('/pkg/geco.js');
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
      this.wasmModule = await loadWasm();
      const { default: init, Geco } = this.wasmModule;
      await init();
      this.gecoInstance = new Geco();
      this.initialized = true;
      console.log('WASM module initialized (Feature Edition). Animation Name:', this.gecoInstance.get_animation_name());
    } catch (error) {
      console.error('Failed to initialize WASM:', error);
      throw error;
    }
  }

  ensureInitialized() {
    if (!this.initialized || !this.gecoInstance) {
      throw new Error('WASM Manager not initialized');
    }
  }

  // --- Animation Global Settings ---
  getAnimationName() {
    this.ensureInitialized();
    return this.gecoInstance.get_animation_name();
  }

  setAnimationName(name) {
    this.ensureInitialized();
    this.gecoInstance.set_animation_name(name);
  }

  getTotalFrames() {
    this.ensureInitialized();
    return this.gecoInstance.get_total_frames();
  }

  setTotalFrames(totalFrames) {
    this.ensureInitialized();
    this.gecoInstance.set_total_frames(totalFrames);
  }

  // --- Feature and Point Management ---
  createFeature(name, featureTypeVal, appearanceFrame, disappearanceFrame) {
    this.ensureInitialized();
    // featureTypeVal: 1 for Polygon, 2 for Polyline (as defined in your Geco::create_feature)
    try {
      return this.gecoInstance.create_feature(name, featureTypeVal, appearanceFrame, disappearanceFrame);
    } catch (e) {
      console.error("Error creating feature:", e);
      throw e; // Re-throw or handle as appropriate
    }
  }

  addPointToActiveFeature(pointIdStr, initialFrame, x, y, z) {
    this.ensureInitialized();
    // z can be null or a number for optional float
    const zValue = (z === undefined || z === null) ? null : z;
    try {
      return this.gecoInstance.add_point_to_active_feature(pointIdStr, initialFrame, x, y, zValue);
    } catch (e) {
      console.error("Error adding point to active feature:", e);
      throw e;
    }
  }

  addPositionKeyframeToPoint(featureId, pointId, frame, x, y, z) {
    this.ensureInitialized();
    const zValue = (z === undefined || z === null) ? null : z;
    try {
      this.gecoInstance.add_position_keyframe_to_point(featureId, pointId, frame, x, y, zValue);
    } catch (e) {
      console.error("Error adding position keyframe:", e);
      throw e;
    }
  }

  // --- Data Retrieval ---
  getRenderableFeaturesJsonAtFrame(frameNumber) {
    this.ensureInitialized();
    return this.gecoInstance.get_renderable_features_json_at_frame(frameNumber);
  }

  getRenderableLineSegmentsAtFrame(frameNumber) {
    this.ensureInitialized();
    try {
        // This returns a JsValue which will be automatically converted to a JS object
        return this.gecoInstance.getRenderableLineSegmentsAtFrame(frameNumber);
    } catch (e) {
        console.error("Error getting line segment data:", e);
        // Return a default empty state on error
        return { vertex_data: [], segment_count: 0 };
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
}
