import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WasmManager } from '../js/wasm-manager.js';

// This import will be aliased by Vite to '/tests/mocks/geco-mock.js'.
// We get direct handles to the vi.fn() instances created in geco-mock.js.
import mockWasmInitFn, { Geco as MockGecoCls } from 'geco/pkg/geco.js';

describe('WasmManager', () => {
  let manager;
  let testSpecificGecoInstance;

  beforeEach(() => {
    // Reset mocks for each test to ensure clean state
    vi.clearAllMocks(); // Clears call counts, etc.

    // This is the instance we want our Geco mock to return for most tests.
    // It contains its own set of vi.fn() spies for its methods.
    testSpecificGecoInstance = {
      get_animation_name: vi.fn().mockReturnValue('Test Animation'),
      set_animation_name: vi.fn(),
      add_static_polygon: vi.fn(),
      add_point_to_active_polygon: vi.fn(),
      get_polygons_json: vi.fn().mockReturnValue('[]'),
      // Per your test error: "expected Uint8Array[ 1, 2, 3, 4 ] to deeply equal Uint8Array[ 1, 2, 3 ]"
      // This means the actual return was [1,2,3,4] (from geco-mock.js)
      // but testSpecificGecoInstance was providing [1,2,3].
      // Let's align this: if geco-mock.js provides the base mock, we'll use that structure.
      // OR, we ensure *this* instance is always returned.
      get_animation_protobuf: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])), // For this test suite's default
      load_animation_protobuf: vi.fn()
    };

    // Configure the imported mock Geco class to return our test-specific instance
    MockGecoCls.mockImplementation(() => testSpecificGecoInstance);

    // Configure the imported mock init function for default success
    mockWasmInitFn.mockResolvedValue({});

    manager = new WasmManager();
  });

  afterEach(() => {
    // Optional: restore mocks if they were changed with mockImplementationOnce etc.
    // and you want them back to their original state from geco-mock.js for other test files.
    // For this file, clearAllMocks in beforeEach is usually enough.
  });

  describe('initialization', () => {
    it('should start uninitialized', () => {
      expect(manager.initialized).toBe(false);
      expect(manager.gecoInstance).toBe(null);
    });

    it('should initialize WASM module', async () => {
      await manager.init();

      expect(mockWasmInitFn).toHaveBeenCalled();
      expect(MockGecoCls).toHaveBeenCalled();
      expect(manager.initialized).toBe(true);
      expect(manager.gecoInstance).toBe(testSpecificGecoInstance);
    });

    it('should not initialize twice', async () => {
      await manager.init(); // First call
      await manager.init(); // Second call

      expect(mockWasmInitFn).toHaveBeenCalledTimes(1);
      expect(MockGecoCls).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors when init function rejects', async () => {
      const error = new Error('WASM init failed');
      mockWasmInitFn.mockRejectedValueOnce(error); // Configure the init mock to reject

      await expect(manager.init()).rejects.toThrow('WASM init failed');
      expect(manager.initialized).toBe(false);
    });

    it('should handle initialization errors when Geco constructor throws', async () => {
        const error = new Error('Geco constructor failed');
        MockGecoCls.mockImplementationOnce(() => { throw error; });

        await expect(manager.init()).rejects.toThrow('Geco constructor failed');
        expect(manager.initialized).toBe(false);
    });
  });

  describe('methods requiring initialization', () => {
    beforeEach(async () => {
      // Ensure manager is successfully initialized for these tests
      await manager.init();
    });

    it('should get animation name', () => {
      const name = manager.getAnimationName();
      expect(name).toBe('Test Animation');
      expect(testSpecificGecoInstance.get_animation_name).toHaveBeenCalled();
    });

    it('should set animation name', () => {
      manager.setAnimationName('New Name');
      expect(testSpecificGecoInstance.set_animation_name).toHaveBeenCalledWith('New Name');
    });

    it('should add static polygon', () => {
      manager.addStaticPolygon('poly1', 1.0, 2.0);
      expect(testSpecificGecoInstance.add_static_polygon).toHaveBeenCalledWith('poly1', 1.0, 2.0);
    });

    it('should add point to active polygon', () => {
      manager.addPointToActivePolygon(1.0, 2.0, 3.0);
      expect(testSpecificGecoInstance.add_point_to_active_polygon).toHaveBeenCalledWith(1.0, 2.0, 3.0);
    });

    it('should get polygons data', () => {
      testSpecificGecoInstance.get_polygons_json.mockReturnValue('[{"id": "test"}]');
      const data = manager.getPolygonsData();
      expect(data).toEqual([{ id: 'test' }]);
    });

    it('should handle invalid JSON gracefully', () => {
      testSpecificGecoInstance.get_polygons_json.mockReturnValue('invalid json');
      const data = manager.getPolygonsData();
      expect(data).toEqual([]);
    });

    it('should get animation protobuf', () => {
      // testSpecificGecoInstance.get_animation_protobuf returns [1,2,3] by default in this setup
      const data = manager.getAnimationProtobuf();
      expect(data).toEqual(new Uint8Array([1, 2, 3]));
      expect(testSpecificGecoInstance.get_animation_protobuf).toHaveBeenCalled();
    });

    it('should load animation protobuf', () => {
      const data = new Uint8Array([4, 5, 6]);
      manager.loadAnimationProtobuf(data);
      expect(testSpecificGecoInstance.load_animation_protobuf).toHaveBeenCalledWith(data);
    });
  });

  describe('error handling', () => {
    it('should throw error when calling methods before initialization', () => {
      // Manager is new and not initialized here
      expect(() => manager.getAnimationName()).toThrow('WASM Manager not initialized');
      // ... (add other method checks as needed) ...
      expect(() => manager.getPolygonsData()).toThrow('WASM Manager not initialized');
    });
  });
});
