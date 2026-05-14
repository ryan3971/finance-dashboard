import '@/lib/config'; // ensures dotenv runs before the DB pool is created
import { closeDb } from '@/db';
import { resetTestSystemData } from '@/testing/seeders/reset-test-system-data';

// Point DATABASE_URL at the test DB before the pool is created.
// This mirrors the override in setup.ts, but must also happen here because
// globalSetup runs in the main process before any worker inherits the env.
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}

export async function setup(): Promise<void> {
  await resetTestSystemData();
}

export async function teardown(): Promise<void> {
  await closeDb();
}
