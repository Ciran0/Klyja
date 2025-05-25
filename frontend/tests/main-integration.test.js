// frontend/tests/main-integration.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KlyjaApp } from '../js/main.js';
import { ThreeViewer } from '../js/three-viewer.js';
import { WasmManager } from '../js/wasm-manager.js';
import { ApiClient } from '../js/api-client.js';

// Mock the modules
vi.mock('../js/three-viewer.js');
vi.mock('../js/wasm-manager.js');
vi.mock('../js/api-client.js');

describe('KlyjaApp Integration', () => {
  let app;
  let mockViewer;
  let mockWasmManager;
  let mockApiClient;

  beforeEach(() => {
    // Set up DOM
    document.body.innerHTML = '<div id="viewer-container"></div>';

    // Create mock instances
    mockViewer = {
      init: vi.fn(),
      onSphereClick: null,
      renderPolygons: vi.fn(),
      dispose: vi.fn()
    };
    ThreeViewer.mockImplementation(() => mockViewer);

    mockWasmManager = {
      init: vi.fn().mockResolvedValue(),
      gecoInstance: {
        get_animation_name: vi.fn().mockReturnValue('Test Animation'),
        set_animation_name: vi.fn(),
        add_static_polygon: vi.fn(),
        add_point_to_active_polygon: vi.fn()
      },
      getPolygonsData: vi.fn().mockReturnValue([]),
      addPointToActivePolygon: vi.fn(),
      getAnimationProtobuf: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
      loadAnimationProtobuf: vi.fn(),
      getAnimationName: vi.fn().mockReturnValue('Test Animation')
    };
    WasmManager.mockImplementation(() => mockWasmManager);

    mockApiClient = {
      saveAnimation: vi.fn().mockResolvedValue({ id: 123, message: 'Success' }),
      loadAnimation: vi.fn().mockResolvedValue(new Uint8Array([4, 5, 6]))
    };
    ApiClient.mockImplementation(() => mockApiClient);

    app = new KlyjaApp();
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  describe('initialization', () => {
    it('should initialize all components', async () => {
      await app.init();

      expect(app.initialized).toBe(true);
      expect(mockWasmManager.init).toHaveBeenCalled();
      expect(mockViewer.init).toHaveBeenCalled();
      expect(app.appState).toBeDefined();
    });

    it('should set up sphere click handler', async () => {
      await app.init();

      expect(mockViewer.onSphereClick).toBeDefined();
      expect(typeof mockViewer.onSphereClick).toBe('function');
    });

    it('should make functions globally available', async () => {
      await app.init();

      expect(window.gecoInstance).toBe(mockWasmManager.gecoInstance);
      expect(typeof window.saveWasmData).toBe('function');
      expect(typeof window.loadWasmData).toBe('function');
      expect(typeof window.renderWasmState).toBe('function');
    });

    it('should render initial state', async () => {
      await app.init();

      expect(mockWasmManager.getPolygonsData).toHaveBeenCalled();
      expect(mockViewer.renderPolygons).toHaveBeenCalled();
    });

    it('should not initialize twice', async () => {
      await app.init();
      await app.init();

      expect(mockWasmManager.init).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors', async () => {
      mockWasmManager.init.mockRejectedValue(new Error('WASM failed'));

      await expect(app.init()).rejects.toThrow('WASM failed');
      expect(app.initialized).toBe(false);
    });
  });

  describe('sphere click handling', () => {
    beforeEach(async () => {
      await app.init();
    });

    it('should add point and re-render on sphere click', () => {
      app.handleSphereClick(1.5, 2.5, 3.5);

      expect(mockWasmManager.addPointToActivePolygon).toHaveBeenCalledWith(1.5, 2.5, 3.5);
      expect(mockViewer.renderPolygons).toHaveBeenCalledTimes(2); // Initial + after click
    });

    it('should handle errors when adding point', () => {
      mockWasmManager.addPointToActivePolygon.mockImplementation(() => {
        throw new Error('No active polygon');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      app.handleSphereClick(1, 2, 3);
      
      expect(consoleSpy).toHaveBeenCalledWith('Error adding point:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('save animation', () => {
    beforeEach(async () => {
      await app.init();
    });

    it('should save animation successfully', async () => {
      const result = await app.saveAnimation();

      expect(mockWasmManager.getAnimationProtobuf).toHaveBeenCalled();
      expect(mockApiClient.saveAnimation).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
      expect(result).toEqual({ id: 123, message: 'Success' });
    });

    it('should handle save errors', async () => {
      mockApiClient.saveAnimation.mockRejectedValue(new Error('Network error'));

      await expect(app.saveAnimation()).rejects.toThrow('Network error');
    });
  });

  describe('load animation', () => {
    beforeEach(async () => {
      await app.init();
    });

    it('should load animation successfully', async () => {
      const animationName = await app.loadAnimation(123);

      expect(mockApiClient.loadAnimation).toHaveBeenCalledWith(123);
      expect(mockWasmManager.loadAnimationProtobuf).toHaveBeenCalledWith(new Uint8Array([4, 5, 6]));
      expect(mockViewer.renderPolygons).toHaveBeenCalledTimes(2); // Initial + after load
      expect(mockWasmManager.getAnimationName).toHaveBeenCalled();
      expect(animationName).toBe('Test Animation');
    });

    it('should handle load errors from API', async () => {
      mockApiClient.loadAnimation.mockRejectedValue(new Error('Not found'));

      await expect(app.loadAnimation(123)).rejects.toThrow('Not found');
    });

    it('should handle load errors from WASM', async () => {
      mockWasmManager.loadAnimationProtobuf.mockImplementation(() => {
        throw new Error('Invalid protobuf');
      });

      await expect(app.loadAnimation(123)).rejects.toThrow('Invalid protobuf');
    });
  });

  describe('render current state', () => {
    beforeEach(async () => {
      await app.init();
    });

    it('should get polygons data and render', () => {
      const mockPolygons = [
        { polygon_id: 'poly1', points: [] }
      ];
      mockWasmManager.getPolygonsData.mockReturnValue(mockPolygons);

      app.renderCurrentState();

      expect(mockWasmManager.getPolygonsData).toHaveBeenCalled();
      expect(mockViewer.renderPolygons).toHaveBeenCalledWith(mockPolygons);
    });

    it('should handle missing components gracefully', () => {
      app.viewer = null;
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      app.renderCurrentState();
      
      expect(consoleSpy).toHaveBeenCalledWith('Cannot render - components not ready');
      consoleSpy.mockRestore();
    });
  });

  describe('disposal', () => {
    it('should dispose viewer', async () => {
      await app.init();
      app.dispose();

      expect(mockViewer.dispose).toHaveBeenCalled();
    });

    it('should handle disposal when viewer not initialized', () => {
      app.dispose(); // Should not throw
      expect(mockViewer.dispose).not.toHaveBeenCalled();
    });
  });

  describe('app state integration', () => {
    beforeEach(async () => {
      await app.init();
    });

    it('should initialize app state with correct dependencies', () => {
      const deps = app.appState._deps;
      
      expect(deps.gecoInstance).toBe(mockWasmManager.gecoInstance);
      expect(typeof deps.saveWasmData).toBe('function');
      expect(typeof deps.loadWasmData).toBe('function');
      expect(typeof deps.renderWasmState).toBe('function');
    });

    it('should connect app state save function to app', async () => {
      await app.appState.saveAnimation();
      
      expect(mockWasmManager.getAnimationProtobuf).toHaveBeenCalled();
      expect(mockApiClient.saveAnimation).toHaveBeenCalled();
    });

    it('should connect app state load function to app', async () => {
      app.appState.animationIdToLoad = '456';
      await app.appState.loadAnimation();
      
      expect(mockApiClient.loadAnimation).toHaveBeenCalledWith(456);
    });
  });
});
