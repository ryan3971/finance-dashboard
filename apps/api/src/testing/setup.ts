import '@/lib/config'; // ensures dotenv runs before tests

import { afterAll, vi } from 'vitest';
import { cleanDatabase } from '@/testing/test-helpers';

// Override DATABASE_URL for the test environment.
// Tests run against finance_test, never finance_dev.
// This means manual dev data (Bruno sessions, imported CSVs) is never wiped.
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}

// Silence Pino during tests — log output from services is noise in test runs.
// Individual tests can restore specific log methods if they need to assert on them.
// Clean up the last test's data after every file completes. The beforeEach in
// each test file handles all-but-last tests; this handles the final one.
afterAll(async () => {
  await cleanDatabase();
});

vi.mock('@/middleware/logger', () => {
  const mockLogger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };
  return {
    logger: mockLogger,
    // Mirrors what pino-http does: attaches a request-scoped logger to req.log.
    // Without this, routes that call req.log.child() crash in tests.
    httpLogger: vi.fn((req: Record<string, unknown>, _res: unknown, next: () => void) => {
      req.log = mockLogger;
      next();
    }),
  };
});
