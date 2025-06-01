import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KlyjaApp } from '../js/main.js';
import { ThreeViewer } from '../js/three-viewer.js';
import { WasmManager } from '../js/wasm-manager.js'; // Import the actual/mocked class
import { ApiClient } from '../js/api-client.js';

// Mock dependent modules at the top level
vi.mock('../js/three-viewer.js');
vi.mock('../js/wasm-manager.js'); // This will use the mock factory if one exists or auto-mock
vi.mock('../js/api-client.js');

describe('KlyjaApp Integration (Feature Edition)', () => {
  let app;
  let mockViewerInstance;
  let mockWasmManagerInstance; // This will be our plain object with spies
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
          <input type="text" id="feature-name-input" value="MyFeature">
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
    vi.clearAllMocks();
    setupDOM();

    // Define the plain object with spies that our WasmManager instance will be
    mockWasmManagerInstance = {
      init: vi.fn().mockResolvedValue(undefined),
      initialized: true, // Assume init makes it initialized
      getAnimationName: vi.fn().mockReturnValue('Test Animation'), // Default mock from setup.js
      setAnimationName: vi.fn(),
      getTotalFrames: vi.fn().mockReturnValue(100), // Default mock
      setTotalFrames: vi.fn(),
      createFeature: vi.fn().mockReturnValue('new-feature-id'),
      addPointToActiveFeature: vi.fn().mockReturnValue('new-point-id'),
      addPositionKeyframeToPoint: vi.fn(),
      getRenderableFeaturesJsonAtFrame: vi.fn().mockReturnValue(JSON.stringify([])),
      getAnimationProtobuf: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
      loadAnimationProtobuf: vi.fn(),
      get_active_feature_id: vi.fn().mockReturnValue(null), //Ensure all methods are present
    };
    
    // When new WasmManager() is called, it will return our mockWasmManagerInstance
    WasmManager.mockImplementation(() => mockWasmManagerInstance);

    mockViewerInstance = {
      init: vi.fn(),
      onSphereClick: null,
      renderFeatures: vi.fn(),
      dispose: vi.fn(),
    };
    ThreeViewer.mockImplementation(() => mockViewerInstance);

    mockApiClientInstance = {
      saveAnimation: vi.fn().mockResolvedValue({ id: 99, message: 'Saved' }),
      loadAnimation: vi.fn().mockResolvedValue(new Uint8Array([4, 5, 6])),
    };
    ApiClient.mockImplementation(() => mockApiClientInstance);

    app = new KlyjaApp();
    await app.init(); // app.init() will call new WasmManager(), which will use the mockImplementation
  });

  afterEach(() => {
    if (app) app.dispose();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize components and set initial UI state', async () => {
      expect(app.initialized).toBe(true);
      // Check if the WasmManager constructor (which is now our mock implementation factory) was called
      expect(WasmManager).toHaveBeenCalledTimes(1);
      // Check if the init method on our returned instance was called
      expect(mockWasmManagerInstance.init).toHaveBeenCalledTimes(1);

      expect(ThreeViewer).toHaveBeenCalledTimes(1);
      expect(mockViewerInstance.init).toHaveBeenCalledTimes(1);
      
      expect(ApiClient).toHaveBeenCalledTimes(1);
      
      expect(mockWasmManagerInstance.getAnimationName).toHaveBeenCalled();
      expect(mockWasmManagerInstance.getTotalFrames).toHaveBeenCalled();
      expect(mockViewerInstance.renderFeatures).toHaveBeenCalled();
      expect(document.getElementById('wasm-name-span').textContent).toBe('Test Animation');
      expect(document.getElementById('anim-name-input').value).toBe('Test Animation');
      expect(document.getElementById('max-frame-display').textContent).toBe('100');
    });
  });

  // ... (rest of your tests in main-integration.test.js)
  // Ensure you continue to use mockWasmManagerInstance for method spy checks,
  // and WasmManager for constructor spy checks.
  // The fixes for dispatching 'input' events from the previous step should remain.

  // Example of one test with input dispatch fixed:
  describe('Animation Settings', () => {
    it('should update animation name in WASM when input changes', () => {
      const nameInput = document.getElementById('anim-name-input');
      nameInput.value = 'New Shiny Name';
      nameInput.dispatchEvent(new Event('input')); // Dispatch event
      
      expect(mockWasmManagerInstance.setAnimationName).toHaveBeenCalledWith('New Shiny Name');
      expect(mockWasmManagerInstance.getAnimationName).toHaveBeenCalled(); 
    });

    it('should set total frames in WASM and update UI', () => {
      const totalFramesInput = document.getElementById('total-frames-input');
      totalFramesInput.value = '150';
      totalFramesInput.dispatchEvent(new Event('input')); // Dispatch event

      mockWasmManagerInstance.getTotalFrames.mockReturnValueOnce(150); 
      
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
      const featureNameInput = document.getElementById('feature-name-input');
      const featureTypeSelect = document.getElementById('feature-type-select');
      const appearanceInput = document.getElementById('feature-appearance-frame-input');
      const disappearanceInput = document.getElementById('feature-disappearance-frame-input');

      featureNameInput.value = 'TestLand';
      featureTypeSelect.value = '1'; 
      appearanceInput.value = '10';
      disappearanceInput.value = '90';

      featureNameInput.dispatchEvent(new Event('input'));
      featureTypeSelect.dispatchEvent(new Event('change')); 
      appearanceInput.dispatchEvent(new Event('input'));
      disappearanceInput.dispatchEvent(new Event('input'));
      
      mockWasmManagerInstance.createFeature.mockReturnValueOnce('custom-feature-id');

      document.getElementById('create-feature-button').click();
      
      expect(mockWasmManagerInstance.createFeature).toHaveBeenCalledWith('TestLand', 1, 10, 90);
      expect(app.uiState.activeFeatureId).toBe('custom-feature-id');
      expect(document.getElementById('active-feature-id-display').textContent).toBe('custom-feature-id');
      expect(mockViewerInstance.renderFeatures).toHaveBeenCalled();
    });

    it('should handle sphere click and update coordinates display', () => {
        expect(mockViewerInstance.onSphereClick).toBeInstanceOf(Function);
        mockViewerInstance.onSphereClick(0.1, 0.2, 0.3);
        expect(app.uiState.lastSphereClickCoords).toEqual({ x: 0.1, y: 0.2, z: 0.3 });
        expect(document.getElementById('sphere-click-coords').textContent).toContain('x: 0.10');
    });

    it('should add a point to the active feature', () => {
      app.uiState.activeFeatureId = 'active-feature-123'; 
      app.uiState.currentFrame = 5; 
      app.uiState.lastSphereClickCoords = { x: 0.1, y: 0.2, z: 0.3 }; 

      const pointIdInput = document.getElementById('point-id-input');
      pointIdInput.value = 'myPoint';
      pointIdInput.dispatchEvent(new Event('input')); 

      mockWasmManagerInstance.addPointToActiveFeature.mockReturnValueOnce('returned-point-id');

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
      
      const pointIdInput = document.getElementById('point-id-input');
      pointIdInput.value = 'targetPoint';
      pointIdInput.dispatchEvent(new Event('input')); 

      document.getElementById('add-keyframe-button').click();
      
      expect(mockWasmManagerInstance.addPositionKeyframeToPoint).toHaveBeenCalledWith('active-feature-123', 'targetPoint', 15, 0.4, 0.5, 0.6);
      expect(mockViewerInstance.renderFeatures).toHaveBeenCalled();
    });

     it('should require point ID for adding keyframe', () => {
      app.uiState.activeFeatureId = 'active-feature-123';
      const pointIdInput = document.getElementById('point-id-input');
      pointIdInput.value = ''; 
      pointIdInput.dispatchEvent(new Event('input'));

      document.getElementById('add-keyframe-button').click();
      expect(mockWasmManagerInstance.addPositionKeyframeToPoint).not.toHaveBeenCalled();
      expect(document.getElementById('status-message-div').textContent).toContain('Please enter a Point ID');
    });
  });

  describe('Save and Load', () => {
    it('should save animation data', async () => {
      const animNameInput = document.getElementById('anim-name-input');
      animNameInput.value = "Save Test Name";
      animNameInput.dispatchEvent(new Event('input'));

      mockWasmManagerInstance.getAnimationName.mockReturnValueOnce("Save Test Name");

      await app.saveAnimationWithUIUpdate();
      
      expect(mockWasmManagerInstance.setAnimationName).toHaveBeenCalledWith("Save Test Name");
      expect(mockWasmManagerInstance.getAnimationProtobuf).toHaveBeenCalled();
      expect(mockApiClientInstance.saveAnimation).toHaveBeenCalledWith(expect.any(Uint8Array)); 
      expect(document.getElementById('status-message-div').textContent).toContain('Save successful! Animation ID: 99');
      expect(document.getElementById('load-id-input').value).toBe('99');
    });

    it('should load animation data', async () => {
      const loadIdInput = document.getElementById('load-id-input');
      loadIdInput.value = '77';
      loadIdInput.dispatchEvent(new Event('input')); 

      mockWasmManagerInstance.getAnimationName.mockReturnValueOnce('Loaded Anim Name'); 
      mockWasmManagerInstance.getTotalFrames.mockReturnValueOnce(120); 

      await app.loadAnimationWithUIUpdate();
      
      expect(mockApiClientInstance.loadAnimation).toHaveBeenCalledWith(77);
      expect(mockWasmManagerInstance.loadAnimationProtobuf).toHaveBeenCalledWith(expect.any(Uint8Array)); 
      expect(document.getElementById('anim-name-input').value).toBe('Loaded Anim Name');
      expect(document.getElementById('max-frame-display').textContent).toBe('120');
      expect(mockViewerInstance.renderFeatures).toHaveBeenCalled(); 
      expect(document.getElementById('status-message-div').textContent).toContain("Animation loaded: 'Loaded Anim Name' (ID: 77)");
    });
  });
  
   describe('Error Handling in UI', () => {
    it('should display error if creating feature fails in WASM', () => {
      document.getElementById('feature-name-input').dispatchEvent(new Event('input')); // ensure uiState is set
      mockWasmManagerInstance.createFeature.mockImplementationOnce(() => {
        throw new Error('WASM Feature Error');
      });
      document.getElementById('create-feature-button').click();
      expect(document.getElementById('status-message-div').textContent).toContain('Error creating feature: WASM Feature Error');
    });

    it('should display error if adding point fails in WASM', () => {
      app.uiState.activeFeatureId = 'active-feature-123';
      document.getElementById('point-id-input').dispatchEvent(new Event('input'));

      mockWasmManagerInstance.addPointToActiveFeature.mockImplementationOnce(() => {
        throw new Error('WASM Point Error');
      });
      document.getElementById('add-point-button').click();
      expect(document.getElementById('status-message-div').textContent).toContain('Error adding point: WASM Point Error');
    });
   });
});
