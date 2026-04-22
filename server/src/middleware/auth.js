const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/database');

const authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.jwt.secret);
    const { rows } = await db.query(
      'SELECT u.id, u.name, u.email, u.role_id, r.name AS role, r.permissions, u.plant_ids FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1 AND u.is_active = TRUE',
      [payload.sub]
    );
    if (!rows[0]) return res.status(401).json({ error: 'User not found' });
    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' });
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const authorize = (...requiredPermissions) => (req, res, next) => {
  if (req.user.role === 'admin') return next();
  const missing = requiredPermissions.filter((p) => !req.user.permissions[p]);
  if (missing.length > 0) {
    return res.status(403).json({ error: 'Insufficient permissions', required: missing });
  }
  next();
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
};

module.exports = { authenticate, authorize, requireRole };
