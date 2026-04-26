import { resolve } from 'node:path';
import { loadConfig } from '../config/loader.js';
import { log } from '../utils/logger.js';
import { LocalProvider, AttachedProvider, type Provider } from '../mcp/provider.js';
import { buildBot } from '../telegram/bot.js';
import { createNLTranslator } from '../telegram/nl.js';
import { createEventLogger } from '../telegram/event-log.js';

interface TelegramServeOptions {
  botToken?: string;
  attach?: string;
  allowUser?: string[];
  anthropicKey?: string;
  logFile?: string;
}

export async function telegramServeCommand(opts: TelegramServeOptions): Promise<void> {
  const token = opts.botToken ?? process.env.PIPEQUERY_TG_BOT_TOKEN;
  if (!token) {
    log.error(
      'Bot token required. Pass --bot-token <token> or set PIPEQUERY_TG_BOT_TOKEN.',
    );
    process.exit(1);
  }

  const anthropicKey = opts.anthropicKey ?? process.env.ANTHROPIC_API_KEY;
  const provider = await buildProvider(opts.attach);
  const nl = anthropicKey
    ? createNLTranslator(provider, { apiKey: anthropicKey })
    : undefined;

  const logFilePath = opts.logFile ? resolve(process.cwd(), opts.logFile) : undefined;
  const logger = createEventLogger({ filePath: logFilePath });

  const bot = buildBot(token, provider, {
    allowUsers: opts.allowUser ?? [],
    nl,
    logger,
  });

  const me = await bot.api.getMe();
  log.success(`Telegram bot listening as @${me.username} (id ${me.id})`);
  if (nl) {
    log.info('Natural-language translation enabled (claude-haiku-4-5).');
  } else {
    log.dim('Natural-language translation disabled. Pass --anthropic-key or set ANTHROPIC_API_KEY to enable.');
  }
  if (logFilePath) {
    log.info(`Event log → ${logFilePath} (JSONL)`);
  }
  if (!opts.allowUser || opts.allowUser.length === 0) {
    log.warn('No --allow-user set: anyone with the bot username can query. Add allowlist for production.');
  }
  log.info('Press Ctrl+C to stop.');

  const shutdown = async () => {
    log.info('Stopping bot...');
    await bot.stop();
    await provider.dispose();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  await bot.start();
}

async function buildProvider(attachUrl?: string): Promise<Provider> {
  if (attachUrl) {
    return new AttachedProvider(attachUrl);
  }
  const cwd = process.cwd();
  const { config } = await loadConfig(cwd);
  return new LocalProvider(config, cwd);
}
