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
            pointIdInput: 'p1',
            animationIdToLoad: ''
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
        this.dom.addPointButton = document.getElementById('add-point-button');
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
        this.dom.addPointButton.addEventListener('click', () => this.handleAddPointToFeature());
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
                this.dom.myAnimationsList.appendChild(li);
            });
        } else {
            this.dom.myAnimationsPanel.classList.add('hidden');
        }

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
        this.dom.activeFeatureIdDisplay.textContent = this.uiState.activeFeatureId || 'None';
        this.dom.featureNameInput.value = this.uiState.featureNameInput;
        this.dom.featureTypeSelect.value = this.uiState.featureTypeInput;
        this.dom.featureAppearanceFrameInput.value = this.uiState.featureAppearanceFrameInput;
        this.dom.featureDisappearanceFrameInput.value = this.uiState.featureDisappearanceFrameInput;
        this.dom.pointIdInput.value = this.uiState.pointIdInput;
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
            
            this.syncUIToState();
            this.bindUIEvents();
            
            await this.checkAuthState(); // Check login status
            
            this.renderCurrentFrame();
            this.initialized = true;
        } catch (error) {
            console.error('Error during KlyjaApp initialization:', error);
            this.updateStatus(`Initialization Error: ${error.message || 'Unknown error'}. Check console.`);
            this.initialized = false;
        }
    }

    handleCreateFeature() {
        if (!this.wasmManager?.initialized) {
            this.updateStatus('WASM not ready.'); return;
        }
        try {
            const { featureNameInput, featureTypeInput, featureAppearanceFrameInput, featureDisappearanceFrameInput } = this.uiState;
            const featureId = this.wasmManager.createFeature(featureNameInput, featureTypeInput, featureAppearanceFrameInput, featureDisappearanceFrameInput);
            this.uiState.activeFeatureId = featureId;
            this.updateStatus(`Created feature '${featureNameInput}' (ID: ${featureId}). It is now active.`);
            this.syncUIToState();
            this.renderCurrentFrame();
        } catch (e) {
            this.updateStatus(`Error creating feature: ${e.message || e}`);
            console.error("Error creating feature:", e);
        }
    }

    handleAddPointToFeature() {
        if (!this.wasmManager?.initialized) {
            this.updateStatus('WASM not ready.'); return;
        }
        if (!this.uiState.activeFeatureId) {
            this.updateStatus('No active feature selected to add point to.'); return;
        }
        try {
            const { pointIdInput, currentFrame, lastSphereClickCoords: { x, y, z } } = this.uiState;
            const newPointId = this.wasmManager.addPointToActiveFeature(pointIdInput, currentFrame, x, y, z);
            this.updateStatus(`Added point '${newPointId}' to feature '${this.uiState.activeFeatureId}' at frame ${currentFrame}.`);
            if (!pointIdInput) this.uiState.pointIdInput = newPointId;
            this.syncUIToState();
            this.renderCurrentFrame();
        } catch (e) {
            this.updateStatus(`Error adding point: ${e.message || e}`);
            console.error("Error adding point:", e);
        }
    }
    
    handleAddKeyframeToPoint() {
        if (!this.wasmManager?.initialized) {
            this.updateStatus('WASM not ready.'); return;
        }
        if (!this.uiState.activeFeatureId) {
            this.updateStatus('No active feature selected.'); return;
        }
        if (!this.uiState.pointIdInput) {
            this.updateStatus('Please enter a Point ID to add a keyframe to.'); return;
        }
        try {
            const { activeFeatureId, pointIdInput, currentFrame, lastSphereClickCoords: { x, y, z } } = this.uiState;
            this.wasmManager.addPositionKeyframeToPoint(activeFeatureId, pointIdInput, currentFrame, x, y, z);
            this.updateStatus(`Added keyframe to point '${pointIdInput}' in feature '${activeFeatureId}' at frame ${currentFrame}.`);
            this.syncUIToState();
            this.renderCurrentFrame();
        } catch (e) {
            this.updateStatus(`Error adding keyframe: ${e.message || e}`);
            console.error("Error adding keyframe:", e);
        }
    }

    handleSphereClick(x, y, z) {
        this.uiState.lastSphereClickCoords = { x, y, z };
        this.syncUIToState();
    }
    
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
            
            this.syncUIToState();
            this.renderCurrentFrame();
            
            this.updateStatus(`Animation loaded: '${this.uiState.currentAnimationName}' (ID: ${numericId})`);
        } catch (error) {
            this.updateStatus(`Load failed: ${error.message}`);
            console.error('Load failed:', error);
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
