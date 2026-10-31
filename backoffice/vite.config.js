import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Console de gestion. Port distinct de la boutique pour faire tourner les deux
// interfaces en meme temps.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/images': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
