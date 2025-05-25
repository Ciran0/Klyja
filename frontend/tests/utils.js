/**
 * Test utilities for frontend tests
 */

/**
 * Creates a DOM element with the given HTML string
 * @param {string} html - The HTML string to convert to a DOM element
 * @returns {HTMLElement} The created DOM element
 */
export function createElementFromHTML(html) {
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  return div.firstChild;
}

/**
 * Waits for a given amount of time using setTimeout
 * @param {number} ms - Time to wait in milliseconds
 * @returns {Promise} Promise that resolves after the given time
 */
export function wait(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a mock event object for testing event handlers
 * @param {string} type - The event type (e.g., 'click', 'input')
 * @param {object} options - Additional event options
 * @returns {Event} The mocked event object
 */
export function createMockEvent(type, options = {}) {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
    ...options
  });
  
  // Add target property if provided
  if (options.target) {
    Object.defineProperty(event, 'target', {
      value: options.target,
      enumerable: true
    });
  }
  
  return event;
}

/**
 * Creates a mock Alpine.js state for testing Alpine components
 * @param {object} initialState - The initial state values
 * @returns {object} The mock Alpine state object
 */
export function createMockAlpineState(initialState = {}) {
  return {
    ...initialState,
    // Mock Alpine methods
    $nextTick: vi.fn(callback => setTimeout(callback, 0)),
    $watch: vi.fn(),
    $data: function() {
      return this;
    }
  };
}

/**
 * Simulates a click on a DOM element
 * @param {HTMLElement} element - The element to click
 */
export function simulateClick(element) {
  const event = createMockEvent('click');
  element.dispatchEvent(event);
  return event;
}

/**
 * Creates mock Three.js objects for testing
 * @returns {object} Object containing mock Three.js objects
 */
export function createMockThreeJsObjects() {
  return {
    scene: {
      add: vi.fn(),
      remove: vi.fn(),
      background: null
    },
    camera: {
      position: { x: 0, y: 0, z: 0 },
      updateProjectionMatrix: vi.fn()
    },
    renderer: {
      setSize: vi.fn(),
      render: vi.fn(),
      domElement: document.createElement('canvas')
    },
    controls: {
      enableDamping: false,
      dampingFactor: 0,
      minDistance: 0,
      maxDistance: 100,
      update: vi.fn()
    }
  };
}
