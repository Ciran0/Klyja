// frontend/js/main.js
import { ThreeViewer } from './three-viewer.js';
import { WasmManager } from './wasm-manager.js';
import { ApiClient } from './api-client.js';

export class KlyjaApp {
    constructor() {
        this.viewer = null;
        this.wasmManager = null;
        this.apiClient = null;
        this.initialized = false;

        this.uiState = {
            isAuthenticated: false,
            user: null,
            userAnimations: [],
            currentAnimationName: 'Untitled Animation',
            wasmAnimationName: 'Loading...',
            statusMessage: 'App Loaded.',
            currentFrame: 0,
            totalFrames: 100,
            activeFeatureId: null,
            lastSphereClickCoords: { x: 0, y: 0, z: 0 },
            featureNameInput: 'MyFeature',
            featureTypeInput: 1,
            featureAppearanceFrameInput: 0,
            featureDisappearanceFrameInput: 100,
            pointIdInput: '', // Changed initial state
            animationIdToLoad: '',
            // --- NEW UI STATE ---
            activePointId: null,
            isClickToAddMode: false,
            animationFeatures: [],
            activeFeaturePoints: []
        };
        this.dom = {};
    }

    cacheDOMElements() {
        // Auth elements
        this.dom.userAuthPanel = document.getElementById('user-auth-panel');
        this.dom.userInfoPanel = document.getElementById('user-info-panel');
        this.dom.userDisplayName = document.getElementById('user-display-name');
        this.dom.loginPanel = document.getElementById('login-panel');
        this.dom.logoutButton = document.getElementById('logout-button');
        this.dom.myAnimationsPanel = document.getElementById('my-animations-panel');
        this.dom.myAnimationsList = document.getElementById('my-animations-list');
        
        // --- NEW/MODIFIED CACHED ELEMENTS ---
        this.dom.featureList = document.getElementById('feature-list');
        this.dom.pointList = document.getElementById('point-list');
        this.dom.clickToAddToggle = document.getElementById('click-to-add-toggle');

        // Other elements
        this.dom.animNameInput = document.getElementById('anim-name-input');
        this.dom.wasmNameSpan = document.getElementById('wasm-name-span');
        this.dom.saveButton = document.getElementById('save-button');
        this.dom.loadIdInput = document.getElementById('load-id-input');
        this.dom.loadButton = document.getElementById('load-button');
        this.dom.statusMessageDiv = document.getElementById('status-message-div');
        this.dom.totalFramesInput = document.getElementById('total-frames-input');
        this.dom.setTotalFramesButton = document.getElementById('set-total-frames-button');
        this.dom.frameSlider = document.getElementById('frame-slider');
        this.dom.currentFrameDisplay = document.getElementById('current-frame-display');
        this.dom.maxFrameDisplay = document.getElementById('max-frame-display');
        this.dom.activeFeatureIdDisplay = document.getElementById('active-feature-id-display');
        this.dom.featureNameInput = document.getElementById('feature-name-input');
        this.dom.featureTypeSelect = document.getElementById('feature-type-select');
        this.dom.featureAppearanceFrameInput = document.getElementById('feature-appearance-frame-input');
        this.dom.featureDisappearanceFrameInput = document.getElementById('feature-disappearance-frame-input');
        this.dom.createFeatureButton = document.getElementById('create-feature-button');
        this.dom.pointIdInput = document.getElementById('point-id-input');
        this.dom.sphereClickCoordsDisplay = document.getElementById('sphere-click-coords');
        this.dom.addKeyframeButton = document.getElementById('add-keyframe-button');
    }

    bindUIEvents() {
        this.dom.logoutButton.addEventListener('click', () => {
            window.location.href = '/api/auth/logout';
        });

        this.dom.myAnimationsList.addEventListener('click', (e) => {
            if (e.target && e.target.nodeName === 'LI') {
                const animId = e.target.dataset.id;
                this.dom.loadIdInput.value = animId;
                this.uiState.animationIdToLoad = animId;
                this.loadAnimationWithUIUpdate();
            }
        });
        
        // --- NEW EVENT BINDINGS ---
        this.dom.featureList.addEventListener('click', (e) => {
            if (e.target && e.target.nodeName === 'LI') {
                const featureId = e.target.dataset.id;
                this.handleSelectFeature(featureId);
            }
        });

        this.dom.pointList.addEventListener('click', (e) => {
            if (e.target && e.target.nodeName === 'LI') {
                const pointId = e.target.dataset.id;
                this.handleSelectPoint(pointId);
            }
        });

        this.dom.clickToAddToggle.addEventListener('change', (e) => {
            this.uiState.isClickToAddMode = e.target.checked;
            this.updateStatus(this.uiState.isClickToAddMode ? 'Click-to-add mode enabled.' : 'Click-to-add mode disabled.');
        });
        // --- END NEW EVENT BINDINGS ---
        
        this.dom.animNameInput.addEventListener('input', (e) => {
            this.uiState.currentAnimationName = e.target.value;
            if (this.wasmManager?.initialized) {
                this.wasmManager.setAnimationName(this.uiState.currentAnimationName);
                this.uiState.wasmAnimationName = this.wasmManager.getAnimationName();
                this.syncUIToState();
            }
        });

        this.dom.totalFramesInput.addEventListener('input', (e) => {
            this.uiState.totalFrames = parseInt(e.target.value, 10) || this.uiState.totalFrames;
        });

        this.dom.setTotalFramesButton.addEventListener('click', () => {
            if (this.wasmManager?.initialized) {
                this.wasmManager.setTotalFrames(this.uiState.totalFrames);
                this.uiState.totalFrames = this.wasmManager.getTotalFrames();
                this.dom.frameSlider.max = this.uiState.totalFrames;
                this.dom.featureDisappearanceFrameInput.value = this.uiState.totalFrames;
                this.syncUIToState();
                this.renderCurrentFrame();
            }
        });

        this.dom.frameSlider.addEventListener('input', (e) => {
            this.uiState.currentFrame = parseInt(e.target.value, 10);
            this.syncUIToState();
            this.renderCurrentFrame();
        });

        this.dom.featureNameInput.addEventListener('input', (e) => this.uiState.featureNameInput = e.target.value);
        this.dom.featureTypeSelect.addEventListener('change', (e) => this.uiState.featureTypeInput = parseInt(e.target.value, 10));
        this.dom.featureAppearanceFrameInput.addEventListener('input', (e) => this.uiState.featureAppearanceFrameInput = parseInt(e.target.value, 10));
        this.dom.featureDisappearanceFrameInput.addEventListener('input', (e) => this.uiState.featureDisappearanceFrameInput = parseInt(e.target.value, 10));
        
        this.dom.createFeatureButton.addEventListener('click', () => this.handleCreateFeature());
        this.dom.pointIdInput.addEventListener('input', (e) => this.uiState.pointIdInput = e.target.value);
        // The "Add Point" button is removed, its functionality is now in handleSphereClick
        this.dom.addKeyframeButton.addEventListener('click', () => this.handleAddKeyframeToPoint());
        this.dom.saveButton.addEventListener('click', () => this.saveAnimationWithUIUpdate());
        this.dom.loadIdInput.addEventListener('input', (e) => this.uiState.animationIdToLoad = e.target.value);
        this.dom.loadButton.addEventListener('click', () => this.loadAnimationWithUIUpdate());
    }
    
    syncUIToState() {
        // Auth UI
        if (this.uiState.isAuthenticated) {
            this.dom.userInfoPanel.classList.remove('hidden');
            this.dom.loginPanel.classList.add('hidden');
            this.dom.userDisplayName.textContent = this.uiState.user.display_name;
            this.dom.saveButton.disabled = false;
        } else {
            this.dom.userInfoPanel.classList.add('hidden');
            this.dom.loginPanel.classList.remove('hidden');
            this.dom.saveButton.disabled = true;
        }

        // My Animations List
        if (this.uiState.isAuthenticated && this.uiState.userAnimations.length > 0) {
            this.dom.myAnimationsPanel.classList.remove('hidden');
            this.dom.myAnimationsList.innerHTML = '';
            this.uiState.userAnimations.forEach(anim => {
                const li = document.createElement('li');
                li.textContent = `${anim.name} (ID: ${anim.id})`;
                li.dataset.id = anim.id;
                li.style.cursor = 'pointer';
                this.dom.myAnimationsList.appendChild(li);
            });
        } else {
            this.dom.myAnimationsPanel.classList.add('hidden');
        }

        // --- NEW UI SYNC LOGIC ---
        this.dom.pointIdInput.value = this.uiState.activePointId || this.uiState.pointIdInput;
        this.dom.clickToAddToggle.checked = this.uiState.isClickToAddMode;

        // Render Feature List
        this.dom.featureList.innerHTML = '';
        this.uiState.animationFeatures.forEach(feature => {
            const li = document.createElement('li');
            li.textContent = `${feature.name} (ID: ...${feature.id.slice(-6)})`;
            li.dataset.id = feature.id;
            li.style.cursor = 'pointer';
            if (feature.id === this.uiState.activeFeatureId) {
                li.style.backgroundColor = '#cce5ff';
            }
            this.dom.featureList.appendChild(li);
        });

        // Render Point List
        this.dom.pointList.innerHTML = '';
        this.uiState.activeFeaturePoints.forEach(point => {
            const li = document.createElement('li');
            li.textContent = `Point ID: ...${point.id.slice(-6)}`;
            li.dataset.id = point.id;
            li.style.cursor = 'pointer';
            if (point.id === this.uiState.activePointId) {
                li.style.backgroundColor = '#cce5ff';
            }
            this.dom.pointList.appendChild(li);
        });
        // --- END NEW UI SYNC LOGIC ---


        // Rest of the UI
        this.dom.animNameInput.value = this.uiState.currentAnimationName;
        this.dom.wasmNameSpan.textContent = this.uiState.wasmAnimationName;
        this.dom.loadIdInput.value = this.uiState.animationIdToLoad;
        this.dom.statusMessageDiv.textContent = this.uiState.statusMessage;
        this.dom.totalFramesInput.value = this.uiState.totalFrames;
        this.dom.frameSlider.value = this.uiState.currentFrame;
        this.dom.frameSlider.max = this.uiState.totalFrames;
        this.dom.currentFrameDisplay.textContent = this.uiState.currentFrame;
        this.dom.maxFrameDisplay.textContent = this.uiState.totalFrames;
        this.dom.activeFeatureIdDisplay.textContent = this.uiState.activeFeatureId ? `...${this.uiState.activeFeatureId.slice(-6)}` : 'None';
        this.dom.featureNameInput.value = this.uiState.featureNameInput;
        this.dom.featureTypeSelect.value = this.uiState.featureTypeInput;
        this.dom.featureAppearanceFrameInput.value = this.uiState.featureAppearanceFrameInput;
        this.dom.featureDisappearanceFrameInput.value = this.uiState.featureDisappearanceFrameInput;
        this.dom.sphereClickCoordsDisplay.textContent = `(x: ${this.uiState.lastSphereClickCoords.x.toFixed(2)}, y: ${this.uiState.lastSphereClickCoords.y.toFixed(2)}, z: ${this.uiState.lastSphereClickCoords.z.toFixed(2)})`;
    }

    updateStatus(message) {
        this.uiState.statusMessage = message;
        this.syncUIToState();
    }

    async checkAuthState() {
        try {
            const userData = await this.apiClient.getMe();
            this.uiState.isAuthenticated = true;
            this.uiState.user = userData;
            this.updateStatus(`Logged in as ${userData.display_name}.`);
            await this.loadUserAnimations();
        } catch (error) {
            this.uiState.isAuthenticated = false;
            this.uiState.user = null;
            this.updateStatus('Not logged in. Feel free to explore!');
        } finally {
            this.syncUIToState();
        }
    }

    async loadUserAnimations() {
        if (!this.uiState.isAuthenticated) return;
        try {
            this.uiState.userAnimations = await this.apiClient.getMyAnimations();
        } catch (error) {
            console.error('Could not load user animations:', error);
            this.updateStatus(`Error: Could not load your animations.`);
            this.uiState.userAnimations = [];
        }
    }

    async init() {
        if (this.initialized) return;
        console.log('Initializing Klyja application (Feature Edition)...');
        this.cacheDOMElements();
        this.updateStatus('Initializing components...');
        
        try {
            this.wasmManager = new WasmManager();
            await this.wasmManager.init();
            this.uiState.wasmAnimationName = this.wasmManager.getAnimationName();
            this.uiState.currentAnimationName = this.uiState.wasmAnimationName;
            this.uiState.totalFrames = this.wasmManager.getTotalFrames();
            this.uiState.featureDisappearanceFrameInput = this.uiState.totalFrames;

            this.apiClient = new ApiClient();
            this.viewer = new ThreeViewer('viewer-container', { sphereRadius: 1 });
            this.viewer.init();
            this.viewer.onSphereClick = (x, y, z) => this.handleSphereClick(x, y, z);
            
            this.bindUIEvents(); // Bind events after caching
            
            await this.checkAuthState(); // Check login status
            
            this.syncUIToState(); // Initial sync
            this.renderCurrentFrame();
            this.initialized = true;
        } catch (error) {
            console.error('Error during KlyjaApp initialization:', error);
            this.updateStatus(`Initialization Error: ${error.message || 'Unknown error'}. Check console.`);
            this.initialized = false;
        }
    }
    
    // --- NEW HANDLER METHODS ---

    async refreshFeatureList() {
        if (!this.wasmManager?.initialized) return;
        try {
            this.uiState.animationFeatures = await this.wasmManager.getFeatures();
            this.syncUIToState();
        } catch (e) {
            this.updateStatus(`Error refreshing features: ${e.message}`);
        }
    }

    async refreshPointList(featureId) {
        if (!this.wasmManager?.initialized || !featureId) {
            this.uiState.activeFeaturePoints = [];
            this.syncUIToState();
            return;
        }
        try {
            this.uiState.activeFeaturePoints = await this.wasmManager.getPointsForFeature(featureId);
            this.syncUIToState();
        } catch(e) {
            this.updateStatus(`Error refreshing points: ${e.message}`);
        }
    }
    
    async handleSelectFeature(featureId) {
        if (!this.wasmManager?.initialized) return;
        try {
            this.wasmManager.setActiveFeature(featureId);
            this.uiState.activeFeatureId = featureId;
            this.uiState.activePointId = null; // Deselect point when feature changes
            this.uiState.pointIdInput = ''; // Clear manual input
            this.updateStatus(`Active feature set to: ${featureId.slice(0, 12)}...`);
            await this.refreshPointList(featureId); // This calls syncUIToState
        } catch(e) {
            this.updateStatus(`Error setting active feature: ${e.message}`);
        }
    }

    handleSelectPoint(pointId) {
        this.uiState.activePointId = pointId;
        this.uiState.pointIdInput = pointId; // Also populate the text input
        this.updateStatus(`Selected point: ${pointId.slice(0, 12)}...`);
        this.syncUIToState();
    }

    // --- MODIFIED HANDLER METHODS ---

    handleCreateFeature() {
        if (!this.wasmManager?.initialized) {
            this.updateStatus('WASM not ready.'); return;
        }
        try {
            const { featureNameInput, featureTypeInput, featureAppearanceFrameInput, featureDisappearanceFrameInput } = this.uiState;
            const featureId = this.wasmManager.createFeature(featureNameInput, featureTypeInput, featureAppearanceFrameInput, featureDisappearanceFrameInput);
            this.uiState.activeFeatureId = featureId;
            this.updateStatus(`Created feature '${featureNameInput}'. It is now active.`);
            
            // Refresh lists
            this.refreshFeatureList();
            this.refreshPointList(featureId);

            this.syncUIToState();
            this.renderCurrentFrame();
        } catch (e) {
            this.updateStatus(`Error creating feature: ${e.message || e}`);
            console.error("Error creating feature:", e);
        }
    }

    handleAddKeyframeToPoint() {
        if (!this.wasmManager?.initialized) {
            this.updateStatus('WASM not ready.'); return;
        }
        if (!this.uiState.activeFeatureId) {
            this.updateStatus('No active feature selected.'); return;
        }
        
        // Use the point selected from the list, or fallback to the text input
        const pointIdToUse = this.uiState.activePointId || this.uiState.pointIdInput;

        if (!pointIdToUse) {
            this.updateStatus('Please select a point or enter an ID to add a keyframe to.'); return;
        }
        try {
            const { activeFeatureId, currentFrame, lastSphereClickCoords: { x, y, z } } = this.uiState;
            this.wasmManager.addPositionKeyframeToPoint(activeFeatureId, pointIdToUse, currentFrame, x, y, z);
            this.updateStatus(`Added keyframe to point '${pointIdToUse.slice(0,12)}...' at frame ${currentFrame}.`);
            this.syncUIToState();
            this.renderCurrentFrame();
        } catch (e) {
            this.updateStatus(`Error adding keyframe: ${e.message || e}`);
            console.error("Error adding keyframe:", e);
        }
    }

    handleSphereClick(x, y, z) {
        this.uiState.lastSphereClickCoords = { x, y, z };
        
        // Logic for "click-to-add" mode
        if (this.uiState.isClickToAddMode) {
            if (!this.uiState.activeFeatureId) {
                this.updateStatus('Cannot add point: No active feature selected.');
                return;
            }
            try {
                // Pass empty string for auto-ID generation
                const newPointId = this.wasmManager.addPointToActiveFeature('', this.uiState.currentFrame, x, y, z);
                this.updateStatus(`Added new point '${newPointId.slice(0,12)}...' to feature.`);
                this.refreshPointList(this.uiState.activeFeatureId); // Update the point list
                this.renderCurrentFrame();
            } catch(e) {
                this.updateStatus(`Error adding point: ${e.message || e}`);
                console.error("Error adding point:", e);
            }
        }
        this.syncUIToState();
    }
    
    async loadAnimationWithUIUpdate() {
        const idToLoad = this.uiState.animationIdToLoad;
        const numericId = parseInt(idToLoad);

        if (isNaN(numericId)) {
            this.updateStatus('Please enter a valid number ID to load.');
            return;
        }
        this.updateStatus(`Loading animation ID: ${numericId}...`);
        
        try {
            const protobufData = await this.apiClient.loadAnimation(numericId);
            this.wasmManager.loadAnimationProtobuf(protobufData);
            
            this.uiState.currentAnimationName = this.wasmManager.getAnimationName();
            this.uiState.wasmAnimationName = this.uiState.currentAnimationName;
            this.uiState.totalFrames = this.wasmManager.getTotalFrames();
            this.uiState.currentFrame = 0;
            
            // Reset active selections and refresh lists
            this.uiState.activeFeatureId = null;
            this.uiState.activePointId = null;
            await this.refreshFeatureList();
            await this.refreshPointList(null);

            this.syncUIToState();
            this.renderCurrentFrame();
            
            this.updateStatus(`Animation loaded: '${this.uiState.currentAnimationName}' (ID: ${numericId})`);
        } catch (error) {
            this.updateStatus(`Load failed: ${error.message}`);
            console.error('Load failed:', error);
        }
    }

    // --- UNMODIFIED METHODS ---
    
    renderCurrentFrame() {
        if (!this.viewer || !this.wasmManager?.initialized) {
            console.error("Cannot render - components not ready");
            this.updateStatus('Cannot render: components not fully initialized.');
            return;
        }
        try {
            const vectorData = this.wasmManager.getRenderableLineSegmentsAtFrame(this.uiState.currentFrame);
            this.viewer.renderFeatures(vectorData);
        } catch (e) {
            console.error("Error during renderCurrentFrame:", e);
            this.updateStatus(`Render error: ${e.message || e}`);
        }
    }

    async saveAnimationWithUIUpdate() {
        if (!this.uiState.isAuthenticated) {
            this.updateStatus('You must be logged in to save an animation.');
            return;
        }
        this.updateStatus('Saving animation...');
        try {
            this.wasmManager.setAnimationName(this.uiState.currentAnimationName);
            const protobufData = this.wasmManager.getAnimationProtobuf();
            const result = await this.apiClient.saveAnimation(protobufData);
            this.updateStatus(`Save successful! Animation ID: ${result.id}`);
            this.uiState.animationIdToLoad = result.id.toString();
            await this.loadUserAnimations(); // Refresh list of animations
            this.syncUIToState();
        } catch (error) {
            this.updateStatus(`Save failed: ${error.message || 'Unknown error'}`);
            console.error('Save failed:', error);
        }
    }
    
    dispose() {
        if (this.viewer) {
            this.viewer.dispose();
        }
    }
}

let klyjaApp = null;

const startApp = async () => {
    if (klyjaApp) return;
    klyjaApp = new KlyjaApp();
    try {
        await klyjaApp.init();
    } catch (error) {
        console.error("Error during klyjaApp.init():", error);
        const statusDiv = document.getElementById('status-message-div');
        if (statusDiv) {
            statusDiv.textContent = 'Critical error during application startup. Check console.';
        }
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}
