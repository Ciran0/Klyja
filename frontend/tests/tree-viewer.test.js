import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ThreeViewer } from '../js/three-viewer.js';
import * as THREE_MODULE from 'three'; // Import the entire module
import { OrbitControls as OrbitControlsConstructorMock } from 'three/addons/controls/OrbitControls.js';

// Get the mocked THREE classes from the imported module
const MockScene = THREE_MODULE.Scene;
const MockPerspectiveCamera = THREE_MODULE.PerspectiveCamera;
const MockWebGLRenderer = THREE_MODULE.WebGLRenderer;
const MockMesh = THREE_MODULE.Mesh;
const MockLine = THREE_MODULE.Line;
const MockLineLoop = THREE_MODULE.LineLoop;
const MockBufferGeometry = THREE_MODULE.BufferGeometry; 
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
      // Ensure geometry is defined on the mock mesh instance before accessing parameters
      if (viewer.mainSphereMesh.geometry) {
        expect(viewer.mainSphereMesh.geometry.parameters.radius).toBe(1);
      } else {
        throw new Error("MockMesh instance does not have geometry defined as expected.");
      }
    });

    it('should set up OrbitControls', () => { // Removed async as import is at top
      expect(viewer.controls).toBeInstanceOf(OrbitControlsConstructorMock); 
    });
  });

  describe('renderFeatures', () => {
    it('should clear previous visual objects before rendering new ones', () => {
      const initialObject = { type: 'TestObject' };
      // Ensure scene mock instance is used if add is an instance method
      const sceneInstance = MockScene.mock.instances[0] || viewer.scene;
      sceneInstance.add(initialObject);
      viewer.visualObjects.push(initialObject);
      const sceneRemoveSpy = vi.spyOn(sceneInstance, 'remove');
      viewer.renderFeatures([]);
      expect(sceneRemoveSpy).toHaveBeenCalledWith(initialObject);
      expect(viewer.visualObjects).toHaveLength(0);
    });

    it('should render Polyline features correctly', () => {
      MockBufferGeometry.mockClear(); 
      const sceneInstance = MockScene.mock.instances[0] || viewer.scene;
      if (sceneInstance.add.mockClear) sceneInstance.add.mockClear();


      const featuresData = [
        {
          feature_id: 'line1',
          name: 'Test Line',
          feature_type: 'Polyline',
          points: [ { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 } ],
          properties: {},
        },
      ];
      viewer.renderFeatures(featuresData);

      expect(viewer.visualObjects).toHaveLength(1);
      const renderedObject = viewer.visualObjects[0];
      expect(renderedObject).toBeInstanceOf(MockLine);
      
      expect(MockBufferGeometry).toHaveBeenCalledTimes(1); 
      const bufferGeometryInstance = MockBufferGeometry.mock.instances[0]; 
      expect(bufferGeometryInstance.setFromPoints).toHaveBeenCalled();
      expect(sceneInstance.add).toHaveBeenCalledWith(renderedObject);
    });

    it('should render Polygon features as LineLoop correctly', () => {
      MockBufferGeometry.mockClear();
      const sceneInstance = MockScene.mock.instances[0] || viewer.scene;
      if (sceneInstance.add.mockClear) sceneInstance.add.mockClear();


      const featuresData = [
        {
          feature_id: 'poly1',
          name: 'Test Polygon',
          feature_type: 'Polygon',
          points: [ { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }, { x: 0, y: 1, z: 1 } ],
          properties: {},
        },
      ];
      viewer.renderFeatures(featuresData);

      expect(viewer.visualObjects).toHaveLength(1);
      const renderedObject = viewer.visualObjects[0];
      expect(renderedObject).toBeInstanceOf(MockLineLoop);
      expect(MockBufferGeometry).toHaveBeenCalledTimes(1); 
      const bufferGeometryInstance = MockBufferGeometry.mock.instances[0];
      expect(bufferGeometryInstance.setFromPoints).toHaveBeenCalled();
      expect(sceneInstance.add).toHaveBeenCalledWith(renderedObject);
    });

    it('should not render Polyline with less than 2 points', () => {
      const featuresData = [ { feature_type: 'Polyline', points: [{ x: 0, y: 0, z: 1 }] } ];
      viewer.renderFeatures(featuresData);
      expect(viewer.visualObjects).toHaveLength(0);
    });
    
    it('should not render Polygon with less than 2 points (for LineLoop)', () => {
      const featuresData = [ { feature_type: 'Polygon', points: [{ x: 0, y: 0, z: 1 }] } ];
      viewer.renderFeatures(featuresData);
      expect(viewer.visualObjects).toHaveLength(0);
    });

    it('should handle features with no points', () => {
      const featuresData = [{ feature_type: 'Polyline', points: [] }];
      viewer.renderFeatures(featuresData);
      expect(viewer.visualObjects).toHaveLength(0);
    });

    it('should handle features with undefined points array', () => {
      const featuresData = [{ feature_type: 'Polyline' }];
      viewer.renderFeatures(featuresData);
      expect(viewer.visualObjects).toHaveLength(0);
    });
    
    it('should use default z=0 if point.z is undefined', () => {
       MockVector3.mockClear(); 
       const featuresData = [ { feature_type: 'Polyline', points: [ { x: 0, y: 0 }, { x: 1, y: 1 } ] } ];
       viewer.renderFeatures(featuresData);
      
       expect(MockVector3).toHaveBeenCalledWith(0,0,0);
       expect(MockVector3).toHaveBeenCalledWith(1,1,0);
       expect(viewer.visualObjects).toHaveLength(1);
    });
  });

  describe('sphere click callback', () => {
    it('should call onSphereClick with normalized coordinates if callback is set', () => {
      const mockOnSphereClick = vi.fn();
      viewer.onSphereClick = mockOnSphereClick;

      viewer.renderer.domElement.getBoundingClientRect = vi.fn(() => ({
        left: 0, top: 0, width: 800, height: 600,
      }));
      
      const intersectedPoint = new MockVector3(2, 3, 6); 
      const normalizedPoint = intersectedPoint.clone().normalize(); 
                                                               
      viewer.onSphereClick(normalizedPoint.x, normalizedPoint.y, normalizedPoint.z);
         
      expect(mockOnSphereClick).toHaveBeenCalledWith(
        expect.closeTo(2/7), 
        expect.closeTo(3/7), 
        expect.closeTo(6/7)
      );
    });
  });

  describe('dispose', () => {
    it('should call dispose on renderer and controls', () => {
      const rendererDisposeSpy = vi.spyOn(viewer.renderer, 'dispose');
      const controlsDisposeSpy = vi.spyOn(viewer.controls, 'dispose');
      
      viewer.dispose();
      
      expect(rendererDisposeSpy).toHaveBeenCalled();
      expect(controlsDisposeSpy).toHaveBeenCalled();
    });

    it('should remove the renderer DOM element', () => {
       const rendererDomElement = viewer.renderer.domElement;
       const removeSpy = vi.spyOn(rendererDomElement, 'remove');
       viewer.dispose();
       expect(removeSpy).toHaveBeenCalled();
    });
  });
});
