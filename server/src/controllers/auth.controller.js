const { body, validationResult } = require('express-validator');
const authService = require('../services/auth.service');
const db = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
];

const login = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { token, user } = await authService.login(req.body.email, req.body.password);
  res.json({ token, user });
});

const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

const createUser = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const user = await authService.createUser(req.body);
  res.status(201).json({ user });
});

const listUsers = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    'SELECT u.id, u.name, u.email, r.name AS role, u.is_active, u.last_login_at, u.created_at FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.created_at DESC'
  );
  res.json({ users: rows });
});

const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, role_id, is_active } = req.body;
  const { rows } = await db.query(
    'UPDATE users SET name = COALESCE($1, name), role_id = COALESCE($2, role_id), is_active = COALESCE($3, is_active), updated_at = NOW() WHERE id = $4 RETURNING id, name, email, role_id, is_active',
    [name, role_id, is_active, id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json({ user: rows[0] });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user.id, currentPassword, newPassword);
  res.json({ message: 'Password changed successfully' });
});

module.exports = { loginValidation, login, me, createUser, listUsers, updateUser, changePassword };
