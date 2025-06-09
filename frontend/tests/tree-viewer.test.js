import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ThreeViewer } from '../js/three-viewer.js';
import * as THREE_MODULE from 'three'; 
import { OrbitControls as OrbitControlsConstructorMock } from 'three/addons/controls/OrbitControls.js';

const MockScene = THREE_MODULE.Scene;
const MockPerspectiveCamera = THREE_MODULE.PerspectiveCamera;
const MockWebGLRenderer = THREE_MODULE.WebGLRenderer;
const MockMesh = THREE_MODULE.Mesh;
const MockVector3 = THREE_MODULE.Vector3; 


describe('ThreeViewer', () => {
  let viewer;
  let container;

  beforeEach(() => {
    vi.clearAllMocks(); 
    container = document.createElement('div');
    container.id = 'viewer-test-container';
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true });
    document.body.appendChild(container);

    viewer = new ThreeViewer('viewer-test-container', { sphereRadius: 1 });
    viewer.init();
  });

  afterEach(() => {
    if (viewer) {
      viewer.dispose();
    }
    container.remove();
  });

  describe('initialization', () => {
    it('should initialize with correct SPHERE_RADIUS from options', () => {
      expect(viewer.SPHERE_RADIUS).toBe(1);
    });

    it('should create a scene, camera, renderer, and main sphere', () => {
      expect(viewer.scene).toBeInstanceOf(MockScene);
      expect(viewer.camera).toBeInstanceOf(MockPerspectiveCamera);
      expect(viewer.renderer).toBeInstanceOf(MockWebGLRenderer); 
      expect(viewer.mainSphereMesh).toBeInstanceOf(MockMesh);
      if (viewer.mainSphereMesh.geometry) {
        expect(viewer.mainSphereMesh.geometry.parameters.radius).toBe(1);
      } else {
        throw new Error("MockMesh instance does not have geometry defined as expected.");
      }
    });

    it('should set up OrbitControls', () => {
      expect(viewer.controls).toBeInstanceOf(OrbitControlsConstructorMock); 
    });
  });

  describe('renderFeatures', () => {
    it('should update shader uniforms when rendering features', () => {
        const vectorData = {
            vertex_data: new Float32Array([1, 0, 0, 1, 0, 1, 0, 1]), // 1 segment
            segment_count: 1
        };

        const textureSetSpy = vi.spyOn(viewer.lineTexture.image.data, 'set');

        viewer.renderFeatures(vectorData);
        
        expect(viewer.mainSphereMesh.material.uniforms.u_line_count.value).toBe(1);
        expect(textureSetSpy).toHaveBeenCalledWith(vectorData.vertex_data);
        expect(viewer.lineTexture.needsUpdate).toBe(true);
    });
    
    it('should handle empty vectorData gracefully', () => {
        const vectorData = { vertex_data: new Float32Array(), segment_count: 0 };
        
        const textureSetSpy = vi.spyOn(viewer.lineTexture.image.data, 'set');

        // It should not throw an error
        expect(() => viewer.renderFeatures(vectorData)).not.toThrow();
        
        // Check that uniforms are updated correctly
        expect(viewer.mainSphereMesh.material.uniforms.u_line_count.value).toBe(0);
        expect(textureSetSpy).toHaveBeenCalledWith(vectorData.vertex_data);
    });

    it('should handle null or undefined vectorData by doing nothing', () => {
        const initialCount = viewer.mainSphereMesh.material.uniforms.u_line_count.value;
        
        viewer.renderFeatures(null);
        expect(viewer.mainSphereMesh.material.uniforms.u_line_count.value).toBe(initialCount);

        viewer.renderFeatures(undefined);
        expect(viewer.mainSphereMesh.material.uniforms.u_line_count.value).toBe(initialCount);
    });
  });

  describe('sphere click callback', () => {
    it('should call onSphereClick with normalized coordinates if callback is set', () => {
      const mockOnSphereClick = vi.fn();
      viewer.onSphereClick = mockOnSphereClick;

      // Mock the raycaster logic inside the test since it's complex
      const raycaster = {
          setFromCamera: vi.fn(),
          intersectObject: vi.fn().mockReturnValue([{ point: new MockVector3(2, 3, 6) }])
      };
      THREE_MODULE.Raycaster = vi.fn(() => raycaster);

      // Re-run setupRaycasting with the new mock
      viewer.setupRaycasting();
      
      const clickEvent = new MouseEvent('click', { clientX: 100, clientY: 100 });
      viewer.renderer.domElement.dispatchEvent(clickEvent);
         
      expect(mockOnSphereClick).toHaveBeenCalledWith(
        expect.closeTo(2/7), 
        expect.closeTo(3/7), 
        expect.closeTo(6/7)
      );
    });
  });

  describe('dispose', () => {
    it('should call dispose on renderer and controls and cancel animation frame', () => {
      const rendererDisposeSpy = vi.spyOn(viewer.renderer, 'dispose');
      const controlsDisposeSpy = vi.spyOn(viewer.controls, 'dispose');
      const cancelAnimationFrameSpy = vi.spyOn(global, 'cancelAnimationFrame');
      
      viewer.dispose();
      
      expect(rendererDisposeSpy).toHaveBeenCalled();
      expect(controlsDisposeSpy).toHaveBeenCalled();
      expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(viewer.animationFrameId);
    });

    it('should remove the renderer DOM element', () => {
       const rendererDomElement = viewer.renderer.domElement;
       const removeSpy = vi.spyOn(rendererDomElement, 'remove');
       viewer.dispose();
       expect(removeSpy).toHaveBeenCalled();
    });
  });
});
