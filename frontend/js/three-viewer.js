// frontend/js/three-viewer.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class ThreeViewer {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    // Log the incoming options and the calculated SPHERE_RADIUS
    console.log("[ThreeViewer Constructor] Options received:", options);
    this.SPHERE_RADIUS = options.sphereRadius === undefined ? 1 : options.sphereRadius; // More explicit check
    console.log("[ThreeViewer Constructor] Effective SPHERE_RADIUS:", this.SPHERE_RADIUS);
    
    // Three.js objects
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.mainSphereMesh = null;
    this.visualObjects = [];
    
    // Callbacks
    this.onSphereClick = null;
  }

  init() {
    const viewerContainer = document.getElementById(this.containerId);
    if (!viewerContainer) {
      throw new Error(`Container with id '${this.containerId}' not found!`);
    }

    this.setupScene();
    this.setupCamera(viewerContainer);
    this.setupRenderer(viewerContainer);
    this.setupLights();
    this.setupSphere();
    this.setupControls();
    this.setupAnimation();
    this.setupResize(viewerContainer);
    this.setupRaycasting();
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x282c34);
  }

  setupCamera(container) {
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.z = this.SPHERE_RADIUS * 3.5;
  }

  setupRenderer(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);
  }

  setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 10, 7.5);
    this.scene.add(directionalLight);
  }

  setupSphere() {
    console.log("[ThreeViewer setupSphere] Using SPHERE_RADIUS:", this.SPHERE_RADIUS);
    const sphereGeometry = new THREE.SphereGeometry(this.SPHERE_RADIUS, 64, 32);
    const sphereMaterial = new THREE.MeshStandardMaterial({
      color: 0x0077ff,
      wireframe: true,
      metalness: 0.2,
      roughness: 0.7,
    });
    this.mainSphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);

    this.mainSphereMesh.scale.set(1, 1, 1);

    this.scene.add(this.mainSphereMesh);

    console.log("[ThreeViewer setupSphere] mainSphereMesh scale:", this.mainSphereMesh.scale);
  }

  setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = this.SPHERE_RADIUS + 1;
    this.controls.maxDistance = this.SPHERE_RADIUS * 10;
  }

  setupAnimation() {
    const animate = () => {
      requestAnimationFrame(animate);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  setupResize(container) {
    window.addEventListener('resize', () => {
      this.camera.aspect = container.clientWidth / container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(container.clientWidth, container.clientHeight);
    });
  }

  setupRaycasting() {
    const raycaster = new THREE.Raycaster();
    const mouseNDC = new THREE.Vector2();

    this.renderer.domElement.addEventListener('click', (event) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      mouseNDC.x = (mouseX / rect.width) * 2 - 1;
      mouseNDC.y = -(mouseY / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouseNDC, this.camera);
      const intersects = raycaster.intersectObject(this.mainSphereMesh);

      if (intersects.length > 0 && this.onSphereClick) {
        const point = intersects[0].point.clone();

        point.normalize();

        this.onSphereClick(point.x, point.y, point.z);
      }
    });
  }

  clearVisualObjects() {
    this.visualObjects.forEach(obj => this.scene.remove(obj));
    this.visualObjects = [];
  }

renderFeatures(featuresData) {
    this.clearVisualObjects(); // Clear previously rendered objects

    // Define materials (can be more sophisticated later)
    const polylineMaterial = new THREE.LineBasicMaterial({ color: 0xffaa00, linewidth: 2 }); // Linewidth might not work on all systems with WebGLRenderer
    const polygonLineMaterial = new THREE.LineBasicMaterial({ color: 0x00aaff, linewidth: 1 });
    // For filled polygons, you'd use MeshStandardMaterial or similar
    // const polygonFillMaterial = new THREE.MeshStandardMaterial({ color: 0x00aaff, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });


    featuresData.forEach(feature => {
      if (!feature.points || feature.points.length < 1) {
        return; // Nothing to render for this feature
      }

      const threePoints = feature.points.map(p => new THREE.Vector3(p.x, p.y, p.z || 0));

      if (feature.feature_type === "Polyline") {
        if (threePoints.length < 2) return; // Need at least 2 points for a line
        const geometry = new THREE.BufferGeometry().setFromPoints(threePoints);
        const line = new THREE.Line(geometry, polylineMaterial.clone()); // Clone material if changing properties per line
        this.scene.add(line);
        this.visualObjects.push(line);
      } else if (feature.feature_type === "Polygon") {
        if (threePoints.length < 2) return; // Need at least 2 for LineLoop, 3 for a visual polygon
        
        // Option 1: Draw as a line loop (outline)
        const geometry = new THREE.BufferGeometry().setFromPoints(threePoints);
        const lineLoop = new THREE.LineLoop(geometry, polygonLineMaterial.clone());
        this.scene.add(lineLoop);
        this.visualObjects.push(lineLoop);
      }
    });
  }

  dispose() {
    this.clearVisualObjects();
    
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }
    
    if (this.controls) {
      this.controls.dispose();
    }
    
    // Clean up event listeners
    window.removeEventListener('resize', this.setupResize);
  }
}
