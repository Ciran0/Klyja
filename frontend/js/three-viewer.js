// frontend/js/three-viewer.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class ThreeViewer {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.SPHERE_RADIUS = options.sphereRadius || 5;
    
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
    this.camera.position.z = this.SPHERE_RADIUS * 2.5;
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
    const sphereGeometry = new THREE.SphereGeometry(this.SPHERE_RADIUS, 64, 32);
    const sphereMaterial = new THREE.MeshStandardMaterial({
      color: 0x0077ff,
      wireframe: false,
      metalness: 0.2,
      roughness: 0.7,
    });
    this.mainSphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
    this.scene.add(this.mainSphereMesh);
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
        const point = intersects[0].point;
        this.onSphereClick(point.x, point.y, point.z);
      }
    });
  }

  clearVisualObjects() {
    this.visualObjects.forEach(obj => this.scene.remove(obj));
    this.visualObjects = [];
  }

  renderPolygons(polygonsData) {
    this.clearVisualObjects();

    const pointMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const pointGeometry = new THREE.SphereGeometry(0.1, 16, 8);

    polygonsData.forEach(polygon => {
      if (polygon.points) {
        polygon.points.forEach(animatedPoint => {
          if (animatedPoint.initial_position) {
            const pos = animatedPoint.initial_position;
            const pointMesh = new THREE.Mesh(pointGeometry, pointMaterial);
            pointMesh.position.set(pos.x, pos.y, pos.z || 0);
            this.scene.add(pointMesh);
            this.visualObjects.push(pointMesh);
          }
        });
      }
    });

    console.log(`Rendered ${this.visualObjects.length} points.`);
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
