import '@/lib/config'; // ensures dotenv runs before tests

// Reduce bcrypt work factor for tests. auth.service.ts reads this from process.env
// at module-load time (after setup runs), so it must be set here before any test
// file imports auth.service.ts. Using 4 rounds cuts per-test hashing time from
// ~300 ms to ~5 ms while still exercising the real bcrypt path.
process.env.BCRYPT_ROUNDS = '4';

import { beforeAll, vi } from 'vitest';
import { resetTestSystemData } from './seeders/reset-system-data';

// Override DATABASE_URL for the test environment.
// Tests run against finance_test, never finance_dev.
// This means manual dev data (Bruno sessions, imported CSVs) is never wiped.
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}

// Silence Pino during tests — log output from services is noise in test runs.
// Individual tests can restore specific log methods if they need to assert on them.
vi.mock('@/middleware/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
  httpLogger: vi.fn((req: unknown, res: unknown, next: () => void) => next()),
}));

// Seed the test category/rule set once per file before any test runs.
// System rows (userId IS NULL) survive cleanDatabase() between tests, so the
// set is stable for the whole file without per-test re-seeding.
// The replace is unconditional so a stale production set from a prior manual
// seed run can never bleed into tests.
beforeAll(async () => {
  await resetTestSystemData();
});
