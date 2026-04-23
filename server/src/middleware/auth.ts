import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env';
import db from '../config/database';
import { AuthenticatedUser, JwtPayload } from '../types';

const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.jwt.secret) as JwtPayload;
    const { rows } = await db.query<AuthenticatedUser>(
      'SELECT u.id, u.name, u.email, u.role_id, r.name AS role, r.permissions, u.plant_ids FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1 AND u.is_active = TRUE',
      [payload.sub]
    );
    if (!rows[0]) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    req.user = rows[0];
    next();
  } catch (err) {
    if (err instanceof Error && err.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    res.status(401).json({ error: 'Invalid token' });
  }
};

const authorize = (...requiredPermissions: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (req.user?.role === 'admin') { next(); return; }
    const missing = requiredPermissions.filter((p) => !req.user?.permissions[p]);
    if (missing.length > 0) {
      res.status(403).json({ error: 'Insufficient permissions', required: missing });
      return;
    }
    next();
  };

const requireRole = (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    next();
  };

export { authenticate, authorize, requireRole };
