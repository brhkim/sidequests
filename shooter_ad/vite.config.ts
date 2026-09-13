import { defineConfig } from 'vite';

export default defineConfig({
  // Relative, so the build works from the GitHub Pages subpath /shooter_ad/.
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
