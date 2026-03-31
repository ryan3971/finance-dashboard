import { config } from './lib/config';
import { createApp } from './app';
import { logger } from './middleware/logger';

const app = createApp();

app.listen(config.port, () => {
  logger.info({ port: config.port }, `API server started`);
});
