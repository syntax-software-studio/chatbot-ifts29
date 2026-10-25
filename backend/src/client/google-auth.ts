/**
 * Credencial de la cuenta de servicio de Google.
 *
 * Es el único lugar donde se leen las credenciales de Google. Cada cliente
 * (Drive, Sheets) pide la credencial con el alcance que necesita.
 */

import { google } from 'googleapis';
import { env } from '../utils/env.js';

export function credencialGoogle(alcance: string): InstanceType<typeof google.auth.JWT> {
  return new google.auth.JWT({
    email: env.google.clientEmail,
    key: env.google.privateKey,
    scopes: [alcance],
  });
}
