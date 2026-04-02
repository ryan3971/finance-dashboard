import { config } from '@/lib/config';
import pino from 'pino';
import pinoHttp from 'pino-http';

export const logger = pino({
  level: config.logLevel,
  ...(config.nodeEnv === 'development'
    ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
    : {}),
});

export const httpLogger = pinoHttp({
  logger,
  redact: ['req.headers.authorization', 'req.headers.cookie'],
  // Don't log health checks — they're noisy
  autoLogging: {
    ignore: (req) => req.url === '/api/v1/health',
  },
});
