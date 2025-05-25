import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KlyjaApp } from '../js/main.js'; // Assuming KlyjaApp is exported or accessible
import { ThreeViewer } from '../js/three-viewer.js';
import { WasmManager } from '../js/wasm-manager.js';
import { ApiClient } from '../js/api-client.js';

// Mock the modules KlyjaApp depends on
vi.mock('../js/three-viewer.js');
vi.mock('../js/wasm-manager.js');
vi.mock('../js/api-client.js');

describe('KlyjaApp Integration', () => {
  let app;
  let mockViewer;
  let mockWasmManager;
  let mockApiClient;

  beforeEach(() => {
    // Set up a more complete DOM, matching what KlyjaApp expects
    document.body.innerHTML = `
      <div class="main-content">
          <div id="viewer-container"></div>
          <aside id="controls-panel">
              <h3>Controls</h3>
              <label for="anim-name-input">Animation Name:</label>
              <input type="text" id="anim-name-input" placeholder="Untitled Animation">
              <p style="font-size: 0.8em;">
                  Current WASM Name: <span id="wasm-name-span">Loading...</span>
              </p>
              <label for="poly-id-input">New Polygon ID:</label>
              <input type="text" id="poly-id-input" placeholder="e.g., poly1">
              <button id="add-poly-button">Add Test Polygon</button>
              <p style="font-size: 0.8em;">Click on sphere to add points to the *last added* polygon.</p>
              <hr>
              <button id="save-button">Save Animation</button>
              <hr>
              <label for="load-id-input">Animation ID to Load:</label>
              <input type="number" id="load-id-input" placeholder="Enter ID (e.g., 1)">
              <button id="load-button">Load Animation</button>
              <hr>
              <div id="status-message-div" class="status-message">App starting...</div>
          </aside>
      </div>
    `;

    // Create mock instances for KlyjaApp's dependencies
    mockViewer = {
      init: vi.fn(),
      onSphereClick: null, // KlyjaApp will set this
      renderPolygons: vi.fn(),
      dispose: vi.fn()
    };
    ThreeViewer.mockImplementation(() => mockViewer);

    mockWasmManager = {
      init: vi.fn().mockResolvedValue(undefined), // Ensure it's a resolved promise
      initialized: true, // Simulate successful initialization by default for most tests
      getAnimationName: vi.fn().mockReturnValue('Test Animation'),
      setAnimationName: vi.fn(),
      addStaticPolygon: vi.fn(),
      addPointToActivePolygon: vi.fn(),
      getPolygonsData: vi.fn().mockReturnValue([]),
      getAnimationProtobuf: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
      loadAnimationProtobuf: vi.fn()
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
    document.body.innerHTML = ''; // Clean up DOM
  });

  // --- Initialization Tests ---
  describe('initialization', () => {
    it('should initialize all components and bind events', async () => {
      await app.init();
      expect(app.initialized).toBe(true);
      expect(mockWasmManager.init).toHaveBeenCalled();
      expect(mockViewer.init).toHaveBeenCalled();
      // Check if a specific event was bound (optional, relies on DOM elements existing)
      // For example, you could spy on addEventListener if needed, but usually testing the effect is better.
    });

    it('should set up sphere click handler', async () => {
      await app.init();
      expect(mockViewer.onSphereClick).toBeInstanceOf(Function);
    });

    // Note: "should make functions globally available" might be less relevant now
    // unless you are explicitly setting them on `window` for other reasons.
    // The vanilla JS version doesn't primarily rely on global functions for its own UI.

    it('should render initial state', async () => {
      await app.init();
      expect(mockWasmManager.getPolygonsData).toHaveBeenCalled();
      expect(mockViewer.renderPolygons).toHaveBeenCalled();
    });

    it('should not initialize twice', async () => {
      await app.init();
      await app.init(); // Second call
      expect(mockWasmManager.init).toHaveBeenCalledTimes(1);
      // Add more checks if other init functions should also be called only once
    });

    it('should handle initialization errors from WASM', async () => {
      // Simulate WasmManager init failing
      const wasmError = new Error('WASM failed');
      mockWasmManager.init.mockRejectedValueOnce(wasmError);

      // KlyjaApp.init should catch this and throw, or handle it gracefully
      // The current KlyjaApp.init throws the error.
      await expect(app.init()).rejects.toThrow(wasmError);
      expect(app.initialized).toBe(false);
      // Check if status message reflects the error
      expect(document.getElementById('status-message-div').textContent).toContain('Initialization Error: WASM failed');
    });
  });

  // --- Sphere Click Handling ---
  describe('sphere click handling', () => {
    beforeEach(async () => {
      await app.init(); // Ensure app is initialized
    });

    it('should add point and re-render on sphere click', () => {
      // Manually call the sphere click handler (as if ThreeViewer triggered it)
      app.handleSphereClick(1.5, 2.5, 3.5);

      expect(mockWasmManager.addPointToActivePolygon).toHaveBeenCalledWith(1.5, 2.5, 3.5);
      // renderCurrentState is called by handleSphereClick, which calls getPolygonsData & renderPolygons
      // It's called once during init, and once after the click.
      expect(mockViewer.renderPolygons).toHaveBeenCalledTimes(2);
    });

    it('should handle errors when adding point', () => {
      const pointError = new Error('No active polygon');
      mockWasmManager.addPointToActivePolygon.mockImplementationOnce(() => {
        throw pointError;
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      app.handleSphereClick(1, 2, 3);
      
      expect(consoleSpy).toHaveBeenCalledWith('Error adding point:', pointError);
      expect(document.getElementById('status-message-div').textContent).toContain('Error adding point: No active polygon');
      consoleSpy.mockRestore();
    });
  });

  // --- Save Animation ---
  describe('save animation', () => {
    beforeEach(async () => {
      await app.init();
    });

    it('should save animation successfully', async () => {
      const result = await app.saveAnimationWithUIUpdate();

      expect(mockWasmManager.getAnimationProtobuf).toHaveBeenCalled();
      expect(mockApiClient.saveAnimation).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
      expect(result).toEqual({ id: 123, message: 'Success' });
      expect(document.getElementById('status-message-div').textContent).toContain('Save successful! ID: 123');
    });

    it('should handle save errors', async () => {
      const saveError = new Error('Network error');
      mockApiClient.saveAnimation.mockRejectedValueOnce(saveError);

      await expect(app.saveAnimationWithUIUpdate()).rejects.toThrow(saveError);
      expect(document.getElementById('status-message-div').textContent).toContain('Save failed: Network error');
    });
  });

  // --- Load Animation ---
  describe('load animation', () => {
    beforeEach(async () => {
      await app.init();
    });

    it('should load animation successfully', async () => {
      // Set a value for the load ID input for the app to use
      const loadIdInput = document.getElementById('load-id-input');
      loadIdInput.value = '123'; // Simulate user typing "123"
      app.uiState.animationIdToLoad = '123'; // Also update the internal state if method reads from there

      const animationName = await app.loadAnimationWithUIUpdate();

      expect(mockApiClient.loadAnimation).toHaveBeenCalledWith(123);
      expect(mockWasmManager.loadAnimationProtobuf).toHaveBeenCalledWith(new Uint8Array([4, 5, 6]));
      expect(mockViewer.renderPolygons).toHaveBeenCalledTimes(2); // Initial + after load
      expect(mockWasmManager.getAnimationName).toHaveBeenCalled();
      expect(animationName).toBe('Test Animation');
      expect(document.getElementById('status-message-div').textContent).toContain("Animation loaded: 'Test Animation' (ID: 123)");
    });

    it('should handle load errors from API', async () => {
      const loadError = new Error('Not found');
      mockApiClient.loadAnimation.mockRejectedValueOnce(loadError);
      app.uiState.animationIdToLoad = '123';


      await expect(app.loadAnimationWithUIUpdate()).rejects.toThrow(loadError);
      expect(document.getElementById('status-message-div').textContent).toContain('Load failed: Not found');
    });

     it('should handle invalid ID for load', async () => {
      app.uiState.animationIdToLoad = 'abc'; // Invalid ID
      await app.loadAnimationWithUIUpdate(); // Should not throw but update status
      expect(mockApiClient.loadAnimation).not.toHaveBeenCalled();
      expect(document.getElementById('status-message-div').textContent).toContain('Please enter a valid number ID to load.');
    });
  });

  // --- Render Current State ---
  describe('render current state', () => {
    beforeEach(async () => {
      await app.init();
    });
    it('should get polygons data and render', () => {
      const mockPolygons = [{ polygon_id: 'poly1', points: [] }];
      mockWasmManager.getPolygonsData.mockReturnValue(mockPolygons);

      app.renderCurrentState(); // Called once during init, call again to test

      expect(mockWasmManager.getPolygonsData).toHaveBeenCalledTimes(2); // init + this call
      expect(mockViewer.renderPolygons).toHaveBeenCalledWith(mockPolygons);
      expect(mockViewer.renderPolygons).toHaveBeenCalledTimes(2); // init + this call
    });
  });
  
  // --- Disposal ---
  describe('disposal', () => {
    it('should dispose viewer', async () => {
      await app.init();
      app.dispose();
      expect(mockViewer.dispose).toHaveBeenCalled();
    });

    it('should handle disposal when viewer not initialized', () => {
      // app is created but app.init() is not called, so app.viewer is null
      app.dispose(); // Should not throw
      expect(mockViewer.dispose).not.toHaveBeenCalled();
    });
  });

  // The "app state integration" tests from your original file are no longer directly applicable
  // because `app.appState` and its `_deps` structure have changed.
  // You would now test the interactions with `app.uiState` or the direct calls to mocked services.
  // For example, instead of checking `app.appState._deps.saveWasmData`, you check if `app.saveAnimationWithUIUpdate()`
  // calls `mockApiClient.saveAnimation`.
});
