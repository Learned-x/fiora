import { Router, Request, Response } from 'express';
import * as appOptionService from '../services/app-option.service';

const router = Router();

/**
 * @swagger
 * /options:
 *   get:
 *     summary: Lista tutte le opzioni dinamiche (dropdown) attive
 *     tags: [Options]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista opzioni }
 */
// ── GET /options ───────────────────────────────────────────────────────────────

router.get('/', async (_req: Request, res: Response) => {
  try {
    const options = await appOptionService.listOptions();
    res.json({ success: true, data: options });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

/**
 * @swagger
 * /options/{categoria}:
 *   get:
 *     summary: Lista le opzioni dinamiche attive per una categoria
 *     tags: [Options]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: categoria
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Lista opzioni della categoria }
 */
// ── GET /options/:categoria ────────────────────────────────────────────────────

router.get('/:categoria', async (req: Request, res: Response) => {
  try {
    const options = await appOptionService.listOptions(req.params.categoria as string);
    res.json({ success: true, data: options });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

export default router;
