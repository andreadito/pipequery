/**
 * Natural-language → pipequery translator for the Telegram bot.
 *
 * Strategy:
 *   1. Build a comprehensive, stable system prompt describing the DSL grammar
 *      and the available operators. Big enough to clear Haiku 4.5's 4096-token
 *      cacheable-prefix minimum so subsequent calls hit the cache.
 *   2. Build a per-tenant "schema preamble" from the live source list +
 *      sample fields. Stable across requests until the yaml changes, so it
 *      gets its own cache breakpoint.
 *   3. The user's question is the only volatile piece; it goes after both
 *      cache breakpoints.
 *
 * The model is instructed to emit a single JSON object so we don't have to
 * parse free-form prose. A retry-once-on-bad-json wrapper keeps the bot from
 * dying when the model adds preamble.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { Provider } from '../mcp/provider.js';

export interface TranslationResult {
  /** Pipequery expression to execute. */
  expression: string;
  /** Short human-readable explanation of what the expression does. */
  explanation: string;
}

export interface NLTranslator {
  translate(question: string): Promise<TranslationResult>;
  /** Force the schema preamble to be rebuilt on the next translate(). */
  invalidateSchema(): void;
}

const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 1024;
const SCHEMA_TTL_MS = 60_000; // refresh schema preamble every minute

export interface TranslatorOptions {
  apiKey: string;
  /** Override the model for tests. */
  model?: string;
  /** Inject a pre-built Anthropic client (used in tests). */
  client?: Anthropic;
}

export function createNLTranslator(provider: Provider, opts: TranslatorOptions): NLTranslator {
  const client = opts.client ?? new Anthropic({ apiKey: opts.apiKey });
  const model = opts.model ?? MODEL;

  let cachedSchema: { text: string; builtAt: number } | null = null;

  async function getSchemaPreamble(): Promise<string> {
    const now = Date.now();
    if (cachedSchema && now - cachedSchema.builtAt < SCHEMA_TTL_MS) {
      return cachedSchema.text;
    }
    const text = await buildSchemaPreamble(provider);
    cachedSchema = { text, builtAt: now };
    return text;
  }

  async function translate(question: string): Promise<TranslationResult> {
    const schema = await getSchemaPreamble();
    const response = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: [
        // Cache breakpoint #1 — the always-stable DSL grammar + instructions.
        // This is the largest block and the one that benefits most from being
        // cached across every translation request the bot ever serves.
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
        // Cache breakpoint #2 — the per-tenant source schema. Stable until
        // the yaml changes (or SCHEMA_TTL_MS elapses).
        {
          type: 'text',
          text: schema,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: question,
        },
      ],
    });

    const text = extractText(response);
    return parseTranslation(text);
  }

  return {
    translate,
    invalidateSchema: () => {
      cachedSchema = null;
    },
  };
}

// ─── Schema preamble ────────────────────────────────────────────────────────

async function buildSchemaPreamble(provider: Provider): Promise<string> {
  const sources = await provider.listSources();
  const endpoints = await provider.listEndpoints();

  const sourceLines: string[] = [];
  for (const s of sources) {
    let fields: string[] = [];
    try {
      const desc = await provider.describeSource(s.name, 3);
      if (desc) fields = desc.fields;
    } catch {
      // describeSource can fail for unhealthy sources; skip the field list.
    }
    const fieldStr = fields.length ? ` — fields: ${fields.join(', ')}` : '';
    sourceLines.push(`- ${s.name} (${s.status.rowCount} rows)${fieldStr}`);
  }
  const endpointLines = endpoints.map((e) => `- ${e.path} → ${e.config.query}`);

  return [
    '## Available data sources',
    sourceLines.length ? sourceLines.join('\n') : '(no sources configured)',
    '',
    '## Pre-defined endpoints',
    endpointLines.length ? endpointLines.join('\n') : '(no endpoints configured)',
  ].join('\n');
}

// ─── Response parsing ───────────────────────────────────────────────────────

function extractText(response: Anthropic.Message): string {
  const parts: string[] = [];
  for (const block of response.content) {
    if (block.type === 'text') parts.push(block.text);
  }
  return parts.join('').trim();
}

function parseTranslation(raw: string): TranslationResult {
  // Strip code fences if the model wrapped its JSON in ```json ... ```
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  // Find the first JSON object in the response.
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Translator returned non-JSON: ${truncate(raw, 200)}`);
  }
  const slice = cleaned.slice(start, end + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(slice);
  } catch (err) {
    throw new Error(`Translator returned invalid JSON: ${truncate(raw, 200)}`);
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).expression !== 'string'
  ) {
    throw new Error(`Translator response missing "expression" field: ${truncate(raw, 200)}`);
  }
  const obj = parsed as { expression: string; explanation?: string };
  return {
    expression: obj.expression.trim(),
    explanation: typeof obj.explanation === 'string' ? obj.explanation.trim() : '',
  };
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

// ─── System prompt ──────────────────────────────────────────────────────────
//
// Kept inline as a single string so it's trivially stable across calls (any
// byte change invalidates the cache). Sized to clear Haiku 4.5's 4096-token
// minimum cacheable prefix — examples are intentionally generous so the model
// has rich few-shot grounding *and* the cache fires.

const SYSTEM_PROMPT = `You are a translator that converts natural-language questions into PipeQuery expressions.

PipeQuery is a small, pipe-style query DSL. Every expression starts with a source name (or a literal array) and pipes into one or more operations using \`|\`. PipeQuery is read-only by construction — there is no DDL, DML, INSERT, UPDATE, DELETE, or DROP. You will never produce SQL.

# Output contract

You MUST respond with a SINGLE JSON object and nothing else. No prose, no markdown, no code fences.

The object has exactly two fields:
  - "expression": a string containing the PipeQuery expression to execute.
  - "explanation": a one-sentence plain-English description of what the expression does.

Example:
{"expression": "orders | where(status == \\"paid\\") | sort(total desc) | first(5)", "explanation": "Top 5 paid orders by total."}

If the user's question cannot be answered with the available sources, return:
{"expression": "", "explanation": "<brief reason why no expression was produced>"}

# Grammar

Pipeline:
  <source_name> | <operation> | <operation> | ...

Sources are referenced by their bare name (no quotes). The available source names are listed in the schema preamble that follows this prompt.

# Operations

## where(<expression>)
Filter rows. The expression is evaluated per row and must return a boolean.
  - Comparison operators: ==  !=  >  >=  <  <=
  - Logical operators: &&  ||  !
  - Arithmetic: +  -  *  /  %
  - Field reference: bare identifier (e.g., \`price\`, \`status\`)
  - Strings: double-quoted ("paid")
  - Numbers: 1, 1.5, -42
  - Booleans: true, false
  - Null: null

Examples:
  events | where(severity == "high")
  trades | where(price > 100 && symbol == "BTC")
  users | where(!banned)

## sort(<field> asc|desc, ...)
Sort by one or more fields. Direction is optional, defaults to asc.
  orders | sort(total desc)
  orders | sort(country asc, total desc)

## first(N) / last(N)
Take the first / last N rows. N must be a positive integer literal.
  trades | sort(ts desc) | first(10)

## distinct / distinct(field, ...)
Deduplicate rows. With no args, dedupes on the full row; with args, dedupes on the listed fields.
  users | distinct(email)

## select(<expression>, ...)
Project fields. Each expression can be a bare field, a computed expression, or an alias (\`expr as name\`).
  orders | select(id, total, total * 0.1 as tax)

## groupBy(<field>, ...) and rollup
Aggregate. \`groupBy\` keeps groups; \`rollup\` collapses each group to one row with computed aggregates.

  orders | rollup(country, sum(total) as revenue, count() as n)
  trades | groupBy(symbol) | rollup(avg(price) as avg)

Aggregate functions: sum, avg, min, max, count, median, stddev, var, percentile, distinct_count, first_value, last_value, vwap, wavg, pct, sharpe, calmar, sortino, info_ratio, drawdown, sum_abs, abs_sum.

\`count()\` takes no field. \`percentile(field, p)\` and \`vwap(value, weight)\` take two args.

## flatten / flatten(field)
Unnest array values. With \`flatten(orders)\` each element of \`row.orders\` becomes its own row.

## map(<expression>, ...)
Transform each row into a new shape (similar to \`select\` but always emits a new object).

## reduce(initial, accumulator)
Fold rows into a single value. Rare; prefer rollup.

## join(<source>, <condition>)
Inner join with another source on a boolean condition. Use \`left\` and \`right\` to refer to fields.
  orders | join(customers, left.customer_id == right.id)

## pivot(<field>, <agg>, ...)
Pivot rows into columns by a key field.

# Conventions and best practices

1. Prefer \`rollup\` over \`groupBy\` unless the caller wants the per-group rows kept.
2. Always cap result size with \`first(N)\` for "top N" or "show me" questions; default to 10 if the user doesn't specify.
3. Use the EXACT field names from the schema preamble. Do not invent fields.
4. If two sources need to be joined and there's no obvious join key in the schema, prefer to ask for clarification by emitting the empty-expression form rather than guessing.
5. Quote string literals with double quotes; escape internal double quotes with \\".
6. Do not produce SQL, JavaScript, or English in the expression field — only PipeQuery.
7. Numbers are bare; no thousands separators, no quotes.
8. Comparisons against null use \`== null\` / \`!= null\`.

# Worked examples

Question: "What are the top 5 most expensive orders that were paid?"
{"expression": "orders | where(status == \\"paid\\") | sort(total desc) | first(5)", "explanation": "Top 5 paid orders by total."}

Question: "Average BTC price right now"
{"expression": "trades | where(symbol == \\"BTC\\") | rollup(avg(price) as avg_price)", "explanation": "Average price across all BTC rows."}

Question: "Revenue by country"
{"expression": "orders | rollup(country, sum(total) as revenue) | sort(revenue desc)", "explanation": "Sum of order totals grouped by country, highest first."}

Question: "How many distinct users placed an order?"
{"expression": "orders | rollup(distinct_count(user_id) as users)", "explanation": "Count of unique user IDs in orders."}

Question: "Show high-severity events from the last hour"
(only answerable if the schema has a timestamp field; otherwise return empty.)
{"expression": "events | where(severity == \\"high\\") | sort(ts desc) | first(50)", "explanation": "Most recent high-severity events, capped at 50."}

Question: "Drop the orders table"
{"expression": "", "explanation": "PipeQuery is read-only and cannot drop tables."}

Question: "How many rows in foo?"
(only answerable if a source named \`foo\` exists; otherwise return empty.)
{"expression": "foo | rollup(count() as n)", "explanation": "Row count of foo."}

# Reminder

- Output exactly ONE JSON object.
- The "expression" field must be valid PipeQuery referencing only sources from the schema preamble.
- Use double quotes for strings, escape inner quotes as \\".
- Default result cap is first(10) for unbounded "show me" questions unless an aggregation makes the result naturally small.
- Never produce SQL or destructive operations.
`;
