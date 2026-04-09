import { config } from '@/lib/config';
import fs from 'node:fs';
import pino from 'pino';
import pinoHttp from 'pino-http';
import pretty from 'pino-pretty';

const streams: pino.StreamEntry[] = [
  {
    stream:
      config.nodeEnv === 'development'
        ? pretty({ colorize: true })
        : process.stdout,
  },
  {
    stream: pretty({
      colorize: false,
      destination: fs.createWriteStream('logs/app.log', { flags: 'a' }),
    }),
  },
];

export const logger = pino(
  { level: config.logLevel },
  pino.multistream(streams)
);

export const httpLogger = pinoHttp({
  logger,
  redact: ['req.headers.authorization', 'req.headers.cookie'],
  // Don't log health checks — they're noisy
  autoLogging: {
    ignore: (req) => req.url === '/api/v1/health',
  },
});
