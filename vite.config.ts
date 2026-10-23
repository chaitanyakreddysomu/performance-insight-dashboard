import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/iih-api': {
        target: 'http://localhost:4203',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/iih-api/, ''),
      },
    },
  },
});
