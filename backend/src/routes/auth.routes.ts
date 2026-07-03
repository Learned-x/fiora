import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import * as authService from '../services/auth.service';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Rate limiter per endpoint di autenticazione (5 tentativi/minuto)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Troppi tentativi, riprova tra un minuto' } },
  standardHeaders: true,
  legacyHeaders: false,
});

// Helper: restituisce gli errori di validazione
function handleValidation(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: errors.array()[0].msg },
    });
    return false;
  }
  return true;
}

// ── POST /auth/register ───────────────────────────────────────────────────────

router.post(
  '/register',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Email non valida'),
    body('password').isLength({ min: 8 }).withMessage('Password minimo 8 caratteri'),
  ],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;

    try {
      const { email, password } = req.body;
      const result = await authService.register(email, password);
      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      res.status(err.status || 500).json({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
      });
    }
  }
);

// ── POST /auth/login ──────────────────────────────────────────────────────────

router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Email non valida'),
    body('password').notEmpty().withMessage('Password obbligatoria'),
  ],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;

    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(err.status || 500).json({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
      });
    }
  }
);

// ── POST /auth/refresh ────────────────────────────────────────────────────────

router.post(
  '/refresh',
  [body('refreshToken').notEmpty().withMessage('Refresh token obbligatorio')],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;

    try {
      const result = await authService.refresh(req.body.refreshToken);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(err.status || 500).json({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
      });
    }
  }
);

// ── POST /auth/logout ─────────────────────────────────────────────────────────

router.post(
  '/logout',
  [body('refreshToken').notEmpty().withMessage('Refresh token obbligatorio')],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;

    try {
      await authService.logout(req.body.refreshToken);
      res.json({ success: true, data: { message: 'Logout effettuato' } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
    }
  }
);

// ── DELETE /auth/account ──────────────────────────────────────────────────────

router.delete('/account', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await authService.requestAccountDeletion(req.userId!);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ── POST /auth/account/cancel-deletion ───────────────────────────────────────

router.post('/account/cancel-deletion', requireAuth, async (req: Request, res: Response) => {
  try {
    await authService.cancelAccountDeletion(req.userId!);
    res.json({ success: true, data: { message: 'Eliminazione annullata' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

export default router;