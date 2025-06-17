// frontend/js/api-client.js

export class ApiClient {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Checks the current user's authentication status.
   * @returns {Promise<object>} User data if logged in.
   * @rejects {Error} If the user is not authenticated or on network error.
   */
  async getMe() {
    const response = await fetch(`${this.baseUrl}/api/me`);
    if (!response.ok) {
      throw new Error('Not authenticated');
    }
    return response.json();
  }

  /**
   * Fetches the list of animations for the currently logged-in user.
   * @returns {Promise<Array<object>>} A list of animation metadata objects.
   */
  async getMyAnimations() {
    const response = await fetch(`${this.baseUrl}/api/my_animations`);
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Failed to get error details');
      throw new Error(`Failed to get animations (${response.status}): ${errorText}`);
    }
    return response.json();
  }

  /**
   * Saves the animation data for the authenticated user.
   * @param {Uint8Array} protobufData The animation data to save.
   * @returns {Promise<object>} The result from the server, including the new animation ID.
   */
  async saveAnimation(protobufData) {
    const response = await fetch(`${this.baseUrl}/api/save_animation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream'
      },
      body: protobufData
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Failed to get error details');
      throw new Error(`Save failed (${response.status}): ${errorText || response.statusText}`);
    }

    if (response.status !== 201) {
      console.warn('Save request returned unexpected status:', response.status);
    }
    
    return response.json();
  }

  /**
   * Loads a specific animation owned by the authenticated user.
   * @param {number} id The ID of the animation to load.
   * @returns {Promise<Uint8Array>} The raw animation data.
   */
  async loadAnimation(id) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      throw new Error('Invalid ID provided for loading');
    }

    const response = await fetch(`${this.baseUrl}/api/load_animation/${numericId}`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Failed to get error details');
      throw new Error(`Load failed (${response.status}): ${errorText || response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }
}
