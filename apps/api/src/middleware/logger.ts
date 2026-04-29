import { config } from '@/lib/config';
import { randomUUID } from 'node:crypto';
import pino from 'pino';
import pinoHttp from 'pino-http';
import type PinoPretty from 'pino-pretty';
import type NodeFs from 'node:fs';

function createLogger(): pino.Logger {
  if (config.nodeEnv === 'production') {
    // JSON to stdout — the container runtime collects it
    return pino({ level: config.logLevel });
  }

  // pino-pretty is a devDependency; require() so it isn't loaded in production
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pretty = require('pino-pretty') as typeof PinoPretty;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs') as typeof NodeFs;

  const streams: pino.StreamEntry[] = [
    { stream: pretty({ colorize: true }) },
    {
      stream: pretty({
        colorize: false,
        destination: fs.createWriteStream('logs/app.log', { flags: 'a' }),
      }),
    },
  ];

  return pino({ level: config.logLevel }, pino.multistream(streams));
}

export const logger = createLogger();

export const httpLogger = pinoHttp({
  logger,
  genReqId: () => randomUUID(),
  redact: ['req.headers.authorization', 'req.headers.cookie'],
  // Don't log health checks — they're noisy
  autoLogging: {
    ignore: (req) => req.url === '/api/v1/health',
  },
});
