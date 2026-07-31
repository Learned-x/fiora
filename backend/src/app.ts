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
app.use(express.json());
app.use(
  pinoHttp({
    logger,
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

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint non trovato' } });
});

export default app;