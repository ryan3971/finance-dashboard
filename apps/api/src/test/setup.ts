import '../lib/config'; // ensures dotenv runs before tests
import { vi } from 'vitest';

// Override DATABASE_URL for the test environment.
// Tests run against finance_test, never finance_dev.
// This means manual dev data (Bruno sessions, imported CSVs) is never wiped.
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}

// Silence Pino during tests — log output from services is noise in test runs.
// Individual tests can restore specific log methods if they need to assert on them.
vi.mock('../middleware/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
  httpLogger: vi.fn((req: unknown, res: unknown, next: () => void) => next()),
}));