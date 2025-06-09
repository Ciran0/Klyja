import { defineConfig } from 'vite';
import path from 'path'; // We need the 'path' module from Node.js

export default defineConfig(({ command, mode }) => {
  const config = {
    server: {
      proxy: {
        // This is still useful for runtime requests made by the wasm module
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
         '/pkg': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        }
      },
      // ADD THIS fs block to allow access to the parent directory
      fs: {
        allow: [
          // Allow serving files from one level up (the project root)
          path.resolve(__dirname, '..')
        ],
      },
    },
    // ADD THIS resolve block to tell Vite where '/pkg' is on disk
    resolve: {
      alias: {
        // This maps the import path '/pkg' to the actual directory
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
      alias: {
        '/pkg/geco.js': path.resolve(__dirname, './tests/mocks/geco-mock.js'),
      }
    }
    // Note: The test alias for geco-mock.js is removed from here
    // because the new, more general alias above handles the path.
    // The test setup will still correctly mock the module.
  };

  // We only need the test-specific alias when in test mode.
  if (mode === 'test') {
    config.resolve.alias['/pkg/geco.js'] = path.resolve(__dirname, './tests/mocks/geco-mock.js');
  }

  return config;
});

