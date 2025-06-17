// frontend/js/api-client.js

export class ApiClient {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

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

  async loadAnimation(id) {
    if (typeof id !== 'number' || isNaN(id)) {
      throw new Error('Invalid ID provided for loading');
    }

    const response = await fetch(`${this.baseUrl}/api/load_animation/${id}`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Failed to get error details');
      throw new Error(`Load failed (${response.status}): ${errorText || response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }
}
