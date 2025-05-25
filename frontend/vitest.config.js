import { defineConfig } from 'vite';

export default defineConfig({
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
