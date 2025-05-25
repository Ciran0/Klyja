// frontend/tests/api-client.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient } from '../js/api-client.js';

describe('ApiClient', () => {
  let client;
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    client = new ApiClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should use default base URL', () => {
      expect(client.baseUrl).toBe('');
    });

    it('should accept custom base URL', () => {
      const customClient = new ApiClient('http://localhost:8080');
      expect(customClient.baseUrl).toBe('http://localhost:8080');
    });
  });

  describe('saveAnimation', () => {
    it('should send POST request with protobuf data', async () => {
      const mockResponse = {
        ok: true,
        status: 201,
        json: vi.fn().mockResolvedValue({ id: 123, message: 'Success' })
      };
      fetchMock.mockResolvedValue(mockResponse);

      const protobufData = new Uint8Array([1, 2, 3, 4]);
      const result = await client.saveAnimation(protobufData);

      expect(fetchMock).toHaveBeenCalledWith('/api/save_animation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream'
        },
        body: protobufData
      });
      expect(result).toEqual({ id: 123, message: 'Success' });
    });

    it('should handle non-201 success status', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ id: 123 })
      };
      fetchMock.mockResolvedValue(mockResponse);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      await client.saveAnimation(new Uint8Array([1, 2, 3]));
      
      expect(consoleSpy).toHaveBeenCalledWith('Save request returned unexpected status:', 200);
      consoleSpy.mockRestore();
    });

    it('should throw error on failed request', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: vi.fn().mockResolvedValue('Database error')
      };
      fetchMock.mockResolvedValue(mockResponse);

      const protobufData = new Uint8Array([1, 2, 3, 4]);
      
      await expect(client.saveAnimation(protobufData))
        .rejects.toThrow('Save failed (500): Database error');
    });

    it('should handle error text retrieval failure', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: vi.fn().mockRejectedValue(new Error('Text parsing failed'))
      };
      fetchMock.mockResolvedValue(mockResponse);

      await expect(client.saveAnimation(new Uint8Array([1, 2, 3])))
        .rejects.toThrow('Save failed (500): Failed to get error details');
    });
  });

  describe('loadAnimation', () => {
    it('should send GET request and return Uint8Array', async () => {
      const mockArrayBuffer = new ArrayBuffer(4);
      new Uint8Array(mockArrayBuffer).set([1, 2, 3, 4]);
      
      const mockResponse = {
        ok: true,
        status: 200,
        arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer)
      };
      fetchMock.mockResolvedValue(mockResponse);

      const result = await client.loadAnimation(123);

      expect(fetchMock).toHaveBeenCalledWith('/api/load_animation/123');
      expect(result).toBeInstanceOf(Uint8Array);
      expect(Array.from(result)).toEqual([1, 2, 3, 4]);
    });

    it('should validate ID parameter', async () => {
      await expect(client.loadAnimation('invalid')).rejects.toThrow('Invalid ID provided');
      await expect(client.loadAnimation(NaN)).rejects.toThrow('Invalid ID provided');
      await expect(client.loadAnimation(null)).rejects.toThrow('Invalid ID provided');
    });

    it('should throw error on failed request', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: vi.fn().mockResolvedValue('Animation not found')
      };
      fetchMock.mockResolvedValue(mockResponse);

      await expect(client.loadAnimation(123))
        .rejects.toThrow('Load failed (404): Animation not found');
    });

    it('should use base URL if provided', async () => {
      const customClient = new ApiClient('http://api.example.com');
      const mockResponse = {
        ok: true,
        status: 200,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0))
      };
      fetchMock.mockResolvedValue(mockResponse);

      await customClient.loadAnimation(123);

      expect(fetchMock).toHaveBeenCalledWith('http://api.example.com/api/load_animation/123');
    });
  });
});
