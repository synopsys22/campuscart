import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API_SERVER = 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': API_SERVER,
      '/uploads': API_SERVER,
    },
  },
});
