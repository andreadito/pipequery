/**
 * Telegram bot transport for pipequery.
 *
 * Same shape as the MCP server: takes a Provider (Local or Attached) and
 * exposes the same five verbs as bot commands. No state in the bot itself —
 * everything routes through the provider, so behaviour matches the MCP path
 * exactly (including governance, when that lands).
 */
import { Bot, type Context, GrammyError, HttpError } from 'grammy';
import type { Provider } from '../mcp/provider.js';
import { formatError, formatResult, escapeHtml } from './format.js';

export interface BotOptions {
  /** Whitelist of Telegram user IDs (numeric) or @usernames allowed to query.
   *  Empty array = anyone with the bot token can query (NOT recommended). */
  allowUsers?: string[];
}

export function buildBot(token: string, provider: Provider, opts: BotOptions = {}): Bot {
  const bot = new Bot(token);
  const allowList = normalizeAllowList(opts.allowUsers ?? []);

  // Auth middleware — runs before any handler.
  bot.use(async (ctx, next) => {
    if (allowList.size === 0) {
      // No allowlist configured. Print a warning once per unique user so
      // operators notice they're running an unauthenticated bot.
      const id = ctx.from?.id;
      if (id) trackUnauthSeen(id, ctx.from?.username);
      await next();
      return;
    }
    if (!isAllowed(ctx, allowList)) {
      await ctx.reply('🔒 You are not authorized to use this bot.');
      return;
    }
    await next();
  });

  bot.command('start', async (ctx) => {
    await ctx.reply(
      [
        '👋 <b>pipequery bot</b>',
        '',
        'Run pipequery expressions against your configured data sources from chat.',
        '',
        '<b>Commands</b>',
        '/sources — list configured sources and their health',
        '/describe &lt;name&gt; — sample rows + field names',
        '/endpoints — list pre-configured endpoints',
        '/call &lt;path&gt; — execute a pre-configured endpoint',
        '/query &lt;expression&gt; — run an arbitrary pipequery expression',
        '/help — this message',
      ].join('\n'),
      { parse_mode: 'HTML' },
    );
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      [
        '<b>Examples</b>',
        '<code>/sources</code>',
        '<code>/describe products</code>',
        '<code>/query products | sort(price desc) | first(5)</code>',
        '<code>/query crypto | where(price &gt; 100) | rollup(avg(price) as avg)</code>',
        '<code>/call /api/top-coins</code>',
        '',
        '<b>Tips</b>',
        '• Wrap quoted strings carefully — Telegram\'s autocorrect can mangle them. Send long expressions as a separate message.',
        '• Use <code>/describe &lt;source&gt;</code> to discover field names before constructing a where clause.',
        '• Results &gt; 30 rows are truncated with a footer; tighten your query to see all of them.',
      ].join('\n'),
      { parse_mode: 'HTML' },
    );
  });

  bot.command('sources', async (ctx) => {
    try {
      const sources = await provider.listSources();
      if (sources.length === 0) {
        await ctx.reply('<i>No sources configured.</i>', { parse_mode: 'HTML' });
        return;
      }
      const lines = sources.map((s) => {
        const dot = s.status.healthy ? '🟢' : '🔴';
        const rowCount = s.status.rowCount.toLocaleString();
        const err = s.status.error ? ` <i>(${escapeHtml(s.status.error)})</i>` : '';
        return `${dot} <b>${escapeHtml(s.name)}</b> — ${rowCount} rows${err}`;
      });
      await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
    } catch (err) {
      await ctx.reply(formatError(err), { parse_mode: 'HTML' });
    }
  });

  bot.command('describe', async (ctx) => {
    const name = ctx.match.trim();
    if (!name) {
      await ctx.reply('Usage: <code>/describe &lt;source-name&gt;</code>', { parse_mode: 'HTML' });
      return;
    }
    try {
      const desc = await provider.describeSource(name, 5);
      if (!desc) {
        await ctx.reply(`Source <code>${escapeHtml(name)}</code> not found.`, { parse_mode: 'HTML' });
        return;
      }
      const fields = desc.fields.length ? desc.fields.map((f) => `<code>${escapeHtml(f)}</code>`).join(', ') : '<i>(none inferred)</i>';
      const sample = formatResult(desc.sample);
      await ctx.reply(
        `<b>${escapeHtml(name)}</b> — ${desc.status.rowCount.toLocaleString()} rows\n<b>Fields:</b> ${fields}\n\n<b>Sample:</b>\n${sample}`,
        { parse_mode: 'HTML' },
      );
    } catch (err) {
      await ctx.reply(formatError(err), { parse_mode: 'HTML' });
    }
  });

  bot.command('endpoints', async (ctx) => {
    try {
      const endpoints = await provider.listEndpoints();
      if (endpoints.length === 0) {
        await ctx.reply('<i>No endpoints configured.</i>', { parse_mode: 'HTML' });
        return;
      }
      const lines = endpoints.map(
        (e) => `<b>${escapeHtml(e.path)}</b>\n<code>${escapeHtml(e.config.query)}</code>`,
      );
      await ctx.reply(lines.join('\n\n'), { parse_mode: 'HTML' });
    } catch (err) {
      await ctx.reply(formatError(err), { parse_mode: 'HTML' });
    }
  });

  bot.command('call', async (ctx) => {
    const path = ctx.match.trim();
    if (!path) {
      await ctx.reply('Usage: <code>/call &lt;endpoint-path&gt;</code>', { parse_mode: 'HTML' });
      return;
    }
    try {
      const result = await provider.callEndpoint(path);
      await ctx.reply(formatResult(result), { parse_mode: 'HTML' });
    } catch (err) {
      await ctx.reply(formatError(err), { parse_mode: 'HTML' });
    }
  });

  bot.command('query', async (ctx) => {
    const expr = ctx.match.trim();
    if (!expr) {
      await ctx.reply('Usage: <code>/query &lt;pipequery expression&gt;</code>', { parse_mode: 'HTML' });
      return;
    }
    try {
      const result = await provider.runQuery(expr);
      await ctx.reply(formatResult(result), { parse_mode: 'HTML' });
    } catch (err) {
      await ctx.reply(formatError(err), { parse_mode: 'HTML' });
    }
  });

  bot.catch((err) => {
    if (err.error instanceof GrammyError) {
      process.stderr.write(`[pipequery-telegram] grammy error: ${err.error.description}\n`);
    } else if (err.error instanceof HttpError) {
      process.stderr.write(`[pipequery-telegram] http error: ${err.error.message}\n`);
    } else {
      process.stderr.write(`[pipequery-telegram] unhandled: ${err.error}\n`);
    }
  });

  return bot;
}

// ─── Auth helpers ───────────────────────────────────────────────────────────

function normalizeAllowList(entries: string[]): Set<string> {
  const set = new Set<string>();
  for (const raw of entries) {
    const trimmed = raw.trim().replace(/^@/, '').toLowerCase();
    if (trimmed) set.add(trimmed);
  }
  return set;
}

function isAllowed(ctx: Context, allowList: Set<string>): boolean {
  const from = ctx.from;
  if (!from) return false;
  if (allowList.has(String(from.id))) return true;
  if (from.username && allowList.has(from.username.toLowerCase())) return true;
  return false;
}

const seenUnauth = new Set<number>();
function trackUnauthSeen(id: number, username?: string): void {
  if (seenUnauth.has(id)) return;
  seenUnauth.add(id);
  process.stderr.write(
    `[pipequery-telegram] WARNING: bot has no allowlist; user "${username ?? id}" can query freely. ` +
      `Restart with --allow-user @yourname to lock it down.\n`,
  );
}
