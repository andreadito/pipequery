import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { log } from '../utils/logger.js';
import { STARTER_YAML } from '../config/defaults.js';
import { printCompactBanner } from '../utils/banner.js';
import chalk from 'chalk';

export async function initCommand() {
  const target = resolve(process.cwd(), 'pipequery.yaml');

  if (existsSync(target)) {
    log.warn('pipequery.yaml already exists in this directory.');
    return;
  }

  printCompactBanner();

  await writeFile(target, STARTER_YAML, 'utf-8');
  log.success('Created pipequery.yaml');
  console.log();
  log.step(`Edit ${chalk.white.bold('pipequery.yaml')} to configure your data sources`);
  log.step(`Then run ${chalk.white.bold('pq serve')} to start the server`);
  console.log();
}
