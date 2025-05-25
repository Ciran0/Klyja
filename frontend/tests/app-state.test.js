// frontend/tests/app-state.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAppState } from '../js/app-state.js';

describe('App State', () => {
  let appState;
  let mockDeps;

  beforeEach(() => {
    mockDeps = {
      gecoInstance: {
        get_animation_name: vi.fn().mockReturnValue('Test Animation'),
        set_animation_name: vi.fn(),
        add_static_polygon: vi.fn()
      },
      saveWasmData: vi.fn().mockResolvedValue(),
      loadWasmData: vi.fn().mockResolvedValue('Loaded Animation'),
      renderWasmState: vi.fn()
    };

    appState = createAppState();
    appState.initWithDeps(mockDeps);
  });

  describe('initialization', () => {
    it('should have default values', () => {
      const freshState = createAppState();
      expect(freshState.currentAnimationName).toBe('Untitled');
      expect(freshState.wasmAnimationName).toBe('Loading...');
      expect(freshState.newPolygonId).toBe('poly1');
      expect(freshState.animationIdToLoad).toBe('');
      expect(freshState.statusMessage).toBe('App Loaded.');
    });

    it('should wait for WASM and update state', async () => {
      await appState.init();

      expect(appState.wasmAnimationName).toBe('Test Animation');
      expect(appState.currentAnimationName).toBe('Test Animation');
      expect(appState.statusMessage).toBe('Ready.');
    });

    it('should handle WASM timeout', async () => {
      appState.initWithDeps({ ...mockDeps, gecoInstance: null });
      
      await expect(appState.waitForWasm(100)).rejects.toThrow('WASM failed to initialize');
    });
  });

  describe('updateWasmName', () => {
    it('should update WASM name and UI state', () => {
      const newName = 'New Animation Name';
      mockDeps.gecoInstance.get_animation_name.mockReturnValue(newName);
      
      appState.updateWasmName(newName);

      expect(mockDeps.gecoInstance.set_animation_name).toHaveBeenCalledWith(newName);
      expect(appState.wasmAnimationName).toBe(newName);
      expect(appState.statusMessage).toContain(newName);
    });

    it('should handle missing gecoInstance', () => {
      appState.initWithDeps({ ...mockDeps, gecoInstance: null });
      
      appState.updateWasmName('Test');
      
      expect(appState.statusMessage).toContain('Error');
    });
  });

  describe('addPolygonPlaceholder', () => {
    it('should add polygon and update UI', () => {
      appState.newPolygonId = 'poly42';
      appState.addPolygonPlaceholder();

      expect(mockDeps.gecoInstance.add_static_polygon).toHaveBeenCalledWith('poly42', 0.0, 5.0);
      expect(mockDeps.renderWasmState).toHaveBeenCalled();
      expect(appState.statusMessage).toContain('Added polygon poly42');
      expect(appState.newPolygonId).toBe('poly43');
    });

    it('should increment polygon ID correctly', () => {
      appState.newPolygonId = 'poly1';
      appState.addPolygonPlaceholder();
      expect(appState.newPolygonId).toBe('poly2');

      appState.addPolygonPlaceholder();
      expect(appState.newPolygonId).toBe('poly3');
    });

    it('should handle missing gecoInstance', () => {
      appState.initWithDeps({ ...mockDeps, gecoInstance: null });
      
      appState.addPolygonPlaceholder();
      
      expect(appState.statusMessage).toContain('Error');
      expect(mockDeps.renderWasmState).not.toHaveBeenCalled();
    });

    it('should handle missing polygon ID', () => {
      appState.newPolygonId = '';
      
      appState.addPolygonPlaceholder();
      
      expect(appState.statusMessage).toContain('Error');
      expect(mockDeps.gecoInstance.add_static_polygon).not.toHaveBeenCalled();
    });
  });

  describe('saveAnimation', () => {
    it('should save successfully', async () => {
      await appState.saveAnimation();

      expect(mockDeps.saveWasmData).toHaveBeenCalled();
      expect(appState.statusMessage).toBe('Save successful!');
    });

    it('should handle save errors', async () => {
      const error = new Error('Network error');
      mockDeps.saveWasmData.mockRejectedValue(error);

      await appState.saveAnimation();

      expect(appState.statusMessage).toBe('Save failed: Network error');
    });

    it('should handle missing save function', async () => {
      appState.initWithDeps({ ...mockDeps, saveWasmData: null });

      await appState.saveAnimation();

      expect(appState.statusMessage).toContain('Error: Save function not ready');
    });
  });

  describe('loadAnimation', () => {
    it('should load animation successfully', async () => {
      appState.animationIdToLoad = '123';

      await appState.loadAnimation();

      expect(mockDeps.loadWasmData).toHaveBeenCalledWith(123);
      expect(appState.wasmAnimationName).toBe('Loaded Animation');
      expect(appState.currentAnimationName).toBe('Loaded Animation');
      expect(appState.statusMessage).toContain('Load successful');
      expect(appState.statusMessage).toContain('ID: 123');
      expect(appState.statusMessage).toContain("Name: 'Loaded Animation'");
    });

    it('should validate numeric ID', async () => {
      appState.animationIdToLoad = 'invalid';

      await appState.loadAnimation();

      expect(mockDeps.loadWasmData).not.toHaveBeenCalled();
      expect(appState.statusMessage).toContain('valid number');
    });

    it('should handle load errors', async () => {
      appState.animationIdToLoad = '123';
      const error = new Error('Not found');
      mockDeps.loadWasmData.mockRejectedValue(error);

      await appState.loadAnimation();

      expect(appState.statusMessage).toBe('Load failed: Not found');
    });

    it('should handle missing load function', async () => {
      appState.initWithDeps({ ...mockDeps, loadWasmData: null });
      appState.animationIdToLoad = '123';

      await appState.loadAnimation();

      expect(appState.statusMessage).toContain('Error: Load function');
    });
  });
});
