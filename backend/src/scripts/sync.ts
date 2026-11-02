/**
 * Sincroniza la base con la planilla de contenido y con Drive.
 *
 *   npm run sync --workspace backend
 *
 * Usa `DATABASE_URL` y las credenciales de Google del entorno. Si la planilla
 * tiene errores, no escribe nada y los muestra todos. Es el mismo proceso que
 * `POST /api/sync`.
 *
 * Colores (solo en terminal; `NO_COLOR` los desactiva):
 *   amarillo: etapa en curso · verde: etapa terminada · cian: documento en proceso
 *   rojo: fallo · magenta: aviso que requiere revisión
 */

import { sincronizar } from '../services/sync.service.js';
import { closePool } from '../db/pool.js';

const usarColor = process.stdout.isTTY && !process.env.NO_COLOR;
const COLORES = { reset: '\x1b[0m', amarillo: '\x1b[33m', verde: '\x1b[32m', cian: '\x1b[36m', rojo: '\x1b[31m', magenta: '\x1b[35m' };

function pintar(texto: string, color: keyof typeof COLORES): string {
  return usarColor ? `${COLORES[color]}${texto}${COLORES.reset}` : texto;
}

/** Elige el color de cada línea de progreso según la fase que describe. */
function colorDe(linea: string): keyof typeof COLORES {
  if (/falló|error|más de/.test(linea)) return 'rojo';
  if (/fuera de la convención|sin archivo/.test(linea)) return 'magenta';
  if (/^\[\d+\/\d+\]/.test(linea)) return 'cian';
  if (/: listo/.test(linea)) return 'verde';
  if (/…$/.test(linea)) return 'amarillo';
  return 'reset';
}

async function main(): Promise<void> {
  const r = await sincronizar({ progreso: (linea) => console.log(pintar(`[sync] ${linea}`, colorDe(linea))) });
  if (!r.ok) {
    console.error(pintar('[sync] no se escribió nada. Errores:', 'rojo'));
    r.errores.forEach((e) => console.error(pintar(`  - ${e}`, 'rojo')));
    process.exitCode = 1;
    return;
  }

  console.log(pintar('[sync] contenido:', 'verde'));
  for (const [tabla, n] of Object.entries(r.contenido ?? {})) console.log(`  ${tabla.padEnd(22)} ${n}`);
  console.log(pintar(`[sync] documentos: ${r.documentos?.actualizados ?? 0} actualizados de ${r.documentos?.archivosVistos ?? 0} archivos en Drive`, 'verde'));
  if (r.documentos?.sinMatch.length) {
    console.log(pintar('[sync] sin archivo en Drive:', 'magenta'));
    r.documentos.sinMatch.forEach((s) => console.log(pintar(`  - ${s.archivoEsperado}`, 'magenta')));
  }
}

main()
  .catch((err) => {
    console.error(pintar(`[sync] error: ${err instanceof Error ? err.message : err}`, 'rojo'));
    process.exitCode = 1;
  })
  .finally(() => closePool());
