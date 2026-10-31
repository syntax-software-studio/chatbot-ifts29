/**
 * Reporte mensual de métricas: calendario, rango de fechas y tabla. Funciones puras.
 */

/** Filas de `metrica_opcion` tal como se exportan. */
export interface FilaMetrica {
  fecha: string;
  opcion_clave: string;
  categoria_clave: string | null;
  evento: string;
  total: number;
}

/** Celdas de una pestaña: primera fila la cabecera. */
export type Tabla = (string | number)[][];

const pad = (n: number): string => String(n).padStart(2, '0');

/** Mes calendario anterior a una fecha, como `YYYY-MM`. */
export function mesAnterior(hoy: Date): string {
  const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

export function esMesValido(mes: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(mes);
}

/** Rango de un mes: `desde` incluido, `hasta` excluido (inicio del mes siguiente). */
export function rangoDelMes(mes: string): { desde: string; hasta: string } {
  const [anio, numero] = mes.split('-').map(Number) as [number, number];
  const siguiente = new Date(Date.UTC(anio, numero, 1));
  return {
    desde: `${anio}-${pad(numero)}-01`,
    hasta: `${siguiente.getUTCFullYear()}-${pad(siguiente.getUTCMonth() + 1)}-01`,
  };
}

const CABECERA = ['fecha', 'opcion_clave', 'categoria_clave', 'evento', 'total'];

/** Tabla con una fila por día, opción y evento. Sin datos personales. */
export function filasATabla(filas: FilaMetrica[]): Tabla {
  return [
    CABECERA,
    ...filas.map((f) => [f.fecha, f.opcion_clave, f.categoria_clave ?? '', f.evento, f.total]),
  ];
}
