// frontend/tests/main-integration.test.js
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
    // This DOM structure now matches your index.html, including the new elements.
    document.body.innerHTML = `
      <div class="main-content">
        <div id="viewer-container"></div>
        <aside id="controls-panel">
          <div id="user-auth-panel">
            <div id="user-info-panel" class="hidden">
              <p>Welcome, <strong id="user-display-name"></strong>!</p>
              <button id="logout-button">Logout</button>
            </div>
            <div id="login-panel">
              <a href="/api/auth/github" class="button">Login with GitHub</a>
            </div>
          </div>
          <hr>
          <div id="my-animations-panel" class="hidden">
            <h3>My Animations</h3>
            <ul id="my-animations-list"></ul>
          </div>
          <h3>Animation Settings</h3>
          <label for="anim-name-input">Animation Name:</label>
          <input type="text" id="anim-name-input" placeholder="Untitled Animation">
          <p>WASM Name: <span id="wasm-name-span">Loading...</span></p>
          <label for="total-frames-input">Total Frames:</label>
          <input type="number" id="total-frames-input" value="100" min="1">
          <button id="set-total-frames-button">Set Total Frames</button>
          <hr>
          <h3>Timeline</h3>
          <label for="frame-slider">
            Current Frame: <span id="current-frame-display">0</span> / <span id="max-frame-display">100</span>
          </label>
          <input type="range" id="frame-slider" min="0" value="0" max="100" style="width: 100%">
          <hr>
          <h3>Feature Management</h3>
          <h4>Features in Animation</h4>
          <ul id="feature-list" style="height: 100px; overflow-y: auto; border: 1px solid #ccc; padding: 5px; list-style-type: none; margin:0"></ul>
          <h4>Points in Active Feature</h4>
          <ul id="point-list" style="height: 100px; overflow-y: auto; border: 1px solid #ccc; padding: 5px; list-style-type: none; margin:0"></ul>
          <p>Active Feature: <span id="active-feature-id-display">None</span></p>
          <h4>Add to Active Feature</h4>
          <label for="click-to-add-toggle" style="cursor: pointer;">
            <input type="checkbox" id="click-to-add-toggle">
            Click on sphere to add points
          </label>
          <hr style="margin: 5px 0;">
          <label for="point-id-input">Point ID (for keyframing):</label>
          <input type="text" id="point-id-input" placeholder="Select from list above">
          <p><em>Click Coords: <span id="sphere-click-coords">(x: N/A, y: N/A, z: N/A)</span></em></p>
          <button id="add-keyframe-button">Add Keyframe to Selected Point</button>
          <hr>
          <h4>Create New Feature</h4>
          <label for="feature-name-input">Feature Name:</label>
          <input type="text" id="feature-name-input" placeholder="MyContinent">
          <label for="feature-type-select">Type:</label>
          <select id="feature-type-select">
            <option value="1">Polygon</option>
            <option value="2">Polyline</option>
          </select>
          <label for="feature-appearance-frame-input">Appearance Frame:</label>
          <input type="number" id="feature-appearance-frame-input" value="0" min="0">
          <label for="feature-disappearance-frame-input">Disappearance Frame:</label>
          <input type="number" id="feature-disappearance-frame-input" value="100" min="0">
          <button id="create-feature-button">Create Feature & Set Active</button>
          <hr>
          <h3>Save / Load</h3>
          <button id="save-button" disabled>Save Animation</button>
          <hr>
          <label for="load-id-input">Animation ID to Load:</label>
          <input type="number" id="load-id-input" placeholder="Enter ID (e.g., 1)">
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

    mockWasmManagerInstance = {
      init: vi.fn().mockResolvedValue(undefined),
      initialized: true,
      getAnimationName: vi.fn().mockReturnValue('Test Animation'),
      setAnimationName: vi.fn(),
      getTotalFrames: vi.fn().mockReturnValue(100),
      setTotalFrames: vi.fn(),
      createFeature: vi.fn().mockReturnValue('new-feature-id'),
      addPointToActiveFeature: vi.fn().mockReturnValue('new-point-id'),
      addPositionKeyframeToPoint: vi.fn(),
      getRenderableLineSegmentsAtFrame: vi.fn().mockReturnValue({ vertex_data: [], segment_count: 0 }),
      getAnimationProtobuf: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
      loadAnimationProtobuf: vi.fn(),
      // Updated mock to include new methods
      getFeatures: vi.fn().mockResolvedValue([]),
      getPointsForFeature: vi.fn().mockResolvedValue([]),
      setActiveFeature: vi.fn(),
    };
    WasmManager.mockImplementation(() => mockWasmManagerInstance);

    mockViewerInstance = {
      init: vi.fn(),
      onSphereClick: null,
      renderFeatures: vi.fn(),
      dispose: vi.fn(),
    };
    ThreeViewer.mockImplementation(() => mockViewerInstance);

    mockApiClientInstance = {
      getMe: vi.fn().mockRejectedValue(new Error('Not authenticated')),
      getMyAnimations: vi.fn().mockResolvedValue([]),
      saveAnimation: vi.fn().mockResolvedValue({ id: 99, message: 'Saved' }),
      loadAnimation: vi.fn().mockResolvedValue(new Uint8Array([4, 5, 6])),
    };
    ApiClient.mockImplementation(() => mockApiClientInstance);

    app = new KlyjaApp();
    await app.init();
  });

  afterEach(() => {
    if (app) app.dispose();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize components and set initial UI state', async () => {
      expect(app.initialized).toBe(true);
      expect(WasmManager).toHaveBeenCalledTimes(1);
      expect(mockWasmManagerInstance.init).toHaveBeenCalledTimes(1);
      expect(ThreeViewer).toHaveBeenCalledTimes(1);
      expect(mockViewerInstance.init).toHaveBeenCalledTimes(1);
      expect(ApiClient).toHaveBeenCalledTimes(1);
      expect(mockWasmManagerInstance.getAnimationName).toHaveBeenCalled();
      expect(document.getElementById('wasm-name-span').textContent).toBe('Test Animation');
    });
  });

  describe('Animation Settings', () => {
    it('should update animation name in WASM when input changes', () => {
      const nameInput = document.getElementById('anim-name-input');
      nameInput.value = 'New Shiny Name';
      nameInput.dispatchEvent(new Event('input'));
      expect(mockWasmManagerInstance.setAnimationName).toHaveBeenCalledWith('New Shiny Name');
    });

    it('should set total frames in WASM and update UI', () => {
      const totalFramesInput = document.getElementById('total-frames-input');
      totalFramesInput.value = '150';
      totalFramesInput.dispatchEvent(new Event('input'));
      mockWasmManagerInstance.getTotalFrames.mockReturnValueOnce(150);
      document.getElementById('set-total-frames-button').click();
      expect(mockWasmManagerInstance.setTotalFrames).toHaveBeenCalledWith(150);
      expect(document.getElementById('frame-slider').max).toBe('150');
    });
  });

  describe('Timeline', () => {
    it('should update current frame and re-render on slider input', () => {
      const frameSlider = document.getElementById('frame-slider');
      // Set the slider value
      frameSlider.value = 25;
      // Dispatch the event to trigger the handler
      frameSlider.dispatchEvent(new Event('input'));
      expect(app.uiState.currentFrame).toBe(25);
      // MODIFICATION: Use `toHaveBeenLastCalledWith` to check the final call,
      // and expect the `null` second argument.
      expect(mockWasmManagerInstance.getRenderableLineSegmentsAtFrame).toHaveBeenLastCalledWith(25, null);
    });
  });

  describe('Feature Management', () => {
    it('should create a feature and set it as active', () => {
      const featureNameInput = document.getElementById('feature-name-input');
      featureNameInput.value = 'TestLand';
      featureNameInput.dispatchEvent(new Event('input'));
      document.getElementById('create-feature-button').click();
      expect(mockWasmManagerInstance.createFeature).toHaveBeenCalledWith('TestLand', 1, 0, 100);
      expect(app.uiState.activeFeatureId).toBe('new-feature-id');
    });

    it('should handle sphere click and update coordinates display', () => {
        expect(mockViewerInstance.onSphereClick).toBeInstanceOf(Function);
        mockViewerInstance.onSphereClick(0.1, 0.2, 0.3);
        expect(app.uiState.lastSphereClickCoords).toEqual({ x: 0.1, y: 0.2, z: 0.3 });
        expect(document.getElementById('sphere-click-coords').textContent).toContain('x: 0.10');
    });

    it('should add a point to the active feature via sphere click', () => {
      app.uiState.activeFeatureId = 'active-feature-123';
      app.uiState.currentFrame = 5;

      const clickToAddToggle = document.getElementById('click-to-add-toggle');
      clickToAddToggle.checked = true;
      clickToAddToggle.dispatchEvent(new Event('change'));
      expect(app.uiState.isClickToAddMode).toBe(true);

      mockViewerInstance.onSphereClick(0.1, 0.2, 0.3);

      expect(mockWasmManagerInstance.addPointToActiveFeature).toHaveBeenCalledWith('', 5, 0.1, 0.2, 0.3);
      expect(mockViewerInstance.renderFeatures).toHaveBeenCalled();
    });

    it('should not add point if no active feature', () => {
      app.uiState.activeFeatureId = null;

      const clickToAddToggle = document.getElementById('click-to-add-toggle');
      clickToAddToggle.checked = true;
      clickToAddToggle.dispatchEvent(new Event('change'));
      
      mockViewerInstance.onSphereClick(0.1, 0.2, 0.3);

      expect(mockWasmManagerInstance.addPointToActiveFeature).not.toHaveBeenCalled();
      expect(document.getElementById('status-message-div').textContent).toContain('Cannot add point: No active feature');
    });

    it('should add a keyframe to a point in the active feature', () => {
      app.uiState.activeFeatureId = 'active-feature-123';
      app.uiState.lastSphereClickCoords = { x: 0.4, y: 0.5, z: 0.6 };
      
      const pointIdInput = document.getElementById('point-id-input');
      pointIdInput.value = 'targetPoint';
      pointIdInput.dispatchEvent(new Event('input')); 

      document.getElementById('add-keyframe-button').click();
      
      expect(mockWasmManagerInstance.addPositionKeyframeToPoint).toHaveBeenCalledWith('active-feature-123', 'targetPoint', 0, 0.4, 0.5, 0.6);
    });

    it('should require point ID for adding keyframe', () => {
      app.uiState.activeFeatureId = 'active-feature-123';
      const pointIdInput = document.getElementById('point-id-input');
      pointIdInput.value = ''; 
      pointIdInput.dispatchEvent(new Event('input'));

      document.getElementById('add-keyframe-button').click();
      expect(mockWasmManagerInstance.addPositionKeyframeToPoint).not.toHaveBeenCalled();
      expect(document.getElementById('status-message-div').textContent).toContain('Please select a point or enter an ID to add a keyframe to.');
    });
  });

  describe('Save and Load', () => {
    it('should save animation data', async () => {
      mockApiClientInstance.getMe.mockResolvedValue({ display_name: 'Test User' });
      await app.checkAuthState(); // Re-authenticate

      document.getElementById('anim-name-input').dispatchEvent(new Event('input'));
      await app.saveAnimationWithUIUpdate();
      
      expect(mockApiClientInstance.saveAnimation).toHaveBeenCalled();
      expect(document.getElementById('status-message-div').textContent).toContain('Save successful!');
    });

    it('should load animation data', async () => {
      const loadIdInput = document.getElementById('load-id-input');
      loadIdInput.value = '77';
      loadIdInput.dispatchEvent(new Event('input')); 

      await app.loadAnimationWithUIUpdate();
      
      expect(mockApiClientInstance.loadAnimation).toHaveBeenCalledWith(77);
      expect(mockWasmManagerInstance.loadAnimationProtobuf).toHaveBeenCalled();
      expect(document.getElementById('status-message-div').textContent).toContain('Animation loaded');
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
      app.uiState.isClickToAddMode = true;
      app.uiState.activeFeatureId = 'active-feature-123';
      mockWasmManagerInstance.addPointToActiveFeature.mockImplementationOnce(() => {
        throw new Error('WASM Point Error');
      });
      mockViewerInstance.onSphereClick(0.1, 0.2, 0.3);
      expect(document.getElementById('status-message-div').textContent).toContain('Error adding point: WASM Point Error');
    });
  });
});
