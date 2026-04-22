require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const logger = require('./utils/logger');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const scadaPoller = require('./workers/scadaPoller');
const dailySummary = require('./workers/dailySummary');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 30000,
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

app.use(
  rateLimit({
    windowMs: 60_000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/api/readings/live',
  })
);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', routes);

// ─── Socket.IO ───────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  logger.debug('WS client connected', { id: socket.id });
  socket.on('subscribe', (rooms) => socket.join(rooms));
  socket.on('disconnect', () => logger.debug('WS client disconnected', { id: socket.id }));
});

// ─── Error handling ───────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Startup ─────────────────────────────────────────────────────────────────
const PORT = env.PORT;

server.listen(PORT, async () => {
  logger.info(`Hydropower Monitor server started`, { port: PORT, env: env.NODE_ENV });

  // Start background workers
  scadaPoller.start(io);
  dailySummary.start();
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
const shutdown = async (signal) => {
  logger.info(`Received ${signal}, shutting down...`);
  await scadaPoller.stop();
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => { logger.error('Uncaught exception', { error: err.message, stack: err.stack }); });
process.on('unhandledRejection', (reason) => { logger.error('Unhandled rejection', { reason }); });

module.exports = { app, server };
