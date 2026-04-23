import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import env from '../config/env';
import db from '../config/database';
import { UserRow, SafeUser } from '../types';

const SALT_ROUNDS = 12;

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role_id?: number;
  plant_ids?: number[];
}

export const generateToken = (userId: string, role: string): string =>
  jwt.sign({ sub: userId, role }, env.jwt.secret, { expiresIn: env.jwt.expiresIn } as object);

export const login = async (
  email: string,
  password: string
): Promise<{ token: string; user: SafeUser }> => {
  const { rows } = await db.query<UserRow>(
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...safeUser } = user;
  return { token, user: safeUser };
};

export const createUser = async ({
  name,
  email,
  password,
  role_id = 2,
  plant_ids = [],
}: CreateUserInput): Promise<Pick<UserRow, 'id' | 'name' | 'email' | 'role_id' | 'created_at'>> => {
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const { rows } = await db.query<Pick<UserRow, 'id' | 'name' | 'email' | 'role_id' | 'created_at'>>(
    'INSERT INTO users (name, email, password_hash, role_id, plant_ids) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role_id, created_at',
    [name, email.toLowerCase().trim(), hash, role_id, plant_ids]
  );
  return rows[0];
};

export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  const { rows } = await db.query<{ password_hash: string }>(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId]
  );
  if (!rows[0]) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!valid) throw Object.assign(new Error('Current password incorrect'), { statusCode: 400 });

  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, userId]);
};
