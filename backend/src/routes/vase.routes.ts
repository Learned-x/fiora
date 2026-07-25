import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import * as vaseService from '../services/vase.service';

const router = Router();

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

function handleError(res: Response, err: any): void {
  res.status(err.status || 500).json({
    success: false,
    error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
  });
}

/**
 * @swagger
 * /vases/pair:
 *   post:
 *     summary: Avvia il pairing di un nuovo vaso (genera device_id e credenziali MQTT)
 *     tags: [Vases]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: "Vaso creato in stato disconnesso, con credenziali da trasferire via BLE" }
 */
// ── POST /vases/pair ───────────────────────────────────────────────────────────

router.post('/pair', async (req: Request, res: Response) => {
  try {
    const result = await vaseService.startPairing(req.userId!);
    res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    handleError(res, err);
  }
});

/**
 * @swagger
 * /vases:
 *   get:
 *     summary: Lista vasi dell'utente
 *     tags: [Vases]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista vasi }
 */
// ── GET /vases ────────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const vases = await vaseService.listVases(req.userId!);
    res.json({ success: true, data: vases });
  } catch (err: any) {
    handleError(res, err);
  }
});

/**
 * @swagger
 * /vases/{id}:
 *   get:
 *     summary: Stato e dati vaso
 *     tags: [Vases]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Dettaglio vaso }
 *       404: { description: Vaso non trovato }
 */
// ── GET /vases/:id ────────────────────────────────────────────────────────────

router.get(
  '/:id',
  [param('id').isUUID().withMessage('ID non valido')],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    try {
      const vase = await vaseService.getVase(req.userId!, req.params.id as string);
      res.json({ success: true, data: vase });
    } catch (err: any) {
      handleError(res, err);
    }
  }
);

/**
 * @swagger
 * /vases/{id}/readings:
 *   get:
 *     summary: Letture sensori ultime 24h
 *     tags: [Vases]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Letture sensori ultime 24h }
 *       404: { description: Vaso non trovato }
 */
// ── GET /vases/:id/readings ───────────────────────────────────────────────────

router.get(
  '/:id/readings',
  [param('id').isUUID().withMessage('ID non valido')],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    try {
      const readings = await vaseService.getVaseReadings24h(req.userId!, req.params.id as string);
      res.json({ success: true, data: readings });
    } catch (err: any) {
      handleError(res, err);
    }
  }
);

/**
 * @swagger
 * /vases/{id}:
 *   patch:
 *     summary: Modifica nome vaso
 *     tags: [Vases]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome]
 *             properties:
 *               nome: { type: string, maxLength: 255 }
 *     responses:
 *       200: { description: Vaso aggiornato }
 *       404: { description: Vaso non trovato }
 */
// ── PATCH /vases/:id ──────────────────────────────────────────────────────────

router.patch(
  '/:id',
  [
    param('id').isUUID().withMessage('ID non valido'),
    body('nome').trim().isLength({ min: 1, max: 255 }).withMessage('Nome obbligatorio (max 255 caratteri)'),
  ],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    try {
      const vase = await vaseService.renameVase(req.userId!, req.params.id as string, req.body.nome);
      res.json({ success: true, data: vase });
    } catch (err: any) {
      handleError(res, err);
    }
  }
);

/**
 * @swagger
 * /vases/{id}:
 *   delete:
 *     summary: Rimuovi vaso
 *     tags: [Vases]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Vaso eliminato }
 *       404: { description: Vaso non trovato }
 */
// ── DELETE /vases/:id ─────────────────────────────────────────────────────────

router.delete(
  '/:id',
  [param('id').isUUID().withMessage('ID non valido')],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    try {
      await vaseService.deleteVase(req.userId!, req.params.id as string);
      res.json({ success: true, data: { message: 'Vaso eliminato' } });
    } catch (err: any) {
      handleError(res, err);
    }
  }
);

export default router;
