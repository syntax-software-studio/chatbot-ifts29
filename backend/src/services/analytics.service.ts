/**
 * Analytics (servicio de producto): registra qué consulta el estudiante y qué
 * respuesta recibe, en forma agregada y anónima. No es una métrica de sistema.
 *
 * El SQL está en `repositories/analytics.repository.ts`.
 */

export { registrarMetrica, topOpciones, type Evento } from '../repositories/analytics.repository.js';
