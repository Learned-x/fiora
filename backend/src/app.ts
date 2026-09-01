import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID } from 'crypto';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import authRoutes from './routes/auth.routes';
import plantRoutes from './routes/plant.routes';
import taskRoutes from './routes/task.routes';
import speciesRoutes from './routes/species.routes';
import userRoutes from './routes/user.routes';
import optionsRoutes from './routes/options.routes';
import vaseRoutes from './routes/vase.routes';
import { requireAuth } from './middleware/auth.middleware';
import { swaggerSpec } from './lib/swagger';
import { logger } from './lib/logger';

const app = express();

// ── Middleware globali ────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '32kb' }));
app.use(
  pinoHttp({
    logger,
    // Health check e Swagger non hanno valore nei log e sono le rotte più
    // frequenti (probe, asset docs): la serializzazione del log è sul main thread.
    autoLogging: {
      ignore: (req) => req.url === '/health' || req.url.startsWith('/docs'),
    },
    genReqId: (req, res) => {
      const existing = req.headers['x-request-id'];
      const id = typeof existing === 'string' ? existing : randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
    customProps: (req) => ({ userId: (req as any).userId }),
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    // Non loggare body/header con credenziali
    redact: ['req.headers.authorization', 'req.body.password', 'req.body.currentPassword', 'req.body.newPassword'],
  })
);

// ── Documentazione API ────────────────────────────────────────────────────────
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/docs.json', (_req, res) => {
  res.json(swaggerSpec);
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/plants', requireAuth, plantRoutes);
app.use('/tasks', requireAuth, taskRoutes);
app.use('/species', requireAuth, speciesRoutes);
app.use('/users', requireAuth, userRoutes);
app.use('/options', requireAuth, optionsRoutes);
app.use('/vases', requireAuth, vaseRoutes);

// ── Fallback web per i link email (reset password) ────────────────────────────
// In produzione un dominio verificato userebbe universal link/app link (il sistema
// operativo apre l'app senza passare dal browser). Senza dominio pubblico non è
// verificabile: questa pagina simula lo stesso pattern con un redirect esplicito
// allo schema custom dell'app, cliccabile dai client email (http/https, a
// differenza di uno schema fiora:// nudo che molti client non rendono cliccabile).
app.get('/reset-password', (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  const deepLink = `fiora://reset-password?token=${encodeURIComponent(token)}`;

  res.type('html').send(`<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reimposta password Fiora</title>
<meta http-equiv="refresh" content="0;url=${deepLink}">
<style>
  body { font-family: -apple-system, sans-serif; background: #f4f6f4; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .card { background: #fff; border-radius: 16px; padding: 32px 24px; max-width: 360px; text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
  a.button { display: inline-block; margin-top: 16px; padding: 14px 24px; background: #3a7d44; color: #fff; border-radius: 12px; text-decoration: none; font-weight: 600; }
</style>
</head>
<body>
  <div class="card">
    <p>Apertura dell'app Fiora in corso…</p>
    <a class="button" href="${deepLink}">Apri Fiora</a>
  </div>
</body>
</html>`);
});

app.get('/verify-email', (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  const deepLink = `fiora://verify-email?token=${encodeURIComponent(token)}`;

  res.type('html').send(`<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Conferma email Fiora</title>
<meta http-equiv="refresh" content="0;url=${deepLink}">
<style>
  body { font-family: -apple-system, sans-serif; background: #f4f6f4; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .card { background: #fff; border-radius: 16px; padding: 32px 24px; max-width: 360px; text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
  a.button { display: inline-block; margin-top: 16px; padding: 14px 24px; background: #3a7d44; color: #fff; border-radius: 12px; text-decoration: none; font-weight: 600; }
</style>
</head>
<body>
  <div class="card">
    <p>Apertura dell'app Fiora in corso…</p>
    <a class="button" href="${deepLink}">Apri Fiora</a>
  </div>
</body>
</html>`);
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint non trovato' } });
});

export default app;