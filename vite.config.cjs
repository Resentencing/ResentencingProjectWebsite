const { defineConfig } = require('vite');

module.exports = defineConfig({
  root: 'frontend',
  build: {
    outDir: 'dist', // Netlify will publish frontend/dist
    sourcemap: true
  }
});