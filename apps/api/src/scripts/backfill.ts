/* eslint-disable no-console */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { backfillCategoriesToAllUsers } from '@/db/seeders/backfill-categories';
import { backfillRulesToAllUsers } from '@/db/seeders/backfill-rules';

const VALID_ENTITIES = ['categories', 'rules'] as const;
type BackfillEntity = (typeof VALID_ENTITIES)[number];

function parseArgs(): { entity: BackfillEntity } {
  const entityArg = process.argv
    .find((a) => a.startsWith('--entity='))
    ?.split('=')[1];

  if (!entityArg || !VALID_ENTITIES.includes(entityArg as BackfillEntity)) {
    console.error(
      `Usage: pnpm backfill --entity=<${VALID_ENTITIES.join('|')}>`
    );
    process.exit(1);
  }

  return { entity: entityArg as BackfillEntity };
}

async function main() {
  const { entity } = parseArgs();

  console.log(`Finance Dashboard — backfill (entity=${entity})`);

  if (entity === 'categories') {
    await backfillCategoriesToAllUsers();
  } else {
    await backfillRulesToAllUsers();
  }

  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('backfill failed:', err);
  process.exit(1);
});
