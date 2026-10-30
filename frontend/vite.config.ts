import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build:demo` arma la demo en un solo archivo HTML (dist-demo/index.html)
// que se abre con doble clic, sin Node ni servidor. Usa rutas con # (ver src/utilidades/rutas.ts).
export default defineConfig(({ mode }) => ({
  plugins: mode === 'demo' ? [react(), viteSingleFile()] : [react()],
  server: { port: 5173, host: true },
  ...(mode === 'demo' ? { base: './', build: { outDir: 'dist-demo' } } : {}),
}));
