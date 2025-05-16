import '@testing-library/jest-dom';

// Set up global mocks that are needed across multiple tests
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock window object features
global.fetch = vi.fn();
global.requestAnimationFrame = callback => setTimeout(callback, 0);
global.cancelAnimationFrame = id => clearTimeout(id);

// Setup Three.js mocks - needed because Three.js is quite large and not all features work in jsdom/happy-dom
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal();
  
  return {
    ...actual,
    WebGLRenderer: vi.fn().mockImplementation(() => ({
      setSize: vi.fn(),
      render: vi.fn(),
      domElement: document.createElement('canvas')
    })),
    Scene: vi.fn().mockImplementation(() => ({
      add: vi.fn(),
      remove: vi.fn(),
      background: null
    })),
    PerspectiveCamera: vi.fn().mockImplementation(() => ({
      position: { x: 0, y: 0, z: 0 },
      updateProjectionMatrix: vi.fn()
    })),
    Vector2: vi.fn().mockImplementation(() => ({ x: 0, y: 0 })),
    Vector3: vi.fn().mockImplementation(() => ({ x: 0, y: 0, z: 0 })),
    Raycaster: vi.fn().mockImplementation(() => ({
      setFromCamera: vi.fn(),
      intersectObject: vi.fn().mockReturnValue([])
    })),
    Mesh: vi.fn().mockImplementation(() => ({
      position: { x: 0, y: 0, z: 0 }
    }))
  };
});

vi.mock('three/addons/controls/OrbitControls.js', () => {
  return {
    OrbitControls: vi.fn().mockImplementation(() => ({
      enableDamping: false,
      dampingFactor: 0,
      minDistance: 0,
      maxDistance: 100,
      update: vi.fn()
    }))
  };
});

// Mock WASM module
vi.mock('/pkg/geco.js', () => {
  return {
    default: vi.fn().mockResolvedValue({}),
    Geco: vi.fn().mockImplementation(() => ({
      get_animation_name: vi.fn().mockReturnValue('Test Animation'),
      set_animation_name: vi.fn(),
      get_polygons_json: vi.fn().mockReturnValue('[]'),
      add_static_polygon: vi.fn(),
      add_point_to_active_polygon: vi.fn(),
      get_animation_protobuf: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3, 4])),
      load_animation_protobuf: vi.fn()
    }))
  };
});