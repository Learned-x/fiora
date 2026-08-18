import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import * as plantService from '../services/plant.service';
import * as taskService from '../services/task.service';
import * as plantActionService from '../services/plant-action.service';

const router = Router();

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

function handleError(res: Response, err: any): void {
  res.status(err.status || 500).json({
    success: false,
    error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
  });
}

/**
 * @swagger
 * /plants:
 *   post:
 *     summary: Crea una nuova pianta o bouquet
 *     tags: [Plants]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome, tipo]
 *             properties:
 *               nome: { type: string, maxLength: 255 }
 *               tipo: { type: string, enum: [pianta, bouquet] }
 *               speciesId: { type: string, format: uuid }
 *               posizione: { type: string, maxLength: 255 }
 *               note: { type: string }
 *               fotoUrl: { type: string, maxLength: 500 }
 *               statoBouquet: { type: string, enum: [fresco, in_cura, appassendo, concluso] }
 *               dataRicezione: { type: string, format: date }
 *     responses:
 *       201: { description: Pianta creata }
 *       400: { description: Errore di validazione }
 *       404: { description: Specie non trovata }
 */
// ── POST /plants ──────────────────────────────────────────────────────────────

router.post(
  '/',
  [
    body('nome').trim().isLength({ min: 1, max: 255 }).withMessage('Nome obbligatorio (max 255 caratteri)'),
    body('tipo').isIn(['pianta', 'bouquet']).withMessage('Tipo non valido: pianta o bouquet'),
    body('speciesId').optional().isUUID().withMessage('speciesId non valido'),
    body('posizione').optional().trim().isLength({ max: 255 }).withMessage('Posizione troppo lunga'),
    body('note').optional().isString(),
    body('fotoUrl').optional().trim().isLength({ max: 500 }).withMessage('fotoUrl troppo lungo'),
    body('statoBouquet').optional().isIn(['fresco', 'in_cura', 'appassendo', 'concluso']).withMessage('statoBouquet non valido'),
    body('dataRicezione').optional().isISO8601().withMessage('dataRicezione non valida'),
    body('giaInAcqua').optional().isBoolean().withMessage('giaInAcqua non valido'),
  ],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    try {
      const plant = await plantService.createPlant(req.userId!, req.body);
      res.status(201).json({ success: true, data: plant });
    } catch (err: any) {
      handleError(res, err);
    }
  }
);

/**
 * @swagger
 * /plants:
 *   get:
 *     summary: Lista piante dell'utente
 *     tags: [Plants]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: stato
 *         schema: { type: string, enum: [attivo, archiviato], default: attivo }
 *     responses:
 *       200: { description: Lista piante con specie e conteggio task pending }
 */
// ── GET /plants ───────────────────────────────────────────────────────────────

router.get(
  '/',
  [query('stato').optional().isIn(['attivo', 'archiviato']).withMessage('Stato non valido')],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    try {
      const stato = (req.query.stato as 'attivo' | 'archiviato') || 'attivo';
      const plants = await plantService.listPlants(req.userId!, stato);
      res.json({ success: true, data: plants });
    } catch (err: any) {
      handleError(res, err);
    }
  }
);

/**
 * @swagger
 * /plants/{id}:
 *   get:
 *     summary: Dettaglio pianta con specie e task pending
 *     tags: [Plants]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Dettaglio pianta }
 *       404: { description: Pianta non trovata }
 */
// ── GET /plants/:id ───────────────────────────────────────────────────────────

router.get(
  '/:id',
  [param('id').isUUID().withMessage('ID non valido')],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    try {
      const plant = await plantService.getPlant(req.userId!, (req.params.id as string));
      res.json({ success: true, data: plant });
    } catch (err: any) {
      handleError(res, err);
    }
  }
);

/**
 * @swagger
 * /plants/{id}:
 *   patch:
 *     summary: Aggiorna una pianta (nome, posizione, note, specie, stato, ecc.)
 *     tags: [Plants]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome: { type: string, maxLength: 255 }
 *               speciesId: { type: string, format: uuid, nullable: true }
 *               posizione: { type: string, nullable: true }
 *               note: { type: string, nullable: true }
 *               fotoUrl: { type: string, nullable: true }
 *               stato: { type: string, enum: [attivo, archiviato] }
 *               statoBouquet: { type: string, enum: [fresco, in_cura, appassendo, concluso], nullable: true }
 *               dataRicezione: { type: string, format: date, nullable: true }
 *               sogliaUmiditaMin: { type: integer, nullable: true, description: "% — richiede vaso collegato" }
 *               sogliaUmiditaMax: { type: integer, nullable: true }
 *               sogliaLuceMin: { type: integer, nullable: true, description: "lux — richiede vaso collegato" }
 *               sogliaLuceMax: { type: integer, nullable: true }
 *               sogliaTempMin: { type: integer, nullable: true, description: "°C — richiede vaso collegato" }
 *               sogliaTempMax: { type: integer, nullable: true }
 *     responses:
 *       200: { description: Pianta aggiornata }
 *       404: { description: Pianta non trovata }
 */
// ── PATCH /plants/:id ─────────────────────────────────────────────────────────

router.patch(
  '/:id',
  [
    param('id').isUUID().withMessage('ID non valido'),
    body('nome').optional().trim().isLength({ min: 1, max: 255 }).withMessage('Nome non valido'),
    body('speciesId').optional({ nullable: true }).custom((v) => v === null || /^[0-9a-f-]{36}$/i.test(v)).withMessage('speciesId non valido'),
    body('posizione').optional({ nullable: true }).isLength({ max: 255 }).withMessage('Posizione troppo lunga'),
    body('note').optional({ nullable: true }),
    body('fotoUrl').optional({ nullable: true }).isLength({ max: 500 }).withMessage('fotoUrl troppo lungo'),
    body('stato').optional().isIn(['attivo', 'archiviato']).withMessage('Stato non valido: attivo o archiviato'),
    body('statoBouquet').optional({ nullable: true }).isIn(['fresco', 'in_cura', 'appassendo', 'concluso']).withMessage('statoBouquet non valido'),
    body('dataRicezione').optional({ nullable: true }).isISO8601().withMessage('dataRicezione non valida'),
    body('vasoId').optional({ nullable: true }).custom((v) => v === null || /^[0-9a-f-]{36}$/i.test(v)).withMessage('vasoId non valido'),
    body('sogliaUmiditaMin').optional({ nullable: true }).isInt({ min: 0, max: 100 }).withMessage('sogliaUmiditaMin non valida'),
    body('sogliaUmiditaMax').optional({ nullable: true }).isInt({ min: 0, max: 100 }).withMessage('sogliaUmiditaMax non valida'),
    body('sogliaLuceMin').optional({ nullable: true }).isInt({ min: 0 }).withMessage('sogliaLuceMin non valida'),
    body('sogliaLuceMax').optional({ nullable: true }).isInt({ min: 0 }).withMessage('sogliaLuceMax non valida'),
    body('sogliaTempMin').optional({ nullable: true }).isFloat({ min: -50, max: 80 }).withMessage('sogliaTempMin non valida'),
    body('sogliaTempMax').optional({ nullable: true }).isFloat({ min: -50, max: 80 }).withMessage('sogliaTempMax non valida'),
  ],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    try {
      const plant = await plantService.updatePlant(req.userId!, (req.params.id as string), req.body);
      res.json({ success: true, data: plant });
    } catch (err: any) {
      handleError(res, err);
    }
  }
);

/**
 * @swagger
 * /plants/{id}:
 *   delete:
 *     summary: Elimina una pianta (soft delete, i task pending vengono annullati)
 *     tags: [Plants]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Pianta eliminata }
 *       404: { description: Pianta non trovata }
 */
// ── DELETE /plants/:id ────────────────────────────────────────────────────────

router.delete(
  '/:id',
  [param('id').isUUID().withMessage('ID non valido')],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    try {
      await plantService.deletePlant(req.userId!, (req.params.id as string));
      res.json({ success: true, data: { message: 'Pianta eliminata' } });
    } catch (err: any) {
      handleError(res, err);
    }
  }
);

/**
 * @swagger
 * /plants/{id}/tasks:
 *   post:
 *     summary: Crea un task manuale per una pianta
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
 *             required: [tipo, scadenza]
 *             properties:
 *               tipo: { type: string, enum: [annaffiatura, concimazione, nebulizzazione, potatura, rinvaso, controllo] }
 *               scadenza: { type: string, format: date-time }
 *               nota: { type: string }
 *     responses:
 *       201: { description: Task creato }
 *       404: { description: Pianta non trovata }
 */
// ── POST /plants/:id/tasks ────────────────────────────────────────────────────

router.post(
  '/:id/tasks',
  [
    param('id').isUUID().withMessage('ID non valido'),
    body('tipo').isIn(taskService.TASK_TYPES).withMessage('Tipo task non valido'),
    body('scadenza').isISO8601().withMessage('Scadenza non valida'),
    body('nota').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    try {
      const task = await taskService.createTask(req.userId!, (req.params.id as string), req.body);
      res.status(201).json({ success: true, data: task });
    } catch (err: any) {
      handleError(res, err);
    }
  }
);

/**
 * @swagger
 * /plants/{id}/tasks:
 *   get:
 *     summary: Lista task di una pianta
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: stato
 *         schema: { type: string, enum: [pending, completato, rimandato, saltato] }
 *     responses:
 *       200: { description: Lista task della pianta }
 *       404: { description: Pianta non trovata }
 */
// ── GET /plants/:id/tasks ─────────────────────────────────────────────────────

router.get(
  '/:id/tasks',
  [
    param('id').isUUID().withMessage('ID non valido'),
    query('stato').optional().isIn(['pending', 'completato', 'rimandato', 'saltato']).withMessage('Stato non valido'),
  ],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    try {
      // Verifica ownership della pianta prima di listare i task
      await plantService.findOwnedPlant(req.userId!, (req.params.id as string));
      const tasks = await taskService.listTasks(req.userId!, {
        plantId: (req.params.id as string),
        stato: req.query.stato as string | undefined,
      });
      res.json({ success: true, data: tasks });
    } catch (err: any) {
      handleError(res, err);
    }
  }
);

/**
 * @swagger
 * /plants/{id}/actions:
 *   get:
 *     summary: Storico cure della pianta (action log paginato)
 *     tags: [Plants]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: tipo
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200: { description: "Storico cure: { items, total, limit, offset }" }
 *       404: { description: Pianta non trovata }
 */
// ── GET /plants/:id/actions ────────────────────────────────────────────────────

router.get(
  '/:id/actions',
  [
    param('id').isUUID().withMessage('ID non valido'),
    query('tipo').optional().isString(),
    query('from').optional().isISO8601().withMessage('from non valido'),
    query('to').optional().isISO8601().withMessage('to non valido'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit non valido (1-50)'),
    query('offset').optional().isInt({ min: 0 }).withMessage('offset non valido'),
  ],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    try {
      const result = await plantActionService.listPlantActions(
        req.userId!,
        req.params.id as string,
        {
          tipo: req.query.tipo as string | undefined,
          from: req.query.from as string | undefined,
          to: req.query.to as string | undefined,
        },
        {
          limit: req.query.limit ? Number(req.query.limit) : undefined,
          offset: req.query.offset ? Number(req.query.offset) : undefined,
        }
      );
      res.json({ success: true, data: result });
    } catch (err: any) {
      handleError(res, err);
    }
  }
);

export default router;
