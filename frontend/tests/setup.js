import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Global Mocks
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
global.fetch = vi.fn();
global.requestAnimationFrame = callback => setTimeout(callback, 0);
global.cancelAnimationFrame = id => clearTimeout(id);

// --- THREE.js Mock Constructors ---

const MockDataTexture = vi.fn(function(data) {
  this.image = { data }; // Mock the necessary properties
  this.needsUpdate = false;
  this.isDataTexture = true;
});

// For classes we want to use "new" with AND spy on the constructor itself
const MockVector3 = vi.fn(function(x = 0, y = 0, z = 0) {
  this.x = x;
  this.y = y;
  this.z = z;
  this.set = vi.fn((nx, ny, nz) => { this.x = nx; this.y = ny; this.z = nz; return this; });
  this.normalize = vi.fn(() => {
    const length = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    if (length > 0) { this.x /= length; this.y /= length; this.z /= length; }
    return this;
  });
  this.clone = vi.fn(() => new MockVector3(this.x, this.y, this.z));
  this.dot = vi.fn(() => 0);
  this.cross = vi.fn(() => new MockVector3());
  this.slerp = vi.fn(() => new MockVector3());
  this.magnitude_squared = vi.fn(() => this.x*this.x + this.y*this.y + this.z*this.z);
});

const MockBufferGeometry = vi.fn(function() {
  this.attributes = {};
  this.setFromPoints = vi.fn(() => this); // Chainable
  this.dispose = vi.fn();
});

const MockScene = vi.fn(function() {
  this.children = [];
  this.add = vi.fn(child => { this.children.push(child); });
  this.remove = vi.fn(child => {
    const index = this.children.indexOf(child);
    if (index > -1) this.children.splice(index, 1);
  });
  this.background = null;
});

const MockPerspectiveCamera = vi.fn(function() {
  this.position = new MockVector3();
  this.updateProjectionMatrix = vi.fn();
  this.aspect = 1;
  this.getWorldDirection = vi.fn(() => new MockVector3(0,0,-1));
});

const MockMesh = vi.fn(function(geometry, material) {
  this.geometry = geometry || { parameters: { radius: 0 } }; // Ensure geometry exists
  this.material = material || {};
  this.position = new MockVector3();
  this.scale = new MockVector3(1,1,1);
});

const MockLine = vi.fn(function(geometry, material) {
  this.geometry = geometry;
  this.material = material;
});

const MockLineLoop = vi.fn(function(geometry, material) {
  this.geometry = geometry;
  this.material = material;
});

const MockWebGLRenderer = vi.fn(function() {
  this.domElement = document.createElement('canvas');
  this.setSize = vi.fn();
  this.render = vi.fn();
  this.dispose = vi.fn();
});

const MockOrbitControls = vi.fn(function(camera, domElement) {
  this.object = camera;
  this.domElement = domElement;
  this.enableDamping = true;
  this.dampingFactor = 0.05;
  this.minDistance = 0;
  this.maxDistance = Infinity;
  this.update = vi.fn();
  this.dispose = vi.fn();
});


vi.mock('three', () => ({
  Color: vi.fn(function(color) { this.getHex = () => color || 0x000000; }),
  WebGLRenderer: MockWebGLRenderer,
  Scene: MockScene,
  PerspectiveCamera: MockPerspectiveCamera,

  DataTexture: MockDataTexture,
  RGBAFormat: 'mock-rgba-format',
  FloatType: 'mock-float-type',

  Vector2: vi.fn((x = 0, y = 0) => ({ x, y })), // Simple mock if not instantiated with "new"
  Vector3: MockVector3,
  Raycaster: vi.fn(() => ({
    setFromCamera: vi.fn(),
    intersectObject: vi.fn().mockReturnValue([])
  })),
  Mesh: MockMesh,
  SphereGeometry: vi.fn((radius = 1) => ({ parameters: { radius } })), // Added default
  MeshStandardMaterial: vi.fn(() => ({ dispose: vi.fn() })),
  MeshBasicMaterial: vi.fn(() => ({ dispose: vi.fn() })),
  LineBasicMaterial: vi.fn(() => ({ clone: vi.fn(function() { return this; }), dispose: vi.fn() })),
  AmbientLight: vi.fn(function() { this.isLight = true; }),
  DirectionalLight: vi.fn(function() { this.isLight = true; this.position = new MockVector3(); }),
  BufferGeometry: MockBufferGeometry,
  Line: MockLine,
  LineLoop: MockLineLoop,
}));

vi.mock('three/addons/controls/OrbitControls.js', () => ({
  OrbitControls: MockOrbitControls
}));

// --- WASM Mocks (ensure these cover all methods used in WasmManager) ---
const createGecoMockInstance = () => ({
  get_animation_name: vi.fn().mockReturnValue('Test Animation'),
  set_animation_name: vi.fn(),
  get_total_frames: vi.fn().mockReturnValue(100),
  set_total_frames: vi.fn(),
  create_feature: vi.fn().mockReturnValue('mock-feature-id'),
  add_point_to_active_feature: vi.fn().mockReturnValue('mock-point-id'),
  add_position_keyframe_to_point: vi.fn(),
  get_renderable_features_json_at_frame: vi.fn().mockReturnValue('[]'),
  get_animation_protobuf: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3, 4])),
  load_animation_protobuf: vi.fn(),
  get_active_feature_id: vi.fn().mockReturnValue(null),
});

vi.mock('/pkg/geco.js', () => ({
  default: vi.fn().mockResolvedValue({}),
  Geco: vi.fn().mockImplementation(createGecoMockInstance)
}));

vi.mock('../pkg/geco.js', () => ({
  default: vi.fn().mockResolvedValue({}),
  Geco: vi.fn().mockImplementation(createGecoMockInstance)
}));

// --- Console Mock ---
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
};
