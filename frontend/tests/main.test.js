import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Geco } from '/pkg/geco.js';

// Load the module to test
import '../js/main.js';

describe('Main.js functionality', () => {
  beforeEach(() => {
    // Setup DOM environment
    document.body.innerHTML = `
      <div class="main-content" x-data="appState()">
        <div id="viewer-container"></div>
        <aside id="controls-panel">
          <h3>Controls</h3>
          <input type="text" id="anim-name">
          <button id="save-button">Save Animation</button>
          <input type="number" id="load-id">
          <button id="load-button">Load Animation</button>
        </aside>
      </div>
    `;
    
    // Reset mocks
    vi.clearAllMocks();
    
    // Mock fetch responses
    global.fetch.mockImplementation((url) => {
      if (url.includes('/api/save_animation')) {
        return Promise.resolve({
          ok: true,
          status: 201,
          statusText: 'Created'
        });
      } else if (url.includes('/api/load_animation')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3, 4]).buffer)
        });
      }
      return Promise.reject(new Error('Unhandled fetch URL'));
    });
  });
  
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  it('should initialize Three.js components', async () => {
    // Allow the async startApp function to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify Three.js components were initialized
    expect(THREE.Scene).toHaveBeenCalled();
    expect(THREE.PerspectiveCamera).toHaveBeenCalled();
    expect(THREE.WebGLRenderer).toHaveBeenCalled();
    expect(OrbitControls).toHaveBeenCalled();
  });
  
  it('should initialize Geco WASM instance', async () => {
    // Allow the async startApp function to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify WASM was initialized
    expect(Geco).toHaveBeenCalled();
    expect(window.gecoInstance).toBeDefined();
  });
  
  it('should save animation data when saveAnimationData is called', async () => {
    // Allow the async startApp function to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify the save function exists
    expect(window.saveWasmData).toBeDefined();
    
    // Call the save function
    await window.saveWasmData();
    
    // Verify fetch was called with the right params
    expect(global.fetch).toHaveBeenCalledWith('/api/save_animation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream'
      },
      body: expect.any(Uint8Array)
    });
  });
  
  it('should load animation data when loadAnimationData is called', async () => {
    // Allow the async startApp function to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify the load function exists
    expect(window.loadWasmData).toBeDefined();
    
    // Call the load function
    const result = await window.loadWasmData(1);
    
    // Verify fetch was called with the right params
    expect(global.fetch).toHaveBeenCalledWith('/api/load_animation/1');
    
    // Verify WASM function was called
    expect(window.gecoInstance.load_animation_protobuf).toHaveBeenCalled();
    
    // Verify we get the animation name back
    expect(result).toBe('Test Animation');
  });
});