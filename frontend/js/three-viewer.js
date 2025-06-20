// frontend/js/three-viewer.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// Import the custom shaders as raw text
import vertexShader from '../glsl/line_vertex.glsl?raw';
import fragmentShader from '../glsl/line_fragment.glsl?raw';

// This value MUST match the `#define MAX_LINE_SEGMENTS` in the fragment shader.
// It determines the size of the data texture used to pass line data to the GPU.
const MAX_LINE_SEGMENTS = 2048;

/**
 * Manages the Three.js scene, camera, renderer, and all 3D interactions.
 * This class is responsible for rendering the main sphere and drawing the animation
 * features on its surface using a custom shader and a data texture for high performance.
 */
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
    this.animationFrameId = null; // Holds the reference to the animation frame for cleanup.
    this.selectionMarker = null; // Hols selection sphere mesh

    /**
     * A callback function that gets executed when the user clicks on the sphere.
     * It receives the (x, y, z) coordinates of the click on the unit sphere's surface.
     * @type {?function(number, number, number)}
     */
    this.onSphereClick = null;
  }

  /**
   * Initializes the entire Three.js environment.
   */
  init() {
    const viewerContainer = document.getElementById(this.containerId);
    if (!viewerContainer) {
      throw new Error(`Container with id '${this.containerId}' not found!`);
    }

    this.setupScene();
    this.setupCamera(viewerContainer);
    this.setupRenderer(viewerContainer);
    this.setupLights();
    this.setupSphere(); // This sets up the main sphere with its custom shader material.
    this.setupSelectionMarker();
    this.setupControls();
    this.startAnimationLoop();
    this.setupResize(viewerContainer);
    this.setupRaycasting();
  }

  /**
   * Creates the Three.js scene and sets its background color.
   */
  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x282c34);
  }

  /**
   * Sets up the perspective camera.
   * @param {HTMLElement} container The container element for calculating aspect ratio.
   */
  setupCamera(container) {
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.z = this.SPHERE_RADIUS * 3.5;
  }

  /**
   * Sets up the WebGL renderer and appends it to the container.
   * @param {HTMLElement} container The container element to append the renderer to.
   */
  setupRenderer(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);
  }

  /**
   * Adds lighting to the scene.
   */
  setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 10, 7.5);
    this.scene.add(directionalLight);
  }

  /**
   * Sets up the main sphere mesh with a custom ShaderMaterial.
   *
   * This is the core of the rendering strategy. Instead of creating and managing thousands
   * of individual THREE.Line objects (which is slow), we use a single sphere and a custom
   * shader. All the line segment data (start and end points) is encoded into a single
   * DataTexture (`this.lineTexture`). This texture is passed to the fragment shader, which then
   * calculates the color for each pixel on the sphere's surface, effectively "drawing" the
   * lines directly on the GPU. This is significantly more performant.
   */
  setupSphere() {
    const sphereGeometry = new THREE.SphereGeometry(this.SPHERE_RADIUS, 128, 64);

    // Calculate the smallest square texture size that can hold all our line segment data.
    // Each segment needs two points, and each point is an RGBA (vec4) value.
    const texture_size = Math.ceil(Math.sqrt(MAX_LINE_SEGMENTS * 2));
    const data = new Float32Array(texture_size * texture_size * 4);

    this.lineTexture = new THREE.DataTexture(data, texture_size, texture_size, THREE.RGBAFormat, THREE.FloatType);
    this.lineTexture.needsUpdate = true;

    // Create the custom shader material.
    const shaderMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        // The texture containing all line start/end points.
        u_line_texture: { value: this.lineTexture },
        // The size of the texture, used for UV calculations.
        u_texture_size: { value: texture_size },
        // The actual number of line segments to draw for the current frame.
        u_line_count: { value: 0 },
        u_sphere_radius: { value: this.SPHERE_RADIUS },
        // Colors and style parameters passed to the shader.
        u_line_color: { value: new THREE.Color(0xffaa00) },
        u_active_line_color: { value: new THREE.Color(0x00ffff) },
        u_line_thickness: { value: 0.005 },
        u_debug_mode: { value: false },
      },
    });

    this.mainSphereMesh = new THREE.Mesh(sphereGeometry, shaderMaterial);
    this.scene.add(this.mainSphereMesh);
  }

  /**
   * Sets up the OrbitControls for camera manipulation (zoom, pan, rotate).
   */
  setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.enableDamping = false;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = this.SPHERE_RADIUS + 0.1;
    this.controls.maxDistance = this.SPHERE_RADIUS * 10;
  }

  /**
   * Starts the main rendering loop using `requestAnimationFrame`.
   */
  startAnimationLoop() {
    const animate = () => {
      // Store the frame ID so we can cancel it later during cleanup.
      this.animationFrameId = requestAnimationFrame(animate);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  /**
   * Sets up an event listener to handle window resizing.
   * @param {HTMLElement} container The container element.
   */
  setupResize(container) {
    this.onResize = () => {
      if (container) {
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
      }
    };
    window.addEventListener('resize', this.onResize);
  }

  /**
   * Sets up raycasting to detect user clicks on the main sphere.
   */
  setupRaycasting() {
    const raycaster = new THREE.Raycaster();
    const mouseNDC = new THREE.Vector2(); // Mouse coordinates in Normalized Device Coordinates.

    this.renderer.domElement.addEventListener('click', (event) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // Convert mouse coordinates from screen space to NDC (-1 to +1).
      mouseNDC.x = (mouseX / rect.width) * 2 - 1;
      mouseNDC.y = -(mouseY / rect.height) * 2 + 1;

      // Cast a ray from the camera through the mouse position.
      raycaster.setFromCamera(mouseNDC, this.camera);
      const intersects = raycaster.intersectObject(this.mainSphereMesh);

      // If the ray hits the sphere, normalize the intersection point to get a point
      // on the unit sphere, and invoke the `onSphereClick` callback.
      if (intersects.length > 0 && this.onSphereClick) {
        const point = intersects[0].point.clone();
        point.normalize();
        this.onSphereClick(point.x, point.y, point.z);
      }
    });
  }

  /**
   * Updates the line data texture with new vector data from the WASM module.
   * This is the primary method for updating the visualization each frame.
   * @param {object} vectorData The data object from WASM, containing `vertex_data` and `segment_count`.
   */
  renderFeatures(vectorData) {
    if (!vectorData || !this.mainSphereMesh || !this.lineTexture) {
      return;
    }

    const { vertex_data, segment_count } = vectorData;

    // Update the shader uniforms with the new data for the current frame.
    this.mainSphereMesh.material.uniforms.u_line_count.value = segment_count;
    this.lineTexture.image.data.set(vertex_data);
    this.lineTexture.needsUpdate = true; // Crucial: tells Three.js to re-upload the texture to the GPU.
  }

  /**
   * Creates the selection marker sphere.
   */
  setupSelectionMarker() {
    const geometry = new THREE.SphereGeometry(this.SPHERE_RADIUS * 0.05, 16, 16); // A small sphere
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ffff, // A bright cyan color
      transparent: true,
      opacity: 0.7,    // Make it semi-transparent
    });
    this.selectionMarker = new THREE.Mesh(geometry, material);
    this.selectionMarker.visible = false; // It should be hidden initially
    this.scene.add(this.selectionMarker);
  }

  /**
   * Updates the position of the selection marker and makes it visible.
   * @param {THREE.Vector3} position The new position for the marker.
   */
  updateSelectionMarker(position) {
    if (!this.selectionMarker) return;
    // We multiply by 1.01 to place it just slightly above the main sphere's surface, preventing visual glitches.
    this.selectionMarker.position.copy(position).multiplyScalar(this.SPHERE_RADIUS * 1.01);
    this.selectionMarker.visible = true;
  }

  /**
   * Hides the selection marker.
   */
  hideSelectionMarker() {
    if (this.selectionMarker) {
      this.selectionMarker.visible = false;
    }
  }

  /**
   * Cleans up Three.js resources and event listeners to prevent memory leaks.
   */
  dispose() {
    // Stop the animation loop.
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

    // Clean up event listeners.
    if (this.onResize) {
      window.removeEventListener('resize', this.onResize);
    }
  }
}
