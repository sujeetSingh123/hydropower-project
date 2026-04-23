import { Request, Response, NextFunction, RequestHandler } from 'express';
import logger from '../utils/logger';

interface AppError extends Error {
  statusCode?: number;
  status?: number;
  details?: unknown;
}

const notFound = (req: Request, res: Response): void => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
};

const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  const status = err.statusCode ?? err.status ?? 500;
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

  res.status(status).json({ error: message, ...(err.details !== undefined && { details: err.details }) });
};

type AsyncHandlerFn = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

const asyncHandler = (fn: AsyncHandlerFn): RequestHandler =>
  (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export { notFound, errorHandler, asyncHandler };
