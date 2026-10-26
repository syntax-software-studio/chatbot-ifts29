/**
 * Sincroniza la base con la planilla de contenido y con Drive.
 *
 *   npm run sync --workspace backend
 *
 * Usa `DATABASE_URL` y las credenciales de Google del entorno. Si la planilla
 * tiene errores, no escribe nada y los muestra todos. Es el mismo proceso que
 * `POST /api/sync`.
 */

import { sincronizar } from '../services/sincronizacion.service.js';
import { closePool } from './pool.js';

async function main(): Promise<void> {
  const r = await sincronizar();
  if (!r.ok) {
    console.error('[sync] no se escribió nada. Errores:');
    r.errores.forEach((e) => console.error(`  - ${e}`));
    process.exitCode = 1;
    return;
  }

  console.log('[sync] contenido:');
  for (const [tabla, n] of Object.entries(r.contenido ?? {})) console.log(`  ${tabla.padEnd(22)} ${n}`);
  console.log(`[sync] documentos: ${r.documentos?.actualizados ?? 0} actualizados de ${r.documentos?.archivosVistos ?? 0} archivos en Drive`);
  if (r.documentos?.sinMatch.length) {
    console.log('[sync] sin archivo en Drive:');
    r.documentos.sinMatch.forEach((s) => console.log(`  - ${s.archivoEsperado}`));
  }
}

main()
  .catch((err) => {
    console.error('[sync] error:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
