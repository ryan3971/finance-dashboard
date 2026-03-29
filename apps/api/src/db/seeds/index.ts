import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

import { seedSystemCategories } from './categories';

async function main() {
  await seedSystemCategories();
  console.log('All seeds complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});