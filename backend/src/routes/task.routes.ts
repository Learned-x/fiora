import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import * as taskService from '../services/task.service';

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
 * /tasks:
 *   get:
 *     summary: Lista task dell'utente (tutte le piante), filtrabile per stato e periodo
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: stato
 *         schema: { type: string, enum: [pending, completato, rimandato, saltato] }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *         description: Scadenza minima
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *         description: Scadenza massima
 *       - in: query
 *         name: completatoFrom
 *         schema: { type: string, format: date-time }
 *         description: Completato a partire da (filtra su completatoA, non su scadenza)
 *       - in: query
 *         name: completatoTo
 *         schema: { type: string, format: date-time }
 *         description: Completato fino a (filtra su completatoA, non su scadenza)
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 500, default: 200 }
 *         description: Numero massimo di task restituiti
 *       - in: query
 *         name: offset
 *         schema: { type: integer, minimum: 0, default: 0 }
 *     responses:
 *       200: { description: Lista task con pianta associata }
 */
// ── GET /tasks ────────────────────────────────────────────────────────────────

router.get(
  '/',
  [
    query('stato').optional().isIn(['pending', 'completato', 'rimandato', 'saltato']).withMessage('Stato non valido'),
    query('from').optional().isISO8601().withMessage('from non valido'),
    query('to').optional().isISO8601().withMessage('to non valido'),
    query('completatoFrom').optional().isISO8601().withMessage('completatoFrom non valido'),
    query('completatoTo').optional().isISO8601().withMessage('completatoTo non valido'),
    query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('limit non valido (1-500)'),
    query('offset').optional().isInt({ min: 0 }).withMessage('offset non valido'),
  ],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    try {
      const tasks = await taskService.listTasks(req.userId!, {
        stato: req.query.stato as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        completatoFrom: req.query.completatoFrom as string | undefined,
        completatoTo: req.query.completatoTo as string | undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      });
      res.json({ success: true, data: tasks });
    } catch (err: any) {
      handleError(res, err);
    }
  }
);

/**
 * @swagger
 * /tasks/{id}:
 *   patch:
 *     summary: Aggiorna lo stato di un task (completa, rimanda, salta)
 *     tags: [Tasks]
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
 *             required: [azione]
 *             properties:
 *               azione: { type: string, enum: [completa, rimanda, salta] }
 *               scadenza: { type: string, format: date-time, description: "Nuova scadenza (obbligatoria per rimanda)" }
 *               nota: { type: string, description: "Nota opzionale (per completa)" }
 *     responses:
 *       200: { description: Task aggiornato }
 *       404: { description: Task non trovato }
 *       409: { description: Task già completato }
 */
// ── PATCH /tasks/:id ──────────────────────────────────────────────────────────

router.patch(
  '/:id',
  [
    param('id').isUUID().withMessage('ID non valido'),
    body('azione').isIn(['completa', 'rimanda', 'salta']).withMessage('Azione non valida: completa, rimanda o salta'),
    body('scadenza')
      .if(body('azione').equals('rimanda'))
      .isISO8601()
      .withMessage('Scadenza obbligatoria per rimandare un task'),
    body('nota').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    try {
      const { azione, scadenza, nota } = req.body;
      let task;
      if (azione === 'completa') {
        task = await taskService.completeTask(req.userId!, (req.params.id as string), nota);
      } else if (azione === 'rimanda') {
        task = await taskService.postponeTask(req.userId!, (req.params.id as string), scadenza);
      } else {
        task = await taskService.skipTask(req.userId!, (req.params.id as string));
      }
      res.json({ success: true, data: task });
    } catch (err: any) {
      handleError(res, err);
    }
  }
);

/**
 * @swagger
 * /tasks/{id}:
 *   delete:
 *     summary: Elimina un task
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Task eliminato }
 *       404: { description: Task non trovato }
 */
// ── DELETE /tasks/:id ─────────────────────────────────────────────────────────

router.delete(
  '/:id',
  [param('id').isUUID().withMessage('ID non valido')],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    try {
      await taskService.deleteTask(req.userId!, (req.params.id as string));
      res.json({ success: true, data: { message: 'Task eliminato' } });
    } catch (err: any) {
      handleError(res, err);
    }
  }
);

export default router;
