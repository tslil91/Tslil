import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  // `npm run dev` + `npm run server` (port 8080): the dev page talks to the real server
  server: { proxy: { '/api': 'http://localhost:8080' } },
  test: { environment: 'node' },
});
