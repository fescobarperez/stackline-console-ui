import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Consola de plataforma. Toda la API vive en stack-line-services bajo
// /api/platform/*; en desarrollo se reenvía a ese backend.
//
// Se publica en una ruta del mismo dominio que la app (/console por defecto):
// los archivos y las rutas cuelgan de ahí. VITE_BASE_PATH la cambia; en
// desarrollo es la misma, para que lo que se prueba sea lo que se publica.
const ruta = (v) => `/${String(v || 'console').replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: ruta(env.VITE_BASE_PATH),
    plugins: [react()],
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
      css: false,
    },
    server: {
      // 5173 es de maya-ui: así corren las dos a la vez.
      port: 5174,
      strictPort: false,
      proxy: {
        '/api': { target: env.VITE_DEV_API_TARGET || 'http://localhost:8080', changeOrigin: true },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      target: 'es2020',
    },
  };
});
