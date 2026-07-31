import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import * as authService from '../services/auth.service';
import * as oauthService from '../services/oauth.service';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Rate limiter per endpoint di autenticazione (5 tentativi/minuto)
// Disabilitato in test per non far dipendere i test dall'ordine di esecuzione.
const authLimiter =
  process.env.NODE_ENV === 'test'
    ? (_req: Request, _res: Response, next: () => void) => next()
    : rateLimit({
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

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registrazione con email e password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               name: { type: string, maxLength: 100, description: "Nome visualizzato (opzionale)" }
 *     responses:
 *       201: { description: Utente creato, token restituiti }
 *       400: { description: Errore di validazione }
 *       409: { description: Email già registrata }
 */
// ── POST /auth/register ───────────────────────────────────────────────────────

router.post(
  '/register',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail({ gmail_remove_dots: false }).withMessage('Email non valida'),
    body('password').isLength({ min: 8 }).withMessage('Password minimo 8 caratteri'),
    body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Nome non valido'),
  ],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;

    try {
      const { email, password, name } = req.body;
      const result = await authService.register(email, password, name, req.ip);
      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      res.status(err.status || 500).json({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
      });
    }
  }
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login con email e password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200: { description: Login riuscito, token restituiti }
 *       401: { description: Credenziali non valide }
 */
// ── POST /auth/login ──────────────────────────────────────────────────────────

router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail({ gmail_remove_dots: false }).withMessage('Email non valida'),
    body('password').notEmpty().withMessage('Password obbligatoria'),
  ],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;

    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password, req.ip);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(err.status || 500).json({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
      });
    }
  }
);

/**
 * @swagger
 * /auth/oauth/google:
 *   post:
 *     summary: Login/registrazione con ID token Google
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties:
 *               idToken: { type: string, description: "ID token restituito da Google Sign-In" }
 *     responses:
 *       200: { description: Login riuscito, token restituiti }
 *       401: { description: Token Google non valido }
 */
// ── POST /auth/oauth/google ───────────────────────────────────────────────────

router.post(
  '/oauth/google',
  authLimiter,
  [body('idToken').notEmpty().withMessage('idToken obbligatorio')],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;

    try {
      const result = await oauthService.loginWithGoogle(req.body.idToken, req.ip);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(err.status || 500).json({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
      });
    }
  }
);

/**
 * @swagger
 * /auth/oauth/apple:
 *   post:
 *     summary: Login/registrazione con identity token Apple
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [identityToken]
 *             properties:
 *               identityToken: { type: string, description: "Identity token restituito da Sign in with Apple" }
 *     responses:
 *       200: { description: Login riuscito, token restituiti }
 *       401: { description: Token Apple non valido }
 */
// ── POST /auth/oauth/apple ────────────────────────────────────────────────────

router.post(
  '/oauth/apple',
  authLimiter,
  [body('identityToken').notEmpty().withMessage('identityToken obbligatorio')],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;

    try {
      const result = await oauthService.loginWithApple(req.body.identityToken, req.ip);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(err.status || 500).json({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
      });
    }
  }
);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Rinnova access token con refresh token (rotation)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: Nuovi token restituiti }
 *       401: { description: Refresh token non valido o scaduto }
 */
// ── POST /auth/refresh ────────────────────────────────────────────────────────

router.post(
  '/refresh',
  [body('refreshToken').notEmpty().withMessage('Refresh token obbligatorio')],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;

    try {
      const result = await authService.refresh(req.body.refreshToken, req.ip);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(err.status || 500).json({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
      });
    }
  }
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Invalida il refresh token corrente
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: Logout effettuato }
 */
// ── POST /auth/logout ─────────────────────────────────────────────────────────

router.post(
  '/logout',
  [body('refreshToken').notEmpty().withMessage('Refresh token obbligatorio')],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;

    try {
      await authService.logout(req.body.refreshToken, req.ip);
      res.json({ success: true, data: { message: 'Logout effettuato' } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
    }
  }
);

/**
 * @swagger
 * /auth/account:
 *   delete:
 *     summary: Richiede l'eliminazione dell'account (periodo di grazia 30gg)
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "Eliminazione schedulata, restituisce graceUntil" }
 *       401: { description: Token mancante, scaduto o non valido }
 */
// ── DELETE /auth/account ──────────────────────────────────────────────────────

router.delete('/account', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await authService.requestAccountDeletion(req.userId!, req.ip);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

/**
 * @swagger
 * /auth/account/cancel-deletion:
 *   post:
 *     summary: Annulla una richiesta di eliminazione account in corso
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Eliminazione annullata }
 *       401: { description: Token mancante, scaduto o non valido }
 */
// ── POST /auth/account/cancel-deletion ───────────────────────────────────────

router.post('/account/cancel-deletion', requireAuth, async (req: Request, res: Response) => {
  try {
    await authService.cancelAccountDeletion(req.userId!, req.ip);
    res.json({ success: true, data: { message: 'Eliminazione annullata' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Richiede il reset della password (invia email se l'account esiste)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200: { description: "Risposta sempre identica, esista o meno l'account" }
 */
// ── POST /auth/forgot-password ────────────────────────────────────────────────

router.post(
  '/forgot-password',
  authLimiter,
  [body('email').isEmail().normalizeEmail({ gmail_remove_dots: false }).withMessage('Email non valida')],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;

    try {
      await authService.requestPasswordReset(req.body.email, req.ip);
    } catch {
      // Non propagato al client: la risposta resta identica in ogni caso.
    }
    res.json({
      success: true,
      data: { message: "Se l'indirizzo è registrato, riceverai un'email con le istruzioni" },
    });
  }
);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Imposta una nuova password tramite il token ricevuto via email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Password aggiornata }
 *       401: { description: Token non valido o scaduto }
 */
// ── POST /auth/reset-password ─────────────────────────────────────────────────

router.post(
  '/reset-password',
  authLimiter,
  [
    body('token').notEmpty().withMessage('Token obbligatorio'),
    body('newPassword').isLength({ min: 8 }).withMessage('Nuova password minimo 8 caratteri'),
  ],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;

    try {
      await authService.resetPassword(req.body.token, req.body.newPassword, req.ip);
      res.json({ success: true, data: { message: 'Password aggiornata' } });
    } catch (err: any) {
      res.status(err.status || 500).json({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
      });
    }
  }
);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Profilo dell'utente autenticato
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Profilo utente }
 *       401: { description: Token mancante, scaduto o non valido }
 */
// ── GET /auth/me ──────────────────────────────────────────────────────────────

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const profile = await authService.getProfile(req.userId!);
    res.json({ success: true, data: profile });
  } catch (err: any) {
    res.status(err.status || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
});

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Cambia la password dell'utente autenticato
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Password aggiornata }
 *       401: { description: Password attuale non corretta }
 */
// ── POST /auth/change-password ────────────────────────────────────────────────

router.post(
  '/change-password',
  requireAuth,
  authLimiter,
  [
    body('currentPassword').notEmpty().withMessage('Password attuale obbligatoria'),
    body('newPassword').isLength({ min: 8 }).withMessage('Nuova password minimo 8 caratteri'),
  ],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;

    try {
      await authService.changePassword(req.userId!, req.body.currentPassword, req.body.newPassword, req.ip);
      res.json({ success: true, data: { message: 'Password aggiornata' } });
    } catch (err: any) {
      res.status(err.status || 500).json({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
      });
    }
  }
);

export default router;