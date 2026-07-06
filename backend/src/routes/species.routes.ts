import { Router, Request, Response } from 'express';
import { param, query, validationResult } from 'express-validator';
import * as speciesService from '../services/species.service';

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

/**
 * @swagger
 * /species:
 *   get:
 *     summary: Cerca nel catalogo specie (per associare una specie alla pianta)
 *     tags: [Species]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Ricerca su nome comune e scientifico
 *       - in: query
 *         name: categoria
 *         schema: { type: string, enum: [interno, succulenta, tropicale, aromatica, altro] }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200: { description: "Risultati: { items, total, limit, offset }" }
 */
// ── GET /species ──────────────────────────────────────────────────────────────

router.get(
  '/',
  [
    query('search').optional().isString().trim(),
    query('categoria').optional().isIn(['interno', 'succulenta', 'tropicale', 'aromatica', 'altro']).withMessage('Categoria non valida'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit non valido (1-50)'),
    query('offset').optional().isInt({ min: 0 }).withMessage('offset non valido'),
  ],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    try {
      const result = await speciesService.listSpecies({
        search: req.query.search as string | undefined,
        categoria: req.query.categoria as string | undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      });
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
 * /species/{id}:
 *   get:
 *     summary: Dettaglio di una specie
 *     tags: [Species]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Dettaglio specie }
 *       404: { description: Specie non trovata }
 */
// ── GET /species/:id ──────────────────────────────────────────────────────────

router.get(
  '/:id',
  [param('id').isUUID().withMessage('ID non valido')],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    try {
      const species = await speciesService.getSpecies((req.params.id as string));
      res.json({ success: true, data: species });
    } catch (err: any) {
      res.status(err.status || 500).json({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
      });
    }
  }
);

export default router;
