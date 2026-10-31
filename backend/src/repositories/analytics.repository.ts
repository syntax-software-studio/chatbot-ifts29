/**
 * Métricas agregadas y anónimas.
 *
 * Solo se registra la clave de la opción alcanzada. Nunca se guarda IP, DNI,
 * legajo, nombre, correo ni texto libre del estudiante (RNF05). Si no hay base
 * de datos, el registro es un no-op para no romper la respuesta al usuario.
 */

import { query } from '../db/pool.js';
import type { FilaMetrica } from '../lib/metricas.js';

export type Evento =
  | 'seleccion'
  | 'documento_abierto'
  | 'derivacion'
  | 'reinicio'
  | 'error'
  /** Consulta escrita que casó exactamente con una pregunta o variante. */
  | 'texto_exacto'
  /** Consulta escrita resuelta por similitud trigram. */
  | 'texto_similar'
  /** Consulta escrita atendida por la regla de saludos. */
  | 'texto_regla'
  /** Consulta escrita que requirió pedir aclaración. */
  | 'aclaracion'
  /** Consulta escrita sin información autorizada. */
  | 'no_disponible';


export async function registrarMetrica(opcionClave: string, evento: Evento): Promise<void> {
  try {
    await query(
      `INSERT INTO metrica_opcion (opcion_clave, categoria_clave, evento, total)
       VALUES ($1, NULL, $2, 1)
       ON CONFLICT (opcion_clave, evento, fecha)
       DO UPDATE SET total = metrica_opcion.total + 1`,
      [opcionClave, evento],
    );
  } catch (err) {
    // Una métrica fallida nunca debe cortar la conversación.
    console.warn('[metricas] no se pudo registrar:', err instanceof Error ? err.message : err);
  }
}

/** Top de opciones más elegidas, para detectar vacíos en la base de conocimiento. */
export async function topOpciones(limite = 20): Promise<
  Array<{ opcion_clave: string; evento: string; total: number }>
> {
  const r = await query<{ opcion_clave: string; evento: string; total: number }>(
    `SELECT opcion_clave, evento, SUM(total)::int AS total
       FROM metrica_opcion
      WHERE fecha >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY opcion_clave, evento
      ORDER BY total DESC
      LIMIT $1`,
    [limite],
  );
  return r.rows;
}

/** Eventos de un rango de fechas (`desde` incluido, `hasta` excluido), para el reporte mensual. */
export async function eventosDelRango(desde: string, hasta: string): Promise<FilaMetrica[]> {
  const r = await query<FilaMetrica>(
    `SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha, opcion_clave, categoria_clave, evento, total
       FROM metrica_opcion
      WHERE fecha >= $1 AND fecha < $2
      ORDER BY fecha, opcion_clave, evento`,
    [desde, hasta],
  );
  return r.rows;
}

/** Registra un reporte publicado. Si el mes ya estaba, lo reemplaza. */
export async function registrarExportacion(
  mes: string,
  archivoId: string,
  registros: number,
  total: number,
): Promise<void> {
  await query(
    `INSERT INTO metrica_exportacion (mes, archivo_id, registros, total)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (mes) DO UPDATE
        SET archivo_id = EXCLUDED.archivo_id,
            registros = EXCLUDED.registros,
            total = EXCLUDED.total,
            generado_en = now()`,
    [mes, archivoId, registros, total],
  );
}
