import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WasmManager } from '../js/wasm-manager.js';

// Mock the dynamic import of the WASM module
vi.mock('/pkg/geco.js', () => {
  const mockGecoInstance = {
    get_animation_name: vi.fn().mockReturnValue('Default Mock Animation'),
    set_animation_name: vi.fn(),
    get_total_frames: vi.fn().mockReturnValue(100),
    set_total_frames: vi.fn(),
    create_feature: vi.fn().mockReturnValue('feature-uuid-123'),
    add_point_to_active_feature: vi.fn().mockReturnValue('point-uuid-456'),
    add_position_keyframe_to_point: vi.fn(),
    get_renderable_features_json_at_frame: vi.fn().mockReturnValue('[]'),
    get_animation_protobuf: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
    load_animation_protobuf: vi.fn(),
  };
  return {
    default: vi.fn().mockResolvedValue({}), // Mock for the init function from wasmModule
    Geco: vi.fn(() => mockGecoInstance), // Mock for the Geco class constructor
  };
});

// Get a direct reference to the mocked Geco class constructor and its methods for assertions
const { Geco: MockGecoConstructor, default: mockWasmInitFn } = await import('/pkg/geco.js');
// Get the single instance that will be created by the mocked constructor
const mockGecoInstance = MockGecoConstructor();


describe('WasmManager', () => {
  let manager;

  beforeEach(async () => {
    vi.clearAllMocks(); // Clear mocks before each test
    manager = new WasmManager();
    // Note: init is called in tests that require an initialized state
  });

  describe('initialization', () => {
    it('should start uninitialized', () => {
      expect(manager.initialized).toBe(false);
      expect(manager.gecoInstance).toBe(null);
    });

    it('should initialize WASM module and Geco instance', async () => {
      await manager.init();
      expect(mockWasmInitFn).toHaveBeenCalled();
      expect(MockGecoConstructor).toHaveBeenCalled();
      expect(manager.initialized).toBe(true);
      expect(manager.gecoInstance).toBe(mockGecoInstance);
      expect(mockGecoInstance.get_animation_name).toHaveBeenCalled(); // init logs this
    });

    it('should not initialize twice', async () => {
      await manager.init();
      await manager.init();
      expect(mockWasmInitFn).toHaveBeenCalledTimes(1);
      expect(MockGecoConstructor).toHaveBeenCalledTimes(1);
    });

    it('should throw if WASM init fails', async () => {
      mockWasmInitFn.mockRejectedValueOnce(new Error('WASM init fail'));
      await expect(manager.init()).rejects.toThrow('WASM init fail');
      expect(manager.initialized).toBe(false);
    });
  });

  describe('methods requiring initialization', () => {
    beforeEach(async () => {
      await manager.init(); // Ensure manager is initialized
    });

    // Animation Global Settings
    it('getAnimationName should call gecoInstance', () => {
      manager.getAnimationName();
      expect(mockGecoInstance.get_animation_name).toHaveBeenCalled();
    });

    it('setAnimationName should call gecoInstance', () => {
      manager.setAnimationName('New Name');
      expect(mockGecoInstance.set_animation_name).toHaveBeenCalledWith('New Name');
    });

    it('getTotalFrames should call gecoInstance', () => {
      manager.getTotalFrames();
      expect(mockGecoInstance.get_total_frames).toHaveBeenCalled();
    });

    it('setTotalFrames should call gecoInstance', () => {
      manager.setTotalFrames(150);
      expect(mockGecoInstance.set_total_frames).toHaveBeenCalledWith(150);
    });

    // Feature and Point Management
    it('createFeature should call gecoInstance', () => {
      const result = manager.createFeature('MyPoly', 1, 0, 100);
      expect(mockGecoInstance.create_feature).toHaveBeenCalledWith('MyPoly', 1, 0, 100);
      expect(result).toBe('feature-uuid-123');
    });
    
    it('createFeature should re-throw errors from gecoInstance', () => {
      const error = new Error("Geco create_feature error");
      mockGecoInstance.create_feature.mockImplementationOnce(() => { throw error; });
      expect(() => manager.createFeature('FailPoly', 1, 0, 100)).toThrow(error);
    });

    it('addPointToActiveFeature should call gecoInstance', () => {
      const result = manager.addPointToActiveFeature('p1', 0, 1, 2, 3);
      expect(mockGecoInstance.add_point_to_active_feature).toHaveBeenCalledWith('p1', 0, 1, 2, 3);
      expect(result).toBe('point-uuid-456');
    });
    
     it('addPointToActiveFeature should handle null z', () => {
      manager.addPointToActiveFeature('p2', 5, 4, 5, null);
      expect(mockGecoInstance.add_point_to_active_feature).toHaveBeenCalledWith('p2', 5, 4, 5, null);
    });

    it('addPositionKeyframeToPoint should call gecoInstance', () => {
      manager.addPositionKeyframeToPoint('f1', 'p1', 10, 4, 5, 6);
      expect(mockGecoInstance.add_position_keyframe_to_point).toHaveBeenCalledWith('f1', 'p1', 10, 4, 5, 6);
    });

    // Data Retrieval
    it('getRenderableFeaturesJsonAtFrame should call gecoInstance', () => {
      const result = manager.getRenderableFeaturesJsonAtFrame(10);
      expect(mockGecoInstance.get_renderable_features_json_at_frame).toHaveBeenCalledWith(10);
      expect(result).toBe('[]');
    });

    it('getAnimationProtobuf should call gecoInstance', () => {
      const result = manager.getAnimationProtobuf();
      expect(mockGecoInstance.get_animation_protobuf).toHaveBeenCalled();
      expect(result).toEqual(new Uint8Array([1, 2, 3]));
    });

    it('loadAnimationProtobuf should call gecoInstance', () => {
      const data = new Uint8Array([4, 5, 6]);
      manager.loadAnimationProtobuf(data);
      expect(mockGecoInstance.load_animation_protobuf).toHaveBeenCalledWith(data);
    });
  });

  describe('ensureInitialized error handling', () => {
    it('should throw error if methods are called before init', () => {
      const uninitializedManager = new WasmManager();
      expect(() => uninitializedManager.getAnimationName()).toThrow('WASM Manager not initialized');
      expect(() => uninitializedManager.setAnimationName('test')).toThrow('WASM Manager not initialized');
      expect(() => uninitializedManager.getTotalFrames()).toThrow('WASM Manager not initialized');
      expect(() => uninitializedManager.setTotalFrames(10)).toThrow('WASM Manager not initialized');
      expect(() => uninitializedManager.createFeature('f',1,0,1)).toThrow('WASM Manager not initialized');
      expect(() => uninitializedManager.addPointToActiveFeature('p',0,0,0,0)).toThrow('WASM Manager not initialized');
      expect(() => uninitializedManager.addPositionKeyframeToPoint('f','p',0,0,0,0)).toThrow('WASM Manager not initialized');
      expect(() => uninitializedManager.getRenderableFeaturesJsonAtFrame(0)).toThrow('WASM Manager not initialized');
      expect(() => uninitializedManager.getAnimationProtobuf()).toThrow('WASM Manager not initialized');
      expect(() => uninitializedManager.loadAnimationProtobuf(new Uint8Array())).toThrow('WASM Manager not initialized');
    });
  });
});
