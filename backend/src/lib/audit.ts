import path from 'path';
import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';
const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');

// Log separato per eventi di sicurezza/audit (login, password, azioni sensibili).
// Conservato più a lungo del log applicativo (90gg) perché serve a ricostruire
// "chi ha fatto cosa" anche molto dopo l'evento.
const auditFileStream = isTest
  ? { write: () => {} }
  : pino.transport({
      target: 'pino-roll',
      options: {
        file: path.join(LOG_DIR, 'audit'),
        frequency: 'daily',
        dateFormat: 'yyyy-MM-dd',
        extension: '.log',
        limit: { count: 90 },
        mkdir: true,
      },
    });

export const auditLogger = pino(
  { base: { service: 'fiora-backend', type: 'audit' }, timestamp: pino.stdTimeFunctions.isoTime },
  auditFileStream
);

export type AuditEvent =
  | 'auth.register'
  | 'auth.login.success'
  | 'auth.login.failure'
  | 'auth.logout'
  | 'auth.refresh'
  | 'auth.change_password'
  | 'auth.account_deletion.requested'
  | 'auth.account_deletion.cancelled'
  | 'vase.pairing.started'
  | 'vase.deleted'
  | 'plant.vase_link.changed';

interface AuditContext {
  userId?: string;
  email?: string;
  ip?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
}

export function audit(event: AuditEvent, ctx: AuditContext = {}) {
  auditLogger.info({ event, ...ctx }, event);
}
