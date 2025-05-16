import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Alpine.js functionality', () => {
  let appStateObj;
  
  beforeEach(() => {
    // Import the appState function from index.html
    const html = document.createElement('div');
    html.innerHTML = document.querySelector('html');
    const scriptContent = Array.from(document.querySelectorAll('script'))
      .filter(script => !script.src && script.textContent.includes('appState'))
      .map(script => script.textContent)
      .join('\\n');
    
    // Extract the appState function
    const appStateFn = new Function(`
      ${scriptContent};
      return appState;
    `)();
    
    // Create an instance of the appState object
    appStateObj = appStateFn();
    
    // Setup window.gecoInstance mock
    window.gecoInstance = {
      get_animation_name: vi.fn().mockReturnValue('Test Animation'),
      set_animation_name: vi.fn(),
      add_static_polygon: vi.fn()
    };
    
    // Setup window.renderWasmState mock
    window.renderWasmState = vi.fn();
    
    // Setup window.saveWasmData and window.loadWasmData mocks
    window.saveWasmData = vi.fn().mockResolvedValue(undefined);
    window.loadWasmData = vi.fn().mockResolvedValue('Loaded Animation');
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should initialize with default values', () => {
    expect(appStateObj.currentAnimationName).toBe('Untitled');
    expect(appStateObj.wasmAnimationName).toBe('Loading...');
    expect(appStateObj.newPolygonId).toBe('poly1');
    expect(appStateObj.statusMessage).toBe('App Loaded.');
  });
  
  it('should update WASM name when updateWasmName is called', () => {
    appStateObj.updateWasmName('New Name');
    
    expect(window.gecoInstance.set_animation_name).toHaveBeenCalledWith('New Name');
    expect(window.gecoInstance.get_animation_name).toHaveBeenCalled();
    expect(appStateObj.wasmAnimationName).toBe('Test Animation');
  });
  
  it('should add polygon when addPolygonPlaceholder is called', () => {
    appStateObj.addPolygonPlaceholder();
    
    expect(window.gecoInstance.add_static_polygon).toHaveBeenCalledWith('poly1', 0.0, 5.0);
    expect(window.renderWasmState).toHaveBeenCalled();
    expect(appStateObj.newPolygonId).toBe('poly2');
  });
  
  it('should save animation when saveAnimation is called', async () => {
    await appStateObj.saveAnimation();
    
    expect(window.saveWasmData).toHaveBeenCalled();
    expect(appStateObj.statusMessage).toBe('Save successful!');
  });
  
  it('should load animation when loadAnimation is called', async () => {
    appStateObj.animationIdToLoad = '1';
    await appStateObj.loadAnimation();
    
    expect(window.loadWasmData).toHaveBeenCalledWith(1);
    expect(appStateObj.wasmAnimationName).toBe('Loaded Animation');
    expect(appStateObj.currentAnimationName).toBe('Loaded Animation');
  });
  
  it('should handle errors when saving animation', async () => {
    window.saveWasmData.mockRejectedValue(new Error('Save error'));
    
    await appStateObj.saveAnimation();
    
    expect(appStateObj.statusMessage).toBe('Save failed: Save error');
  });
  
  it('should handle errors when loading animation', async () => {
    window.loadWasmData.mockRejectedValue(new Error('Load error'));
    
    appStateObj.animationIdToLoad = '1';
    await appStateObj.loadAnimation();
    
    expect(appStateObj.statusMessage).toBe('Load failed: Load error');
  });
});