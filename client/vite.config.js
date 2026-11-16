import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Запросы /api уходят на Express-сервер
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000' } },
});
