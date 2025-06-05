import { defineConfig } from 'vite';

export default defineConfig(({ command, mode }) => {
  const config = {
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
      }
    },
    resolve: {
      alias: {
      }
    }
  };

  // Apply the alias *only* for test mode
  if (mode === 'test') {
    if (!config.resolve) {
      config.resolve = {};
    }
    if (!config.resolve.alias) {
      config.resolve.alias = {};
    }
    config.resolve.alias['/pkg/geco.js'] = '/tests/mocks/geco-mock.js';
  }

  return config;
});
