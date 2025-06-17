import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/pkg': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    },
    fs: {
      allow: [
        path.resolve(__dirname, '..')
      ],
    },
  },
  resolve: {
    alias: {
      // This alias is for the DEV server and BUILD process
      '/pkg': path.resolve(__dirname, '../geco/pkg'),
    },
  },
  build: {
    rollupOptions: {
      external: [
        '/pkg/geco.js'
      ]
    }
  },
  test: {
    environment: 'happy-dom',
    include: ['**/*.{test,spec}.js'],
    globals: true,
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'json-summary'],
      exclude: ['**/node_modules/**', '**/tests/**', '**/*.config.js']
    },
    // This alias is specifically for the TEST environment
    alias: [
      {
        find: '/pkg/geco.js',
        replacement: path.resolve(__dirname, './tests/mocks/geco-mock.js')
      }
    ]
  }
});
