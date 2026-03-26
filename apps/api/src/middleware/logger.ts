import pino from 'pino';
import pinoHttp from 'pino-http';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(process.env.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
    : {}),
});

export const httpLogger = pinoHttp({
  logger,
  // Don't log health checks — they're noisy
  autoLogging: {
    ignore: (req) => req.url === '/api/v1/health',
  },
});
