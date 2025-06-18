// frontend/js/three-viewer.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import vertexShader from '../glsl/line_vertex.glsl?raw';
import fragmentShader from '../glsl/line_fragment.glsl?raw';

//MUST MATCH THE #define IN THE FRAGMENT SHADER
const MAX_LINE_SEGMENTS = 2048;

export class ThreeViewer {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    console.log("[ThreeViewer Constructor] Options received:", options);
    this.SPHERE_RADIUS = options.sphereRadius === undefined ? 1 : options.sphereRadius;
    console.log("[ThreeViewer Constructor] Effective SPHERE_RADIUS:", this.SPHERE_RADIUS);
    
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.mainSphereMesh = null;
    this.animationFrameId = null; // Add this to hold the animation frame reference
    
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
    this.startAnimationLoop(); // Changed method name for clarity
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
    const sphereGeometry = new THREE.SphereGeometry(this.SPHERE_RADIUS, 128, 64);

    const texture_size = Math.ceil(Math.sqrt(MAX_LINE_SEGMENTS * 2));
    const data = new Float32Array(texture_size * texture_size * 4); 

    this.lineTexture = new THREE.DataTexture(data, texture_size, texture_size, THREE.RGBAFormat, THREE.FloatType);
    this.lineTexture.needsUpdate = true; 

    const shaderMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        u_line_texture: { value: this.lineTexture },
        u_texture_size: { value: texture_size },
        u_line_count: { value: 0 },
        u_sphere_radius: { value: this.SPHERE_RADIUS },
        u_line_color: { value: new THREE.Color(0xffaa00) },
        u_line_thickness: { value: 0.005 },
        u_debug_mode: { value: false},
      },
    });

    this.mainSphereMesh = new THREE.Mesh(sphereGeometry, shaderMaterial);
    this.scene.add(this.mainSphereMesh);
  }

  setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = this.SPHERE_RADIUS + 0.1;
    this.controls.maxDistance = this.SPHERE_RADIUS * 10;
  }

  startAnimationLoop() {
    const animate = () => {
      // Store the frame ID so we can cancel it later
      this.animationFrameId = requestAnimationFrame(animate);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  setupResize(container) {
    // Use an arrow function or bind `this` to ensure correct context
    this.onResize = () => {
        if (container) {
            this.camera.aspect = container.clientWidth / container.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(container.clientWidth, container.clientHeight);
        }
    };
    window.addEventListener('resize', this.onResize);
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

  renderFeatures(vectorData) {
    if (!vectorData || !this.mainSphereMesh || !this.lineTexture) {
      return;
    }
    
    const { vertex_data, segment_count } = vectorData;

    this.mainSphereMesh.material.uniforms.u_line_count.value = segment_count;
    this.lineTexture.image.data.set(vertex_data);
    this.lineTexture.needsUpdate = true;
  }

  dispose() {
    // Stop the animation loop
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }
    
    if (this.controls) {
      this.controls.dispose();
    }
    
    // Clean up event listeners
    if (this.onResize) {
      window.removeEventListener('resize', this.onResize);
    }
  }
}
