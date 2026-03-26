import * as dotenv from 'dotenv';
import * as path from 'path';

// When pnpm runs scripts, cwd is set to the package directory (apps/api).
// The monorepo root .env is two levels up from there.
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

import { createApp } from './app';
import { logger } from './middleware/logger';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

const app = createApp();

app.listen(PORT, () => {
  logger.info({ port: PORT }, `API server started`);
});
