import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

/* ------------------------------------------------------------------ */
/*  Serve the legacy public/ directory (demo.html, sfg_script.js, …)   */
/*  under the /legacy/ URL prefix so the iframe can load them.         */
/* ------------------------------------------------------------------ */
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};

function serveLegacyPublic(): Plugin {
  const legacyDir = path.resolve(__dirname, '..', 'public');
  return {
    name: 'serve-legacy-public',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url ?? '';
        if (!rawUrl.startsWith('/legacy/')) return next();

        const urlPath = rawUrl.split('?')[0].split('#')[0];
        const relative = decodeURIComponent(urlPath.slice('/legacy/'.length));
        const filePath = path.resolve(legacyDir, relative);

        // Prevent path-traversal outside legacyDir
        if (!filePath.startsWith(legacyDir)) return next();

        try {
          if (!fs.statSync(filePath).isFile()) return next();
        } catch {
          return next();
        }

        const ext = path.extname(filePath).toLowerCase();
        res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
        fs.createReadStream(filePath).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serveLegacyPublic()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/circuits': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
