import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

// Override DATABASE_URL for the test environment.
// Tests run against finance_test, never finance_dev.
// This means manual dev data (Bruno sessions, imported CSVs) is never wiped.
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}