import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    emptyOutDir: process.env.EXTENSION_WATCH !== '1',
    rollupOptions: { input: { index: 'index.html', panel: 'panel.html' } },
    sourcemap: false
  }
});
