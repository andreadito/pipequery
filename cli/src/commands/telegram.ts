import { loadConfig } from '../config/loader.js';
import { log } from '../utils/logger.js';
import { LocalProvider, AttachedProvider, type Provider } from '../mcp/provider.js';
import { buildBot } from '../telegram/bot.js';

interface TelegramServeOptions {
  botToken?: string;
  attach?: string;
  allowUser?: string[];
}

export async function telegramServeCommand(opts: TelegramServeOptions): Promise<void> {
  const token = opts.botToken ?? process.env.PIPEQUERY_TG_BOT_TOKEN;
  if (!token) {
    log.error(
      'Bot token required. Pass --bot-token <token> or set PIPEQUERY_TG_BOT_TOKEN.',
    );
    process.exit(1);
  }

  const provider = await buildProvider(opts.attach);
  const bot = buildBot(token, provider, { allowUsers: opts.allowUser ?? [] });

  const me = await bot.api.getMe();
  log.success(`Telegram bot listening as @${me.username} (id ${me.id})`);
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
