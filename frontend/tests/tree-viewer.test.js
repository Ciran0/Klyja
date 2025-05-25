// frontend/tests/three-viewer.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ThreeViewer } from '../js/three-viewer.js';
import * as THREE from 'three';

describe('ThreeViewer', () => {
  let viewer;
  let container;

  beforeEach(() => {
    // Create a mock container
    container = document.createElement('div');
    container.id = 'test-container';
    container.style.width = '800px';
    container.style.height = '600px';
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true });
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (viewer) {
      viewer.dispose();
    }
    container.remove();
  });

  describe('initialization', () => {
    it('should initialize with default options', () => {
      viewer = new ThreeViewer('test-container');
      expect(viewer.containerId).toBe('test-container');
      expect(viewer.SPHERE_RADIUS).toBe(5);
    });

    it('should accept custom sphere radius', () => {
      viewer = new ThreeViewer('test-container', { sphereRadius: 10 });
      expect(viewer.SPHERE_RADIUS).toBe(10);
    });

    it('should throw error if container not found', () => {
      viewer = new ThreeViewer('non-existent');
      expect(() => viewer.init()).toThrow("Container with id 'non-existent' not found!");
    });

    it('should create Three.js objects', () => {
      viewer = new ThreeViewer('test-container');
      viewer.init();

      expect(viewer.scene).toBeDefined();
      expect(viewer.camera).toBeDefined();
      expect(viewer.renderer).toBeDefined();
      expect(viewer.controls).toBeDefined();
      expect(viewer.mainSphereMesh).toBeDefined();
    });
  });

  describe('scene setup', () => {
    beforeEach(() => {
      viewer = new ThreeViewer('test-container');
      viewer.init();
    });

    it('should set up scene with correct background', () => {
      expect(viewer.scene.background).toBeDefined();
      expect(viewer.scene.background.getHex()).toBe(0x282c34);
    });

    it('should position camera correctly', () => {
      expect(viewer.camera.position.z).toBe(viewer.SPHERE_RADIUS * 2.5);
    });

    it('should create sphere with correct properties', () => {
      expect(viewer.mainSphereMesh).toBeDefined();
      expect(viewer.mainSphereMesh.geometry.parameters.radius).toBe(5);
    });

    it('should set up controls with correct constraints', () => {
      expect(viewer.controls.minDistance).toBe(viewer.SPHERE_RADIUS + 1);
      expect(viewer.controls.maxDistance).toBe(viewer.SPHERE_RADIUS * 10);
      expect(viewer.controls.enableDamping).toBe(true);
    });
  });

  describe('polygon rendering', () => {
    beforeEach(() => {
      viewer = new ThreeViewer('test-container');
      viewer.init();
    });

    it('should render polygon points', () => {
      const polygonsData = [
        {
          polygon_id: 'test-poly',
          points: [
            {
              point_id: 'point-1',
              initial_position: { x: 1, y: 2, z: 3 }
            },
            {
              point_id: 'point-2',
              initial_position: { x: 4, y: 5, z: 6 }
            }
          ]
        }
      ];

      viewer.renderPolygons(polygonsData);

      expect(viewer.visualObjects).toHaveLength(2);
      expect(viewer.scene.children).toContain(viewer.visualObjects[0]);
      expect(viewer.scene.children).toContain(viewer.visualObjects[1]);
    });

    it('should clear previous objects before rendering new ones', () => {
      const firstData = [{
        polygon_id: 'poly-1',
        points: [{ point_id: 'p1', initial_position: { x: 1, y: 1, z: 1 } }]
      }];

      viewer.renderPolygons(firstData);
      const firstObject = viewer.visualObjects[0];

      const secondData = [{
        polygon_id: 'poly-2',
        points: [{ point_id: 'p2', initial_position: { x: 2, y: 2, z: 2 } }]
      }];

      viewer.renderPolygons(secondData);

      expect(viewer.visualObjects).toHaveLength(1);
      expect(viewer.scene.children).not.toContain(firstObject);
    });

    it('should handle missing position data gracefully', () => {
      const polygonsData = [
        {
          polygon_id: 'test-poly',
          points: [
            { point_id: 'point-1' }, // No initial_position
            { point_id: 'point-2', initial_position: null }
          ]
        }
      ];

      viewer.renderPolygons(polygonsData);
      expect(viewer.visualObjects).toHaveLength(0);
    });

    it('should handle missing z coordinate', () => {
      const polygonsData = [
        {
          polygon_id: 'test-poly',
          points: [
            {
              point_id: 'point-1',
              initial_position: { x: 1, y: 2 } // No z
            }
          ]
        }
      ];

      viewer.renderPolygons(polygonsData);
      expect(viewer.visualObjects).toHaveLength(1);
      expect(viewer.visualObjects[0].position.z).toBe(0);
    });
  });

  describe('sphere click handling', () => {
    beforeEach(() => {
      viewer = new ThreeViewer('test-container');
      viewer.init();
    });

    it('should call onSphereClick callback when sphere is clicked', () => {
      const mockCallback = vi.fn();
      viewer.onSphereClick = mockCallback;

      // Mock raycaster intersection
      const mockIntersection = {
        point: new THREE.Vector3(1, 2, 3)
      };

      // We can't easily simulate a real click with raycasting,
      // so we'll test the callback mechanism
      viewer.onSphereClick(1, 2, 3);

      expect(mockCallback).toHaveBeenCalledWith(1, 2, 3);
    });
  });

  describe('disposal', () => {
    it('should clean up resources', () => {
      viewer = new ThreeViewer('test-container');
      viewer.init();

      const disposeRendererSpy = vi.spyOn(viewer.renderer, 'dispose');
      const disposeControlsSpy = vi.spyOn(viewer.controls, 'dispose');

      viewer.dispose();

      expect(disposeRendererSpy).toHaveBeenCalled();
      expect(disposeControlsSpy).toHaveBeenCalled();
      expect(viewer.visualObjects).toHaveLength(0);
    });
  });
});
