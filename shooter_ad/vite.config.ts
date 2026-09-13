import { defineConfig } from 'vite';

export default defineConfig({
  // Relative, so the build works from the GitHub Pages subpath /shooter_ad/.
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Stable names rather than content hashes: the build is republished to
        // a fixed artifact path, and a changing filename would orphan the old
        // asset on every publish.
        entryFileNames: 'game.js',
        assetFileNames: 'game.[ext]',
      },
    },
  },
});
