import { defineConfig } from 'vite';
const proxy = { '/api': 'http://127.0.0.1:3000' };
export default defineConfig({
  server: { host: 'localhost', port: 5173, strictPort: true, proxy },
  preview: { host: 'localhost', port: 5173, strictPort: true, proxy },
  build: { target: 'es2023' },
});
