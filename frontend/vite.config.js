import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        'geco/pkg/geco.js'
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
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/tests/**', '**/*.config.js']
    }
  },
  resolve: {
    alias: {
      'geco/pkg/geco.js': '/tests/mocks/geco-mock.js'
    }
  }
});
