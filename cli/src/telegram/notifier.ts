/**
 * Telegram notifier for the watch system.
 *
 * Distinct from `bot.ts` — that's the *interactive* bot (users send commands).
 * This is a *push* notifier: a watch's query produces a result, we render it,
 * we send it to a chat. Both share grammy's `Bot` class but use different
 * surfaces of it (commands vs `bot.api.sendMessage`).
 */
import { Bot } from 'grammy';
import type { TelegramNotifyConfig } from '../config/schema.js';
import { formatResult, escapeHtml } from './format.js';

export interface NotifyPayload {
  /** Watch name (config key). */
  watchName: string;
  /** Result the watch evaluated to when it fired. */
  result: unknown;
  /** Reason the watch fired ("transitioned to non-empty", etc.). */
  reason: string;
}

export interface Notifier {
  notify(payload: NotifyPayload): Promise<void>;
}

// Cache bots by token — avoids constructing a new Bot per notification when
// many watches share the same bot token.
const botCache = new Map<string, Bot>();

function expandEnv(input: string): string {
  return input.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, name: string) => process.env[name] ?? '');
}

function getBot(token: string): Bot {
  let bot = botCache.get(token);
  if (!bot) {
    bot = new Bot(token);
    botCache.set(token, bot);
  }
  return bot;
}

export class TelegramNotifier implements Notifier {
  private readonly token: string;
  private readonly chatId: string | number;
  private readonly template?: string;

  constructor(cfg: TelegramNotifyConfig) {
    const tokenSource = cfg.botToken ?? process.env.PIPEQUERY_TG_BOT_TOKEN;
    if (!tokenSource) {
      throw new Error(
        'TelegramNotifier: no bot token. Set notify.telegram.botToken or PIPEQUERY_TG_BOT_TOKEN.',
      );
    }
    this.token = expandEnv(tokenSource);
    this.chatId = cfg.chatId;
    this.template = cfg.message;
  }

  async notify(payload: NotifyPayload): Promise<void> {
    const bot = getBot(this.token);
    const text = this.renderMessage(payload);
    // Telegram's HTML mode tolerates the same escapes used by formatResult.
    await bot.api.sendMessage(this.chatId, text, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  }

  private renderMessage(payload: NotifyPayload): string {
    if (this.template) {
      return renderTemplate(this.template, payload);
    }
    // Default: header + reason + rendered result table.
    const header = `🔔 <b>Watch fired:</b> <code>${escapeHtml(payload.watchName)}</code>`;
    const reason = `<i>${escapeHtml(payload.reason)}</i>`;
    const body = formatResult(payload.result);
    return [header, reason, body].join('\n');
  }
}

// ─── Template rendering ─────────────────────────────────────────────────────

/**
 * Minimal `{{ .field }}` substitution against the first row of the result
 * (or the result itself if not an array). `{{ .count }}` is special and
 * resolves to the total row count.
 *
 * Deliberately not a real templating engine — this is alert text, not HTML
 * generation. Anything fancier and users should compose the message in their
 * pipequery expression and emit it as a row field.
 */
function renderTemplate(tmpl: string, payload: NotifyPayload): string {
  const result = payload.result;
  const rows = Array.isArray(result) ? result : [result];
  const firstRow = rows[0];
  const count = rows.length;

  return tmpl.replace(/\{\{\s*\.([a-zA-Z0-9_]+)\s*\}\}/g, (match, name: string) => {
    if (name === 'count') return String(count);
    if (name === 'watchName') return payload.watchName;
    if (name === 'reason') return payload.reason;
    if (firstRow && typeof firstRow === 'object' && firstRow !== null) {
      const value = (firstRow as Record<string, unknown>)[name];
      if (value === undefined) return match;
      return String(value);
    }
    return match;
  });
}
