import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// La boutique. Port distinct de la console pour faire tourner les deux
// interfaces en meme temps.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/images': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
