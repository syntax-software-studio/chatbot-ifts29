/** Servidor local de desarrollo (Vercel usa `api/index.ts`). */

import { app } from './app.js';
import { env } from './config/env.js';

const puerto = env.port;

const servidor = app.listen(puerto, () => {
  console.log('');
  console.log('  Asistente Virtual IFTS N.29 - API');
  console.log(`  -> http://localhost:${puerto}/api/health`);
  console.log(`  -> http://localhost:${puerto}/api/menu`);
  console.log(`  entorno: ${env.nodeEnv}`);
  console.log('');
});

const cerrar = (senal: string): void => {
  console.log(`\n[api] ${senal}: cerrando...`);
  servidor.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
};

process.on('SIGINT', () => cerrar('SIGINT'));
process.on('SIGTERM', () => cerrar('SIGTERM'));
