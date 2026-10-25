/**
 * Carga el contenido de la planilla en la base de datos.
 *
 *   npm run db:contenido --workspace backend
 *
 * Usa `DATABASE_URL` y las credenciales de Google del entorno. Si la planilla
 * tiene errores, no escribe nada y los muestra todos.
 */

import { leerContenido } from '../services/fuente-contenido.service.js';
import { aplicarContenido, convertirContenido } from '../services/carga-contenido.service.js';
import { closePool } from './pool.js';

async function main(): Promise<void> {
  console.log('[contenido] leyendo la planilla...');
  const lectura = await leerContenido();
  if (!lectura.ok) {
    console.error('[contenido] la planilla no es válida. No se cargó nada:');
    lectura.errores.forEach((e) => console.error(`  - ${e}`));
    process.exitCode = 1;
    return;
  }

  const conversion = convertirContenido(lectura.hojas);
  if (!conversion.ok || !conversion.datos) {
    console.error('[contenido] el contenido tiene errores. No se cargó nada:');
    conversion.errores.forEach((e) => console.error(`  - ${e}`));
    process.exitCode = 1;
    return;
  }

  console.log('[contenido] escribiendo en la base...');
  const resumen = await aplicarContenido(conversion.datos);
  console.log('[contenido] carga completa:');
  for (const [tabla, n] of Object.entries(resumen)) console.log(`  ${tabla.padEnd(22)} ${n}`);
}

main()
  .catch((err) => {
    console.error('[contenido] error:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
