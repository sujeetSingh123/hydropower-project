import express, { Request } from 'express';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import env from './config/env';
import logger from './utils/logger';
import routes from './routes';
import { notFound, errorHandler } from './middleware/errorHandler';
import * as scadaPoller from './workers/scadaPoller';
import * as dailySummary from './workers/dailySummary';

const app = express();
const server = http.createServer(app);

const io = new SocketServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 30000,
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(morgan('combined', { stream: { write: (msg: string) => logger.info(msg.trim()) } }));

app.use(
  rateLimit({
    windowMs: 60_000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request) => req.path === '/api/readings/live',
  })
);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', routes);

// ─── Socket.IO ───────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  logger.debug('WS client connected', { id: socket.id });
  socket.on('subscribe', (rooms: string | string[]) => { void socket.join(rooms); });
  socket.on('disconnect', () => logger.debug('WS client disconnected', { id: socket.id }));
});

// ─── Error handling ───────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Startup ─────────────────────────────────────────────────────────────────
const PORT = env.PORT;

server.listen(PORT, () => {
  logger.info('Hydropower Monitor server started', { port: PORT, env: env.NODE_ENV });

  // Start background workers
  scadaPoller.start(io);
  dailySummary.start();
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
const shutdown = async (signal: string): Promise<void> => {
  logger.info(`Received ${signal}, shutting down...`);
  await scadaPoller.stop();
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000);
};

process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT', () => { void shutdown('SIGINT'); });
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
});
process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled rejection', { reason });
});

export { app, server };
