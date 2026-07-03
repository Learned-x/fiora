import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub: string; // user id
}

// Estende Request per aggiungere userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ success: false, error: { code: 'AUTH_TOKEN_MISSING', message: 'Token mancante' } });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.userId = payload.sub;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ success: false, error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Token scaduto' } });
      return;
    }
    res.status(401).json({ success: false, error: { code: 'AUTH_TOKEN_INVALID', message: 'Token non valido' } });
  }
};
