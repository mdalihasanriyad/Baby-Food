import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // The API listens on PORT from .env (default 5000). Reading the same value keeps the proxy and the API in step.
  // (These values stay inside this config file; only VITE_-prefixed variables ever reach browser code, and none are used.)
  const port = loadEnv(mode, process.cwd(), '').PORT || '5000';
  const api = `http://127.0.0.1:${port}`;
  return {
    plugins: [react()],
    // In development the pages come from Vite (5173) and the API from scripts/serve.js.
    server: { port: 5173, proxy: { '/api': api, '/sitemap.xml': api, '/robots.txt': api } },
    build: {
      outDir: 'dist',
      target: 'es2020',
      rollupOptions: {
        // React and the router change rarely: keeping them in their own file lets browsers cache them across deploys.
        output: { manualChunks: { react: ['react', 'react-dom', 'react-router-dom'] } },
      },
    },
  };
});
