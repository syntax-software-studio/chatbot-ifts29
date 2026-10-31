/**
 * Carga en la base: contenido de la planilla y fichas de documentos con Drive.
 * Usa la base de prueba y un Drive simulado (no se llama a Google).
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { prepararBasePrueba, cerrarBasePrueba } from '../../../test/helpers/entorno-prueba.js';
import { aplicarContenido, sincronizarDocumentos, type PuertoDrive } from '../sync-load.service.js';
import { convertirContenido } from '../sync-transform.service.js';
import { contenidoPrueba } from '../../../test/fixtures/contenido.js';
import { query } from '../../db/pool.js';
import type { ArchivoDrive } from '../../clients/drive.js';

before(async () => {
  await prepararBasePrueba();
});

after(async () => {
  await cerrarBasePrueba();
});

const datosPrueba = () => convertirContenido(contenidoPrueba).datos!;

/** Drive simulado: lista los archivos dados y no descarga nada real. */
function fakeDrive(archivos: ArchivoDrive[], contenido = new Uint8Array()): PuertoDrive {
  return {
    listarArchivos: async () => archivos,
    descargarArchivo: async () => contenido,
    enlaceDeLectura: async (id: string) => `https://drive.test/view/${id}`,
    enlaceDeDescarga: (id: string) => `https://drive.test/download/${id}`,
  };
}

const archivo = (id: string, nombre: string, mimeType: string, md5: string): ArchivoDrive => ({
  id,
  nombre,
  mimeType,
  md5,
  modifiedTime: null,
  tamano: null,
  webViewLink: null,
});

/** Documentos con nombre en Drive, en orden de clave. */
async function fichasConNombre(): Promise<Array<{ clave: string; drive_nombre_archivo: string }>> {
  const r = await query<{ clave: string; drive_nombre_archivo: string }>(
    'SELECT clave, drive_nombre_archivo FROM documento WHERE drive_nombre_archivo IS NOT NULL ORDER BY clave',
  );
  return r.rows;
}

test('aplicar la misma planilla dos veces deja los mismos conteos', async () => {
  const contar = async () =>
    (await query<{ n: number }>('SELECT count(*)::int AS n FROM kb_pregunta_variante')).rows[0]!.n;
  const antes = await contar();
  await aplicarContenido(datosPrueba());
  assert.equal(await contar(), antes);
});

test('lo que la planilla ya no trae se borra de la base', async () => {
  const datos = datosPrueba();
  const sinCondiciones = {
    ...datos,
    intenciones: datos.intenciones.filter((i) => i.clave !== 'condiciones_ABD'),
    preguntas: datos.preguntas.filter((p) => p.intencion !== 'condiciones_ABD'),
    variantes: datos.variantes.filter((v) => v.intencion !== 'condiciones_ABD'),
  };
  await aplicarContenido(sinCondiciones);
  const r = await query<{ n: number }>("SELECT count(*)::int AS n FROM kb_intencion WHERE clave = 'condiciones_ABD'");
  assert.equal(r.rows[0]!.n, 0);

  // Se restaura para no afectar las demás pruebas del archivo.
  await aplicarContenido(datos);
});

test('un documento que aparece en Drive queda enlazado a su archivo', async () => {
  const fichas = await fichasConNombre();
  const primera = fichas[0]!;
  const r = await sincronizarDocumentos({
    drive: fakeDrive([archivo('F1', primera.drive_nombre_archivo, 'text/plain', 'm1')]),
  });

  const f = await query<{ drive_file_id: string; drive_md5: string }>(
    'SELECT drive_file_id, drive_md5 FROM documento WHERE clave = $1',
    [primera.clave],
  );
  assert.equal(f.rows[0]!.drive_file_id, 'F1');
  assert.equal(f.rows[0]!.drive_md5, 'm1');
  assert.equal(r.actualizados, 1);
  // Los demás documentos no tienen archivo en este Drive simulado.
  assert.ok(r.sinMatch.length > 0);
});

test('sincronizar sin cambios en Drive no vuelve a actualizar nada', async () => {
  const fichas = await fichasConNombre();
  const drive = fakeDrive([archivo('F1', fichas[0]!.drive_nombre_archivo, 'text/plain', 'm1')]);
  await sincronizarDocumentos({ drive });
  const segunda = await sincronizarDocumentos({ drive });
  assert.equal(segunda.actualizados, 0);
});

test('si falla la extracción de un PDF, se conservan sus fragmentos anteriores', async () => {
  const fichas = await fichasConNombre();
  const doc = fichas[1]!;
  await query(
    `INSERT INTO documento_fragmento (documento_id, orden, titulo, texto, texto_busqueda)
     SELECT id, 1, 'Previo', 'texto previo', 'texto previo' FROM documento WHERE clave = $1`,
    [doc.clave],
  );

  // Bytes que no son un PDF: la extracción falla.
  const r = await sincronizarDocumentos({
    drive: fakeDrive([archivo('P1', doc.drive_nombre_archivo, 'application/pdf', 'pdf1')], new Uint8Array([1, 2, 3])),
  });

  assert.ok(r.mensajes.some((m) => m.includes(`fragmentos: ${doc.clave} falló`)));
  const frags = await query<{ titulo: string }>(
    `SELECT f.titulo FROM documento_fragmento f JOIN documento d ON d.id = f.documento_id WHERE d.clave = $1`,
    [doc.clave],
  );
  assert.deepEqual(frags.rows.map((x) => x.titulo), ['Previo']);
});
