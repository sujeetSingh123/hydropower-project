const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/database');

const SALT_ROUNDS = 12;

const generateToken = (userId, role) =>
  jwt.sign({ sub: userId, role }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });

const login = async (email, password) => {
  const { rows } = await db.query(
    `SELECT u.id, u.name, u.email, u.password_hash, u.role_id, u.is_active,
            r.name AS role, r.permissions, u.plant_ids
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.email = $1`,
    [email.toLowerCase().trim()]
  );

  const user = rows[0];
  if (!user || !user.is_active) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

  const token = generateToken(user.id, user.role);
  const { password_hash, ...safeUser } = user;
  return { token, user: safeUser };
};

const createUser = async ({ name, email, password, role_id = 2, plant_ids = [] }) => {
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const { rows } = await db.query(
    'INSERT INTO users (name, email, password_hash, role_id, plant_ids) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role_id, created_at',
    [name, email.toLowerCase().trim(), hash, role_id, plant_ids]
  );
  return rows[0];
};

const changePassword = async (userId, currentPassword, newPassword) => {
  const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  if (!rows[0]) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!valid) throw Object.assign(new Error('Current password incorrect'), { statusCode: 400 });

  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, userId]);
};

module.exports = { login, createUser, changePassword, generateToken };
