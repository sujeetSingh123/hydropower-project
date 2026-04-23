import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import env from '../config/env';

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const transports: winston.transport[] = [
  new DailyRotateFile({
    dirname: env.logging.dir,
    filename: 'app-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    level: 'info',
    format: combine(timestamp(), errors({ stack: true }), json()),
  }),
  new DailyRotateFile({
    dirname: env.logging.dir,
    filename: 'error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '90d',
    level: 'error',
    format: combine(timestamp(), errors({ stack: true }), json()),
  }),
];

if (env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: combine(colorize(), simple()),
    })
  );
}

const logger = winston.createLogger({
  level: env.logging.level,
  format: combine(timestamp(), errors({ stack: true }), json()),
  transports,
  exitOnError: false,
});

export default logger;
