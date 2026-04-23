import { body, validationResult } from 'express-validator';
import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import db from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

export const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
];

export const login = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

  const { token, user } = await authService.login(req.body.email as string, req.body.password as string);
  res.json({ token, user });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  res.json({ user: req.user });
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

  const user = await authService.createUser(req.body as authService.CreateUserInput);
  res.status(201).json({ user });
});

export const listUsers = asyncHandler(async (_req: Request, res: Response) => {
  const { rows } = await db.query(
    'SELECT u.id, u.name, u.email, r.name AS role, u.is_active, u.last_login_at, u.created_at FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.created_at DESC'
  );
  res.json({ users: rows });
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, role_id, is_active } = req.body as { name?: string; role_id?: number; is_active?: boolean };
  const { rows } = await db.query(
    'UPDATE users SET name = COALESCE($1, name), role_id = COALESCE($2, role_id), is_active = COALESCE($3, is_active), updated_at = NOW() WHERE id = $4 RETURNING id, name, email, role_id, is_active',
    [name, role_id, is_active, id]
  );
  if (!rows[0]) { res.status(404).json({ error: 'User not found' }); return; }
  res.json({ user: rows[0] });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  await authService.changePassword(req.user!.id, currentPassword, newPassword);
  res.json({ message: 'Password changed successfully' });
});
