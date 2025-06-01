import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        // If you are treating the actual geco.js as external for build, keep this.
        // For tests, the alias below should handle it.
        // 'geco/pkg/geco.js' 
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
      // Ensure the alias key exactly matches the import path used in tests and source
      '/pkg/geco.js': '/tests/mocks/geco-mock.js'
    }
  }
});
