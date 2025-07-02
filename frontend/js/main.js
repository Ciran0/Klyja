// frontend/js/main.js
import * as THREE from 'three';
import { ThreeViewer } from './three-viewer.js';
import { WasmManager } from './wasm-manager.js';
import { ApiClient } from './api-client.js';

/**
 * The main application class for Klyja.
 * This class acts as the central controller for the entire frontend. It initializes all necessary
 * components (3D viewer, WASM manager, API client), manages the application's UI state,
 * and handles all user interactions by orchestrating the communication between the different parts.
 */
export class KlyjaApp {
	constructor() {
		this.viewer = null;
		this.wasmManager = null;
		this.apiClient = null;
		this.initialized = false;

		/**
		 * The single source of truth for the application's UI state.
		 * All UI elements are rendered based on the values in this object.
		 * @type {object}
		 */
		this.uiState = {
			isAuthenticated: false,
			user: null,
			userAnimations: [],
			currentAnimationName: 'Untitled Animation',
			wasmAnimationName: 'Loading...',
			statusMessage: 'App Loaded.',
			currentFrame: 0,
			totalFrames: 100,
			lastSphereClickCoords: { x: 0, y: 0, z: 0 },
			animationIdToLoad: '',
			// Feature and Point editing state
			animationFeatures: [],      // List of all features in the current animation
			activeFeatureId: null,      // The ID of the feature currently being edited
			activeFeaturePoints: [],    // List of points for the active feature
			activePointId: null,        // The ID of the point currently selected
			activePointPosition: null,   // The position of the active point
			isClickToAddMode: false,    // Toggles whether clicking the sphere adds a point
			// Form input state
			featureNameInput: 'MyFeature',
			featureTypeInput: 1, // 1: Polygon, 2: Polyline
			featureAppearanceFrameInput: 0,
			featureDisappearanceFrameInput: 100,
			pointIdInput: '',
		};

		/**
		 * A cache for frequently accessed DOM elements to avoid repeated queries.
		 * @type {object}
		 */
		this.dom = {};
	}

	/**
	 * Queries the DOM and caches all necessary element references into `this.dom`.
	 * This is called once during initialization for performance.
	 */
	cacheDOMElements() {
		// Auth elements
		this.dom.userAuthPanel = document.getElementById('user-auth-panel');
		this.dom.userInfoPanel = document.getElementById('user-info-panel');
		this.dom.userDisplayName = document.getElementById('user-display-name');
		this.dom.loginPanel = document.getElementById('login-panel');
		this.dom.logoutButton = document.getElementById('logout-button');
		this.dom.myAnimationsPanel = document.getElementById('my-animations-panel');
		this.dom.myAnimationsList = document.getElementById('my-animations-list');

		// Feature/Point list elements
		this.dom.featureList = document.getElementById('feature-list');
		this.dom.pointList = document.getElementById('point-list');
		this.dom.clickToAddToggle = document.getElementById('click-to-add-toggle');

		// Animation and Frame controls
		this.dom.animNameInput = document.getElementById('anim-name-input');
		this.dom.wasmNameSpan = document.getElementById('wasm-name-span');
		this.dom.totalFramesInput = document.getElementById('total-frames-input');
		this.dom.setTotalFramesButton = document.getElementById('set-total-frames-button');
		this.dom.frameSlider = document.getElementById('frame-slider');
		this.dom.currentFrameDisplay = document.getElementById('current-frame-display');
		this.dom.maxFrameDisplay = document.getElementById('max-frame-display');

		// Action Buttons & Inputs
		this.dom.saveButton = document.getElementById('save-button');
		this.dom.loadIdInput = document.getElementById('load-id-input');
		this.dom.loadButton = document.getElementById('load-button');
		this.dom.statusMessageDiv = document.getElementById('status-message-div');
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

	/**
	 * Binds all UI event listeners to their respective DOM elements.
	 * This orchestrates all user interactions with the application.
	 */
	bindUIEvents() {
		// --- Auth & Animation List ---
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

		// --- Feature & Point Selection ---
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

		// --- Animation & Frame Controls ---
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

		this.dom.frameSlider.addEventListener('input', async (e) => { // Make the handler async
			this.uiState.currentFrame = parseInt(e.target.value, 10);
			this.renderCurrentFrame(); // Render the main lines first
			await this.updateSelectionMarkerPosition(); // Then update the marker's position
			this.syncUIToState(); // Finally, update text displays
		});

		// --- Feature & Point Creation/Modification ---
		this.dom.featureNameInput.addEventListener('input', (e) => this.uiState.featureNameInput = e.target.value);
		this.dom.featureTypeSelect.addEventListener('change', (e) => this.uiState.featureTypeInput = parseInt(e.target.value, 10));
		this.dom.featureAppearanceFrameInput.addEventListener('input', (e) => this.uiState.featureAppearanceFrameInput = parseInt(e.target.value, 10));
		this.dom.featureDisappearanceFrameInput.addEventListener('input', (e) => this.uiState.featureDisappearanceFrameInput = parseInt(e.target.value, 10));
		this.dom.createFeatureButton.addEventListener('click', () => this.handleCreateFeature());

		this.dom.pointIdInput.addEventListener('input', (e) => this.uiState.pointIdInput = e.target.value);
		this.dom.addKeyframeButton.addEventListener('click', () => this.handleAddKeyframeToPoint());

		// --- Save/Load ---
		this.dom.saveButton.addEventListener('click', () => this.saveAnimationWithUIUpdate());
		this.dom.loadIdInput.addEventListener('input', (e) => this.uiState.animationIdToLoad = e.target.value);
		this.dom.loadButton.addEventListener('click', () => this.loadAnimationWithUIUpdate());
	}

	/**
	 * Updates the entire DOM to match the current `uiState`.
	 * This function is the heart of the UI rendering, ensuring that what the user sees
	 * is always a reflection of the application's state.
	 */
	syncUIToState() {
		// --- Auth UI ---
		// Shows user info if logged in, otherwise shows the login button.
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

		// --- My Animations List ---
		// Populates the list of the user's saved animations.
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

		// --- Feature and Point Lists ---
		this.dom.pointIdInput.value = this.uiState.activePointId || this.uiState.pointIdInput;
		this.dom.clickToAddToggle.checked = this.uiState.isClickToAddMode;

		// Renders the list of features, highlighting the active one.
		this.dom.featureList.innerHTML = '';
		this.uiState.animationFeatures.forEach(feature => {
			const li = document.createElement('li');
			li.textContent = `${feature.name} (ID: ...${feature.id.slice(-6)})`;
			li.dataset.id = feature.id;
			li.style.cursor = 'pointer';
			if (feature.id === this.uiState.activeFeatureId) {
				li.style.backgroundColor = '#cce5ff'; // Highlight active feature
			}
			this.dom.featureList.appendChild(li);
		});

		// Renders the list of points for the active feature, highlighting the selected one.
		this.dom.pointList.innerHTML = '';
		this.uiState.activeFeaturePoints.forEach(point => {
			const li = document.createElement('li');
			li.textContent = `Point ID: ...${point.id.slice(-6)}`;
			li.dataset.id = point.id;
			li.style.cursor = 'pointer';
			if (point.id === this.uiState.activePointId) {
				li.style.backgroundColor = '#cce5ff'; // Highlight active point
			}
			this.dom.pointList.appendChild(li);
		});

		// --- General UI State ---
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

	/**
	 * Updates the status message displayed to the user.
	 * @param {string} message The message to display.
	 */
	updateStatus(message) {
		this.uiState.statusMessage = message;
		this.syncUIToState();
	}

	/**
	 * Checks the user's authentication status with the backend and updates the UI accordingly.
	 */
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

	/**
	 * Fetches the list of saved animations for the currently authenticated user.
	 */
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

	/**
	 * Initializes the entire application.
	 * This is the main entry point called on page load.
	 */
	async init() {
		if (this.initialized) return;
		console.log('Initializing Klyja application (Feature Edition)...');
		this.cacheDOMElements();
		this.updateStatus('Initializing components...');

		try {
			// 1. Initialize WASM module
			this.wasmManager = new WasmManager();
			await this.wasmManager.init();

			// 2. Initialize API client and 3D viewer
			this.apiClient = new ApiClient();
			this.viewer = new ThreeViewer('viewer-container', { sphereRadius: 1 });
			this.viewer.init();
			this.viewer.onSphereClick = (x, y, z) => this.handleSphereClick(x, y, z);

			// 3. Bind UI events
			this.bindUIEvents();

			// 4. Sync initial state from WASM to UI state
			this.uiState.wasmAnimationName = this.wasmManager.getAnimationName();
			this.uiState.currentAnimationName = this.uiState.wasmAnimationName;
			this.uiState.totalFrames = this.wasmManager.getTotalFrames();
			this.uiState.featureDisappearanceFrameInput = this.uiState.totalFrames;

			// 5. Check login status
			await this.checkAuthState();

			// 6. Final UI sync and first render
			this.syncUIToState();
			this.renderCurrentFrame();
			this.initialized = true;
		} catch (error) {
			console.error('Error during KlyjaApp initialization:', error);
			this.updateStatus(`Initialization Error: ${error.message || 'Unknown error'}. Check console.`);
			this.initialized = false;
		}
	}

	/**
	 * Refreshes the feature list in the UI by fetching it from the WASM module.
	 */
	async refreshFeatureList() {
		if (!this.wasmManager?.initialized) return;
		try {
			this.uiState.animationFeatures = await this.wasmManager.getFeatures();
			this.syncUIToState();
		} catch (e) {
			this.updateStatus(`Error refreshing features: ${e.message}`);
		}
	}

	/**
	 * Refreshes the point list for a given feature ID.
	 * @param {string|null} featureId The ID of the feature whose points to list.
	 */
	async refreshPointList(featureId) {
		if (!this.wasmManager?.initialized || !featureId) {
			this.uiState.activeFeaturePoints = [];
			this.syncUIToState();
			return;
		}
		try {
			this.uiState.activeFeaturePoints = await this.wasmManager.getPointsForFeature(featureId);
			this.syncUIToState();
		} catch (e) {
			this.updateStatus(`Error refreshing points: ${e.message}`);
		}
	}

	/**
	 * Handles the user clicking on a feature in the list.
	 * It sets the feature as active in both the UI state and the WASM module.
	 * @param {string} featureId The ID of the feature to select.
	 */
	async handleSelectFeature(featureId) {
		if (!this.wasmManager?.initialized) return;
		try {
			this.wasmManager.setActiveFeature(featureId);
			this.uiState.activeFeatureId = featureId;
			this.uiState.activePointId = null; // Deselect point when feature changes
			this.uiState.pointIdInput = '';    // Clear manual input
			this.viewer.hideSelectionMarker();
			this.updateStatus(`Active feature set to: ${featureId.slice(0, 12)}...`);
			await this.refreshPointList(featureId);
			this.renderCurrentFrame(); // Re-render to apply the active feature highlight
		} catch (e) {
			this.updateStatus(`Error setting active feature: ${e.message}`);
		}
	}

	/**
	 * Handles the "Create Feature" button click.
	 * It calls the WASM module to create a new feature and then refreshes the UI.
	 */
	handleCreateFeature() {
		if (!this.wasmManager?.initialized) {
			this.updateStatus('WASM not ready.'); return;
		}
		try {
			const { featureNameInput, featureTypeInput, featureAppearanceFrameInput, featureDisappearanceFrameInput } = this.uiState;
			const featureId = this.wasmManager.createFeature(featureNameInput, featureTypeInput, featureAppearanceFrameInput, featureDisappearanceFrameInput);
			this.uiState.activeFeatureId = featureId;
			this.updateStatus(`Created feature '${featureNameInput}'. It is now active.`);

			this.refreshFeatureList();
			this.refreshPointList(featureId);

			this.syncUIToState();
			this.renderCurrentFrame();
		} catch (e) {
			this.updateStatus(`Error creating feature: ${e.message || e}`);
			console.error("Error creating feature:", e);
		}
	}

	/**
	 * Handles the "Add Keyframe" button click.
	 * It adds a new position keyframe to the selected point at the current frame and location.
	 */
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
			this.updateStatus(`Added keyframe to point '${pointIdToUse.slice(0, 12)}...' at frame ${currentFrame}.`);
			this.syncUIToState();
			this.renderCurrentFrame();
		} catch (e) {
			this.updateStatus(`Error adding keyframe: ${e.message || e}`);
			console.error("Error adding keyframe:", e);
		}
	}

	/**
	 * Callback function for when the user clicks on the 3D sphere.
	 * If "click-to-add" mode is active, it adds a new point to the active feature.
	 * @param {number} x The x-coordinate of the click on the unit sphere.
	 * @param {number} y The y-coordinate of the click on the unit sphere.
	 * @param {number} z The z-coordinate of the click on the unit sphere.
	 */
	handleSphereClick(x, y, z) {
		this.uiState.lastSphereClickCoords = { x, y, z };

		// If click-to-add mode is enabled, add a point to the active feature.
		if (this.uiState.isClickToAddMode) {
			if (!this.uiState.activeFeatureId) {
				this.updateStatus('Cannot add point: No active feature selected.');
				return;
			}
			try {
				// Pass an empty string for the ID to let WASM generate one.
				const newPointId = this.wasmManager.addPointToActiveFeature('', this.uiState.currentFrame, x, y, z);
				this.updateStatus(`Added new point '${newPointId.slice(0, 12)}...' to feature.`);
				this.refreshPointList(this.uiState.activeFeatureId); // Update the UI list
				this.renderCurrentFrame();
			} catch (e) {
				this.updateStatus(`Error adding point: ${e.message || e}`);
				console.error("Error adding point:", e);
			}
		}
		this.syncUIToState();
	}


	/**
	 * Handles the user clicking on a point in the list.
	 * It sets the point as active, fetches its current position, and shows the selection marker.
	 * @param {string} pointId The ID of the point to select.
	 */
	async handleSelectPoint(pointId) {
		this.uiState.activePointId = pointId;
		this.uiState.pointIdInput = pointId;
		this.updateStatus(`Selected point: ${pointId.slice(0, 12)}...`);
		await this.updateSelectionMarkerPosition(); // Use a new helper function to update the marker
		this.syncUIToState();
	}

	/**
	 * Helper function to calculate the active point's position and update the viewer.
	 */
	async updateSelectionMarkerPosition() {
		if (this.uiState.activePointId && this.uiState.activeFeatureId && this.wasmManager?.initialized) {
			try {
				// Get the point's position from our new WASM function
				const pos = await this.wasmManager.getInterpolatedPointPosition(
					this.uiState.activeFeatureId,
					this.uiState.activePointId,
					this.uiState.currentFrame
				);

				if (pos) {
					this.uiState.activePointPosition = pos;
					const markerPosition = new THREE.Vector3(pos.x, pos.y, pos.z);
					this.viewer.updateSelectionMarker(markerPosition);
				} else {
					// If the point has no position on this frame, hide the marker
					this.uiState.activePointPosition = null;
					this.viewer.hideSelectionMarker();
				}
			} catch (e) {
				console.error("Error updating selection marker:", e);
				this.updateStatus(`Error showing point: ${e.message}`);
				this.viewer.hideSelectionMarker();
			}
		} else {
			// If there's no active point, hide the marker
			this.viewer.hideSelectionMarker();
		}
	}

	/**
	 * Handles the "Load" button click.
	 * It fetches the animation data from the backend, loads it into the WASM module,
	 * and resets the UI to reflect the new animation's state.
	 */
	async loadAnimationWithUIUpdate() {
		const idToLoad = this.uiState.animationIdToLoad;
		const numericId = parseInt(idToLoad);

		if (isNaN(numericId)) {
			this.updateStatus('Please enter a valid number ID to load.');
			return;
		}
		this.updateStatus(`Loading animation ID: ${numericId}...`);

		try {
			// 1. Fetch data from the API
			const protobufData = await this.apiClient.loadAnimation(numericId);
			// 2. Load data into WASM
			this.wasmManager.loadAnimationProtobuf(protobufData);
			// 3. Update UI state from the new WASM state
			this.uiState.currentAnimationName = this.wasmManager.getAnimationName();
			this.uiState.wasmAnimationName = this.uiState.currentAnimationName;
			this.uiState.totalFrames = this.wasmManager.getTotalFrames();
			this.uiState.currentFrame = 0;
			this.uiState.activeFeatureId = null;
			this.uiState.activePointId = null;
			this.viewer.hideSelectionMarker();
			// 4. Refresh UI lists and re-render
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

	/**
	 * Renders the current frame by getting the necessary vector data from WASM
	 * and passing it to the Three.js viewer.
	 */
	renderCurrentFrame() {
		if (!this.viewer || !this.wasmManager?.initialized) {
			console.error("Cannot render - components not ready");
			this.updateStatus('Cannot render: components not fully initialized.');
			return;
		}
		try {
			// Get renderable data from WASM, passing the active feature ID for highlighting.
			const vectorData = this.wasmManager.getRenderableLineSegmentsAtFrame(
				this.uiState.currentFrame,
				this.uiState.activeFeatureId
			);
			this.viewer.renderFeatures(vectorData);
		} catch (e) {
			console.error("Error during renderCurrentFrame:", e);
			this.updateStatus(`Render error: ${e.message || e}`);
		}
	}

	/**
	 * Handles the "Save" button click.
	 * It gets the serialized animation data from WASM and sends it to the backend.
	 */
	async saveAnimationWithUIUpdate() {
		if (!this.uiState.isAuthenticated) {
			this.updateStatus('You must be logged in to save an animation.');
			return;
		}
		this.updateStatus('Saving animation...');
		try {
			// 1. Ensure the animation name in WASM is up-to-date.
			this.wasmManager.setAnimationName(this.uiState.currentAnimationName);
			// 2. Get serialized data from WASM.
			const protobufData = this.wasmManager.getAnimationProtobuf();
			// 3. Send data to the API.
			const result = await this.apiClient.saveAnimation(protobufData);
			this.updateStatus(`Save successful! Animation ID: ${result.id}`);
			this.uiState.animationIdToLoad = result.id.toString();
			// 4. Refresh the list of user's animations.
			await this.loadUserAnimations();
			this.syncUIToState();
		} catch (error) {
			this.updateStatus(`Save failed: ${error.message || 'Unknown error'}`);
			console.error('Save failed:', error);
		}
	}

	/**
	 * Cleans up resources, such as the Three.js renderer.
	 */
	dispose() {
		if (this.viewer) {
			this.viewer.dispose();
		}
	}
}

let klyjaApp = null;

/**
 * The main entry point for the application.
 */
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

// Start the app once the DOM is ready.
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', startApp);
} else {
	startApp();
}
