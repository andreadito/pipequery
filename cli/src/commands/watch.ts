import chalk from 'chalk';
import { loadConfig, saveConfig } from '../config/loader.js';
import { log } from '../utils/logger.js';
import type { WatchConfig } from '../config/schema.js';

export async function watchListCommand(): Promise<void> {
  const cwd = process.cwd();
  const { config } = await loadConfig(cwd);
  const watches = config.watches ?? {};
  const entries = Object.entries(watches);
  if (entries.length === 0) {
    log.dim('No watches configured. Add one with: pq watch add <name>');
    return;
  }
  console.log(chalk.bold('Watches:\n'));
  for (const [name, w] of entries) {
    const interval = w.interval ?? '60s';
    const fireWhen = w.fireWhen ?? 'when_non_empty';
    const channels = Object.keys(w.notify).join(', ') || '<none>';
    console.log(`  ${chalk.bold(name)}  ${chalk.dim(`every ${interval} • ${fireWhen}`)}`);
    console.log(`    ${chalk.dim('query:  ')}${w.query}`);
    console.log(`    ${chalk.dim('notify: ')}${channels}`);
  }
}

export async function watchAddCommand(name: string, opts: {
  query: string;
  interval?: string;
  fireWhen?: string;
  telegramChatId?: string;
  telegramMessage?: string;
  telegramBotToken?: string;
}): Promise<void> {
  const cwd = process.cwd();
  const { config, path: configPath } = await loadConfig(cwd);

  if (!opts.telegramChatId) {
    throw new Error('--telegram-chat-id is required (only Telegram notifier supported in v1)');
  }
  const fireWhen = opts.fireWhen ?? 'when_non_empty';
  if (!['when_non_empty', 'when_empty', 'on_change'].includes(fireWhen)) {
    throw new Error(`--fire-when must be one of: when_non_empty, when_empty, on_change`);
  }

  const watch: WatchConfig = {
    query: opts.query,
    ...(opts.interval ? { interval: opts.interval } : {}),
    fireWhen: fireWhen as WatchConfig['fireWhen'],
    notify: {
      telegram: {
        chatId: parseChatId(opts.telegramChatId),
        ...(opts.telegramBotToken ? { botToken: opts.telegramBotToken } : {}),
        ...(opts.telegramMessage ? { message: opts.telegramMessage } : {}),
      },
    },
  };

  config.watches = config.watches ?? {};
  config.watches[name] = watch;
  await saveConfig(config, configPath);
  log.success(`Watch "${name}" added. Restart \`pq serve\` to activate.`);
}

export async function watchRemoveCommand(name: string): Promise<void> {
  const cwd = process.cwd();
  const { config, path: configPath } = await loadConfig(cwd);
  if (!config.watches?.[name]) {
    log.error(`Watch "${name}" not found`);
    return;
  }
  delete config.watches[name];
  await saveConfig(config, configPath);
  log.success(`Watch "${name}" removed. Restart \`pq serve\` to apply.`);
}

function parseChatId(input: string): string | number {
  // Numeric Telegram chat IDs (e.g. -1001234567890) are large negative
  // integers that fit in safe-integer range. Keep negatives as numbers.
  if (/^-?\d+$/.test(input)) {
    const n = Number(input);
    if (Number.isFinite(n) && Number.isSafeInteger(n)) return n;
  }
  return input;
}
