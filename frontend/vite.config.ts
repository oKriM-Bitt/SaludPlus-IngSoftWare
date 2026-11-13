import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * DEV-72: registro compartido de los boxes de admisión, solo con `npm run dev`.
 * Guarda en memoria quién atiende en cada box ("AAAA-MM-DD|sucursal|box" → usuario),
 * así dos navegadores o equipos ven los mismos boxes ocupados. Cliente: src/servicios/boxes.ts.
 * - GET  /api/boxes          → { clave: usuario }
 * - POST /api/boxes/tomar    { clave, usuario }  → 200 { boxes } o 409 { boxes, ocupadoPor }
 * - POST /api/boxes/dejar    { claves, usuario } → 200 { boxes }
 * Si se reinicia el servidor, todos los boxes quedan libres.
 */
function registroDeBoxes(): Plugin {
  const boxes: Record<string, string> = {};

  const leerCuerpo = (req: IncomingMessage) =>
    new Promise<Record<string, unknown>>((resolver) => {
      let datos = '';
      req.on('data', (parte) => (datos += parte));
      req.on('end', () => {
        try {
          resolver(JSON.parse(datos || '{}'));
        } catch {
          resolver({});
        }
      });
    });

  const responder = (res: ServerResponse, estado: number, cuerpo: unknown) => {
    res.statusCode = estado;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(cuerpo));
  };

  return {
    name: 'saludplus-registro-de-boxes',
    configureServer(server) {
      server.middlewares.use('/api/boxes', async (req, res, siguiente) => {
        const ruta = (req.url ?? '/').split('?')[0];
        if (req.method === 'GET' && (ruta === '/' || ruta === '')) return responder(res, 200, boxes);
        if (req.method !== 'POST') return siguiente();
        const cuerpo = await leerCuerpo(req);
        const usuario = typeof cuerpo.usuario === 'string' ? cuerpo.usuario : '';
        if (!usuario) return responder(res, 400, { boxes });

        if (ruta === '/tomar') {
          const clave = typeof cuerpo.clave === 'string' ? cuerpo.clave : '';
          if (!clave) return responder(res, 400, { boxes });
          const ocupadoPor = boxes[clave];
          if (ocupadoPor && ocupadoPor !== usuario) return responder(res, 409, { boxes, ocupadoPor });
          // Una persona, un box: si estaba en otro box de la misma sucursal y día, lo deja.
          const prefijo = clave.slice(0, clave.lastIndexOf('|') + 1);
          for (const k of Object.keys(boxes)) if (k.startsWith(prefijo) && boxes[k] === usuario) delete boxes[k];
          boxes[clave] = usuario;
          return responder(res, 200, { boxes });
        }

        if (ruta === '/dejar') {
          const claves = Array.isArray(cuerpo.claves) ? cuerpo.claves.filter((k): k is string => typeof k === 'string') : [];
          for (const k of claves) if (boxes[k] === usuario) delete boxes[k];
          return responder(res, 200, { boxes });
        }

        return siguiente();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), registroDeBoxes()],
  server: { port: 5173, host: true },
});
