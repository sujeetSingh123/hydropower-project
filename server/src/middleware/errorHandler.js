const logger = require('../utils/logger');

const notFound = (req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
};

const errorHandler = (err, req, res, next) => {
  const status = err.statusCode || err.status || 500;
  const message = status < 500 ? err.message : 'Internal server error';

  if (status >= 500) {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      method: req.method,
      path: req.path,
      user: req.user?.id,
    });
  }

  res.status(status).json({ error: message, ...(err.details && { details: err.details }) });
};

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { notFound, errorHandler, asyncHandler };
