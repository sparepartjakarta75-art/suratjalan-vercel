import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  css: {
    postcss: './postcss.config.cjs',
  },
  build: {
    minify: true,
    outDir: resolve(__dirname, 'dist'),
  },
  server: {
    port: 5173,
    strictPort: false,
    host: 'localhost',
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});