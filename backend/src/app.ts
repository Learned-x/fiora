import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import authRoutes from './routes/auth.routes';
import plantRoutes from './routes/plant.routes';
import taskRoutes from './routes/task.routes';
import speciesRoutes from './routes/species.routes';
import { requireAuth } from './middleware/auth.middleware';
import { swaggerSpec } from './lib/swagger';

const app = express();

// ── Middleware globali ────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());

// ── Documentazione API ────────────────────────────────────────────────────────
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/plants', requireAuth, plantRoutes);
app.use('/tasks', requireAuth, taskRoutes);
app.use('/species', requireAuth, speciesRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint non trovato' } });
});

export default app;