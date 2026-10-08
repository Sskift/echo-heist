import { defineConfig } from 'vite';

export default defineConfig({
  assetsInclude: ['**/*.fbx'],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
