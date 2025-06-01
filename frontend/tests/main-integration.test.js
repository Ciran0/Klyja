import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KlyjaApp } from '../js/main.js';
import { ThreeViewer } from '../js/three-viewer.js';
import { WasmManager } from '../js/wasm-manager.js';
import { ApiClient } from '../js/api-client.js';

// Mock dependent modules
vi.mock('../js/three-viewer.js');
vi.mock('../js/wasm-manager.js');
vi.mock('../js/api-client.js');

describe('KlyjaApp Integration (Feature Edition)', () => {
  let app;
  let mockViewerInstance;
  let mockWasmManagerInstance;
  let mockApiClientInstance;

  function setupDOM() {
    document.body.innerHTML = `
      <div class="main-content">
        <div id="viewer-container"></div>
        <aside id="controls-panel">
          <h3>Animation Settings</h3>
          <label for="anim-name-input">Animation Name:</label>
          <input type="text" id="anim-name-input" value="Untitled Animation">
          <p>WASM Name: <span id="wasm-name-span">Loading...</span></p>
          <label for="total-frames-input">Total Frames:</label>
          <input type="number" id="total-frames-input" value="100">
          <button id="set-total-frames-button">Set Total Frames</button>
          <hr>
          <h3>Timeline</h3>
          <label for="frame-slider">Current Frame: <span id="current-frame-display">0</span> / <span id="max-frame-display">100</span></label>
          <input type="range" id="frame-slider" min="0" value="0" max="100">
          <hr>
          <h3>Feature Management</h3>
          <p>Active Feature ID: <span id="active-feature-id-display">None</span></p>
          <h4>Create New Feature</h4>
          <label for="feature-name-input">Feature Name:</label>
          <input type="text" id="feature-name-input" value="MyContinent">
          <label for="feature-type-select">Type:</label>
          <select id="feature-type-select"><option value="1">Polygon</option><option value="2">Polyline</option></select>
          <label for="feature-appearance-frame-input">Appearance Frame:</label>
          <input type="number" id="feature-appearance-frame-input" value="0">
          <label for="feature-disappearance-frame-input">Disappearance Frame:</label>
          <input type="number" id="feature-disappearance-frame-input" value="100">
          <button id="create-feature-button">Create Feature</button>
          <h4>Add to Active Feature</h4>
          <label for="point-id-input">Point ID:</label>
          <input type="text" id="point-id-input" value="p1">
          <p>Sphere Click Coords: <span id="sphere-click-coords">(x: N/A, y: N/A, z: N/A)</span></p>
          <button id="add-point-button">Add Point</button>
          <button id="add-keyframe-button">Add Keyframe</button>
          <hr>
          <h3>Save / Load</h3>
          <button id="save-button">Save Animation</button>
          <label for="load-id-input">Animation ID to Load:</label>
          <input type="number" id="load-id-input" placeholder="Enter ID">
          <button id="load-button">Load Animation</button>
          <hr>
          <div id="status-message-div" class="status-message">App starting...</div>
        </aside>
      </div>
    `;
  }

  beforeEach(async () => {
    setupDOM();

    mockViewerInstance = {
      init: vi.fn(),
      onSphereClick: null,
      renderFeatures: vi.fn(),
      dispose: vi.fn(),
    };
    ThreeViewer.mockImplementation(() => mockViewerInstance);

    mockWasmManagerInstance = {
      init: vi.fn().mockResolvedValue(undefined),
      initialized: true,
      getAnimationName: vi.fn().mockReturnValue('WASM Initial Name'),
      setAnimationName: vi.fn(),
      getTotalFrames: vi.fn().mockReturnValue(100),
      setTotalFrames: vi.fn(),
      createFeature: vi.fn().mockReturnValue('new-feature-id'),
      addPointToActiveFeature: vi.fn().mockReturnValue('new-point-id'),
      addPositionKeyframeToPoint: vi.fn(),
      getRenderableFeaturesJsonAtFrame: vi.fn().mockReturnValue(JSON.stringify([])),
      getAnimationProtobuf: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
      loadAnimationProtobuf: vi.fn(),
    };
    WasmManager.mockImplementation(() => mockWasmManagerInstance);

    mockApiClientInstance = {
      saveAnimation: vi.fn().mockResolvedValue({ id: 99, message: 'Saved' }),
      loadAnimation: vi.fn().mockResolvedValue(new Uint8Array([4, 5, 6])),
    };
    ApiClient.mockImplementation(() => mockApiClientInstance);

    app = new KlyjaApp();
    await app.init(); // Initialize the app for each test
    
    // Reset spies on mock instances after app.init() as it might call some methods
    vi.clearAllMocks(); // Clears call counts, etc. on all mocks
     // Re-mock init for WasmManager as it's called in app.init() and we want to control its behavior for specific tests
    mockWasmManagerInstance.init = vi.fn().mockResolvedValue(undefined);
    mockViewerInstance.init = vi.fn(); // Also re-mock viewer init

  });

  afterEach(() => {
    if (app) app.dispose();
    document.body.innerHTML = '';
    vi.restoreAllMocks(); // Restore all mocks to their original state
  });

  describe('Initialization', () => {
    it('should initialize components and set initial UI state', async () => {
      // app.init() is called in beforeEach
      expect(app.initialized).toBe(true);
      expect(WasmManager).toHaveBeenCalledTimes(1); // constructor called
      expect(ThreeViewer).toHaveBeenCalledTimes(1); // constructor called
      expect(ApiClient).toHaveBeenCalledTimes(1);  // constructor called
      
      expect(mockWasmManagerInstance.getAnimationName).toHaveBeenCalled();
      expect(mockWasmManagerInstance.getTotalFrames).toHaveBeenCalled();
      expect(mockViewerInstance.renderFeatures).toHaveBeenCalled();
      expect(document.getElementById('wasm-name-span').textContent).toBe('WASM Initial Name');
      expect(document.getElementById('anim-name-input').value).toBe('WASM Initial Name');
      expect(document.getElementById('max-frame-display').textContent).toBe('100');
    });
  });

  describe('Animation Settings', () => {
    it('should update animation name in WASM when input changes', () => {
      const nameInput = document.getElementById('anim-name-input');
      nameInput.value = 'New Shiny Name';
      nameInput.dispatchEvent(new Event('input'));
      
      expect(mockWasmManagerInstance.setAnimationName).toHaveBeenCalledWith('New Shiny Name');
      expect(mockWasmManagerInstance.getAnimationName).toHaveBeenCalled(); // To update wasmNameSpan
    });

    it('should set total frames in WASM and update UI', () => {
      mockWasmManagerInstance.getTotalFrames.mockReturnValueOnce(150); // Simulate WASM update
      document.getElementById('total-frames-input').value = '150';
      document.getElementById('set-total-frames-button').click();
      
      expect(mockWasmManagerInstance.setTotalFrames).toHaveBeenCalledWith(150);
      expect(document.getElementById('frame-slider').max).toBe('150');
      expect(document.getElementById('max-frame-display').textContent).toBe('150');
      expect(mockViewerInstance.renderFeatures).toHaveBeenCalled();
    });
  });

  describe('Timeline', () => {
    it('should update current frame and re-render on slider input', () => {
      const frameSlider = document.getElementById('frame-slider');
      frameSlider.value = '25';
      frameSlider.dispatchEvent(new Event('input'));
      
      expect(app.uiState.currentFrame).toBe(25);
      expect(document.getElementById('current-frame-display').textContent).toBe('25');
      expect(mockWasmManagerInstance.getRenderableFeaturesJsonAtFrame).toHaveBeenCalledWith(25);
      expect(mockViewerInstance.renderFeatures).toHaveBeenCalled();
    });
  });

  describe('Feature Management', () => {
    it('should create a feature and set it as active', () => {
      document.getElementById('feature-name-input').value = 'TestLand';
      document.getElementById('feature-type-select').value = '1'; // Polygon
      document.getElementById('feature-appearance-frame-input').value = '10';
      document.getElementById('feature-disappearance-frame-input').value = '90';
      document.getElementById('create-feature-button').click();
      
      expect(mockWasmManagerInstance.createFeature).toHaveBeenCalledWith('TestLand', 1, 10, 90);
      expect(app.uiState.activeFeatureId).toBe('new-feature-id');
      expect(document.getElementById('active-feature-id-display').textContent).toBe('new-feature-id');
      expect(mockViewerInstance.renderFeatures).toHaveBeenCalled();
    });

    it('should handle sphere click and update coordinates display', () => {
        expect(mockViewerInstance.onSphereClick).toBeInstanceOf(Function);
        // Simulate sphere click by calling the callback
        mockViewerInstance.onSphereClick(0.1, 0.2, 0.3);
        expect(app.uiState.lastSphereClickCoords).toEqual({ x: 0.1, y: 0.2, z: 0.3 });
        expect(document.getElementById('sphere-click-coords').textContent).toContain('x: 0.10');
    });

    it('should add a point to the active feature', () => {
      app.uiState.activeFeatureId = 'active-feature-123'; // Simulate an active feature
      app.uiState.currentFrame = 5;
      app.uiState.lastSphereClickCoords = { x: 0.1, y: 0.2, z: 0.3 };
      document.getElementById('point-id-input').value = 'myPoint';
      document.getElementById('add-point-button').click();
      
      expect(mockWasmManagerInstance.addPointToActiveFeature).toHaveBeenCalledWith('myPoint', 5, 0.1, 0.2, 0.3);
      expect(mockViewerInstance.renderFeatures).toHaveBeenCalled();
    });
    
    it('should not add point if no active feature', () => {
      app.uiState.activeFeatureId = null;
      document.getElementById('add-point-button').click();
      expect(mockWasmManagerInstance.addPointToActiveFeature).not.toHaveBeenCalled();
      expect(document.getElementById('status-message-div').textContent).toContain('No active feature');
    });


    it('should add a keyframe to a point in the active feature', () => {
      app.uiState.activeFeatureId = 'active-feature-123';
      app.uiState.currentFrame = 15;
      app.uiState.lastSphereClickCoords = { x: 0.4, y: 0.5, z: 0.6 };
      document.getElementById('point-id-input').value = 'targetPoint';
      document.getElementById('add-keyframe-button').click();
      
      expect(mockWasmManagerInstance.addPositionKeyframeToPoint).toHaveBeenCalledWith('active-feature-123', 'targetPoint', 15, 0.4, 0.5, 0.6);
      expect(mockViewerInstance.renderFeatures).toHaveBeenCalled();
    });
     it('should require point ID for adding keyframe', () => {
      app.uiState.activeFeatureId = 'active-feature-123';
      document.getElementById('point-id-input').value = ''; // Empty point ID
      document.getElementById('add-keyframe-button').click();
      expect(mockWasmManagerInstance.addPositionKeyframeToPoint).not.toHaveBeenCalled();
      expect(document.getElementById('status-message-div').textContent).toContain('Please enter a Point ID');
    });
  });

  describe('Save and Load', () => {
    it('should save animation data', async () => {
      document.getElementById('anim-name-input').value = "Save Test Name";
      // Trigger input event to update wasm name if different
      document.getElementById('anim-name-input').dispatchEvent(new Event('input'));

      await app.saveAnimationWithUIUpdate();
      
      expect(mockWasmManagerInstance.setAnimationName).toHaveBeenCalledWith("Save Test Name");
      expect(mockWasmManagerInstance.getAnimationProtobuf).toHaveBeenCalled();
      expect(mockApiClientInstance.saveAnimation).toHaveBeenCalledWith(new Uint8Array([1,2,3]));
      expect(document.getElementById('status-message-div').textContent).toContain('Save successful! Animation ID: 99');
      expect(document.getElementById('load-id-input').value).toBe('99');
    });

    it('should load animation data', async () => {
      document.getElementById('load-id-input').value = '77';
      mockWasmManagerInstance.getAnimationName.mockReturnValue('Loaded Anim Name'); // After load
      mockWasmManagerInstance.getTotalFrames.mockReturnValue(120); // After load

      await app.loadAnimationWithUIUpdate();
      
      expect(mockApiClientInstance.loadAnimation).toHaveBeenCalledWith(77);
      expect(mockWasmManagerInstance.loadAnimationProtobuf).toHaveBeenCalledWith(new Uint8Array([4,5,6]));
      expect(document.getElementById('anim-name-input').value).toBe('Loaded Anim Name');
      expect(document.getElementById('max-frame-display').textContent).toBe('120');
      expect(mockViewerInstance.renderFeatures).toHaveBeenCalled(); // Called after load
      expect(document.getElementById('status-message-div').textContent).toContain("Animation loaded: 'Loaded Anim Name' (ID: 77)");
    });
  });
  
   describe('Error Handling in UI', () => {
    it('should display error if creating feature fails in WASM', () => {
      mockWasmManagerInstance.createFeature.mockImplementationOnce(() => {
        throw new Error('WASM Feature Error');
      });
      document.getElementById('create-feature-button').click();
      expect(document.getElementById('status-message-div').textContent).toContain('Error creating feature: WASM Feature Error');
    });

    it('should display error if adding point fails in WASM', () => {
      app.uiState.activeFeatureId = 'active-feature-123';
      mockWasmManagerInstance.addPointToActiveFeature.mockImplementationOnce(() => {
        throw new Error('WASM Point Error');
      });
      document.getElementById('add-point-button').click();
      expect(document.getElementById('status-message-div').textContent).toContain('Error adding point: WASM Point Error');
    });
   });
});
