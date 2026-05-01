/* eslint-disable no-console */
/**
 * Seeds or removes system categories and rules.
 *
 * Usage (from repo root):
 *   pnpm seed:system --action=add --env=<system|staging|test>
 *   pnpm seed:system --action=remove
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { addSystemCategories, removeSystemCategories } from '@/db/seeders/system-categories';
import { addSystemRules, removeSystemRules } from '@/db/seeders/system-rules';
import type { SeedEnv } from '@/db/seeders/system-categories';

const VALID_ENVS: SeedEnv[] = ['system', 'staging', 'test'];
const VALID_ACTIONS = ['add', 'remove'] as const;

type ParsedArgs =
  | { action: 'add'; env: SeedEnv }
  | { action: 'remove' };

function parseArgs(): ParsedArgs {
  const envArg = process.argv.find((a) => a.startsWith('--env='))?.split('=')[1];
  const actionArg = process.argv
    .find((a) => a.startsWith('--action='))
    ?.split('=')[1];

  if (!actionArg || !VALID_ACTIONS.includes(actionArg as 'add' | 'remove')) {
    console.error(
      `Usage: pnpm seed:system --env=<${VALID_ENVS.join('|')}> --action=add|remove`
    );
    process.exit(1);
  }

  const action = actionArg as 'add' | 'remove';

  if (action === 'remove') {
    return { action };
  }

  if (!envArg || !VALID_ENVS.includes(envArg as SeedEnv)) {
    console.error(
      `Usage: pnpm seed:system --env=<${VALID_ENVS.join('|')}> --action=add`
    );
    process.exit(1);
  }

  return { action, env: envArg as SeedEnv };
}

async function main() {
  const args = parseArgs();

  console.log(`Finance Dashboard — seed:system (action=${args.action})`);

  if (args.action === 'add') {
    await addSystemCategories(args.env);
    await addSystemRules(args.env);
  } else {
    await removeSystemRules();
    await removeSystemCategories();
  }

  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('seed:system failed:', err);
  process.exit(1);
});
