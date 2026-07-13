import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import * as userService from '../services/user.service';
import { FATTORE_CLIMA } from '../services/reminder.service';

const router = Router();

const CLIMA_VALORI = Object.keys(FATTORE_CLIMA);

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
 * /users/me:
 *   patch:
 *     summary: Aggiorna il profilo dell'utente autenticato
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, maxLength: 100 }
 *               clima: { type: string, enum: [freddo, temperato, appartamento, mediterraneo, tropicale] }
 *               mostraNomiScientifici: { type: boolean }
 *               orarioReminder: { type: string, maxLength: 50 }
 *               onboardingDone: { type: boolean }
 *               pushToken: { type: string, nullable: true, maxLength: 255 }
 *     responses:
 *       200: { description: Profilo aggiornato }
 *       400: { description: Errore di validazione }
 */
// ── PATCH /users/me ────────────────────────────────────────────────────────────

router.patch(
  '/me',
  [
    body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Nome non valido'),
    body('clima').optional().isIn(CLIMA_VALORI).withMessage('Clima non valido'),
    body('mostraNomiScientifici').optional().isBoolean().withMessage('mostraNomiScientifici non valido'),
    body('orarioReminder').optional().isString().isLength({ max: 50 }).withMessage('orarioReminder non valido'),
    body('onboardingDone').optional().isBoolean().withMessage('onboardingDone non valido'),
    body('pushToken')
      .optional({ values: 'undefined' })
      .custom((v) => v === null || (typeof v === 'string' && v.length >= 1 && v.length <= 255))
      .withMessage('pushToken non valido'),
  ],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;

    try {
      const profile = await userService.updateProfile(req.userId!, {
        name: req.body.name,
        clima: req.body.clima,
        mostraNomiScientifici: req.body.mostraNomiScientifici,
        orarioReminder: req.body.orarioReminder,
        onboardingDone: req.body.onboardingDone,
        pushToken: req.body.pushToken,
      });
      res.json({ success: true, data: profile });
    } catch (err: any) {
      res.status(err.status || 500).json({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
      });
    }
  }
);

export default router;
