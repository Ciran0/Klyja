// frontend/tests/wasm-manager.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WasmManager } from '../js/wasm-manager.js';

// The WASM module is mocked in setup.js

describe('WasmManager', () => {
  let manager;
  let mockGecoInstance;
  let mockInit;
  let mockGeco;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGecoInstance = {
      get_animation_name: vi.fn().mockReturnValue('Test Animation'),
      set_animation_name: vi.fn(),
      add_static_polygon: vi.fn(),
      add_point_to_active_polygon: vi.fn(),
      get_polygons_json: vi.fn().mockReturnValue('[]'),
      get_animation_protobuf: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
      load_animation_protobuf: vi.fn()
    };

    mockInit = vi.fn().mockResolvedValue({});
    mockGeco = vi.fn().mockImplementation(() => mockGecoInstance);
    
    // Override the loadWasm function to return our mocks
    vi.stubGlobal('loadWasm', vi.fn().mockResolvedValue({
      default: mockInit,
      Geco: mockGeco
    }));
    
    manager = new WasmManager();
  });

  describe('initialization', () => {
    it('should start uninitialized', () => {
      expect(manager.initialized).toBe(false);
      expect(manager.gecoInstance).toBe(null);
    });

    it('should initialize WASM module', async () => {
      await manager.init();

      expect(mockInit).toHaveBeenCalled();
      expect(mockGeco).toHaveBeenCalled();
      expect(manager.initialized).toBe(true);
      expect(manager.gecoInstance).toBe(mockGecoInstance);
    });

    it('should not initialize twice', async () => {
      await manager.init();
      await manager.init();

      expect(mockInit).toHaveBeenCalledTimes(1);
      expect(mockGeco).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors', async () => {
      const error = new Error('WASM init failed');
      mockInit.mockRejectedValue(error);

      await expect(manager.init()).rejects.toThrow('WASM init failed');
      expect(manager.initialized).toBe(false);
    });
  });

  describe('methods requiring initialization', () => {
    beforeEach(async () => {
      await manager.init();
    });

    it('should get animation name', () => {
      const name = manager.getAnimationName();
      expect(name).toBe('Test Animation');
      expect(mockGecoInstance.get_animation_name).toHaveBeenCalled();
    });

    it('should set animation name', () => {
      manager.setAnimationName('New Name');
      expect(mockGecoInstance.set_animation_name).toHaveBeenCalledWith('New Name');
    });

    it('should add static polygon', () => {
      manager.addStaticPolygon('poly1', 1.0, 2.0);
      expect(mockGecoInstance.add_static_polygon).toHaveBeenCalledWith('poly1', 1.0, 2.0);
    });

    it('should add point to active polygon', () => {
      manager.addPointToActivePolygon(1.0, 2.0, 3.0);
      expect(mockGecoInstance.add_point_to_active_polygon).toHaveBeenCalledWith(1.0, 2.0, 3.0);
    });

    it('should get polygons data', () => {
      mockGecoInstance.get_polygons_json.mockReturnValue('[{"id": "test"}]');
      
      const data = manager.getPolygonsData();
      expect(data).toEqual([{ id: 'test' }]);
    });

    it('should handle invalid JSON gracefully', () => {
      mockGecoInstance.get_polygons_json.mockReturnValue('invalid json');
      
      const data = manager.getPolygonsData();
      expect(data).toEqual([]);
    });

    it('should get animation protobuf', () => {
      const data = manager.getAnimationProtobuf();
      expect(data).toEqual(new Uint8Array([1, 2, 3]));
      expect(mockGecoInstance.get_animation_protobuf).toHaveBeenCalled();
    });

    it('should load animation protobuf', () => {
      const data = new Uint8Array([4, 5, 6]);
      manager.loadAnimationProtobuf(data);
      expect(mockGecoInstance.load_animation_protobuf).toHaveBeenCalledWith(data);
    });
  });

  describe('error handling', () => {
    it('should throw error when calling methods before initialization', () => {
      expect(() => manager.getAnimationName()).toThrow('WASM Manager not initialized');
      expect(() => manager.setAnimationName('test')).toThrow('WASM Manager not initialized');
      expect(() => manager.addStaticPolygon('poly', 1, 2)).toThrow('WASM Manager not initialized');
      expect(() => manager.addPointToActivePolygon(1, 2, 3)).toThrow('WASM Manager not initialized');
      expect(() => manager.getPolygonsData()).toThrow('WASM Manager not initialized');
      expect(() => manager.getAnimationProtobuf()).toThrow('WASM Manager not initialized');
      expect(() => manager.loadAnimationProtobuf(new Uint8Array())).toThrow('WASM Manager not initialized');
    });
  });
});
