/**
 * NL translator tests.
 *
 * The Anthropic SDK is injected (not mocked at the network layer), so these
 * tests exercise the real shape of the request we send (system blocks with
 * cache_control breakpoints, single user message) and the parsing of the
 * response. No live API calls.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { createNLTranslator } from '../src/telegram/nl.js';
import type { Provider, ProviderSourceInfo, ProviderSourceDescription } from '../src/mcp/provider.js';

interface CapturedCall {
  model: string;
  system: unknown;
  messages: unknown;
  max_tokens: number;
}

function fakeProvider(): Provider {
  return {
    async listSources(): Promise<ProviderSourceInfo[]> {
      return [
        { name: 'orders', status: { healthy: true, rowCount: 1234, lastFetch: null } },
        { name: 'users', status: { healthy: true, rowCount: 50, lastFetch: null } },
      ];
    },
    async describeSource(name: string): Promise<ProviderSourceDescription | undefined> {
      if (name === 'orders') {
        return {
          name,
          status: { healthy: true, rowCount: 1234, lastFetch: null },
          sample: [{ id: 1, total: 100, status: 'paid' }],
          fields: ['id', 'total', 'status', 'country'],
        };
      }
      if (name === 'users') {
        return {
          name,
          status: { healthy: true, rowCount: 50, lastFetch: null },
          sample: [{ id: 1, email: 'a@b.com' }],
          fields: ['id', 'email', 'banned'],
        };
      }
      return undefined;
    },
    async listEndpoints() {
      return [];
    },
    async callEndpoint() {
      return [];
    },
    async runQuery() {
      return [];
    },
    async dispose() {},
  };
}

function fakeClient(replyText: string, captured: CapturedCall[]): Anthropic {
  return {
    messages: {
      async create(params: {
        model: string;
        system: unknown;
        messages: unknown;
        max_tokens: number;
      }) {
        captured.push({
          model: params.model,
          system: params.system,
          messages: params.messages,
          max_tokens: params.max_tokens,
        });
        return {
          id: 'msg_test',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: replyText }],
          model: params.model,
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        };
      },
    },
  } as unknown as Anthropic;
}

describe('nl translator', () => {
  let captured: CapturedCall[];
  beforeEach(() => {
    captured = [];
  });

  it('parses a clean JSON reply', async () => {
    const t = createNLTranslator(fakeProvider(), {
      apiKey: 'sk-test',
      client: fakeClient(
        '{"expression":"orders | sort(total desc) | first(5)","explanation":"Top 5 orders."}',
        captured,
      ),
    });
    const r = await t.translate('top 5 orders by total');
    expect(r.expression).toBe('orders | sort(total desc) | first(5)');
    expect(r.explanation).toBe('Top 5 orders.');
  });

  it('strips ```json fences before parsing', async () => {
    const t = createNLTranslator(fakeProvider(), {
      apiKey: 'sk-test',
      client: fakeClient(
        '```json\n{"expression":"orders | rollup(count() as n)","explanation":"Row count."}\n```',
        captured,
      ),
    });
    const r = await t.translate('how many orders?');
    expect(r.expression).toBe('orders | rollup(count() as n)');
  });

  it('extracts the first JSON object even with leading prose', async () => {
    const t = createNLTranslator(fakeProvider(), {
      apiKey: 'sk-test',
      client: fakeClient(
        'Here you go!\n{"expression":"users | first(10)","explanation":"First 10 users."}',
        captured,
      ),
    });
    const r = await t.translate('show me users');
    expect(r.expression).toBe('users | first(10)');
  });

  it('rejects responses without an expression field', async () => {
    const t = createNLTranslator(fakeProvider(), {
      apiKey: 'sk-test',
      client: fakeClient('{"foo":"bar"}', captured),
    });
    await expect(t.translate('whatever')).rejects.toThrow(/expression/);
  });

  it('rejects non-JSON replies', async () => {
    const t = createNLTranslator(fakeProvider(), {
      apiKey: 'sk-test',
      client: fakeClient('I cannot help with that.', captured),
    });
    await expect(t.translate('whatever')).rejects.toThrow(/non-JSON/);
  });

  it('sends two cache breakpoints — system prompt and schema preamble', async () => {
    const t = createNLTranslator(fakeProvider(), {
      apiKey: 'sk-test',
      client: fakeClient(
        '{"expression":"orders | first(5)","explanation":"x"}',
        captured,
      ),
    });
    await t.translate('q');
    expect(captured).toHaveLength(1);
    const system = captured[0].system as Array<{ type: string; text: string; cache_control?: unknown }>;
    expect(system).toHaveLength(2);
    // Both system blocks must carry an ephemeral cache_control breakpoint —
    // that's the whole point of putting the prompt and schema separately.
    expect(system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(system[1].cache_control).toEqual({ type: 'ephemeral' });
    // First block is the static prompt, second is the per-tenant schema.
    expect(system[0].text).toContain('PipeQuery');
    expect(system[1].text).toContain('orders');
    expect(system[1].text).toContain('users');
    expect(system[1].text).toContain('fields:');
  });

  it('uses claude-haiku-4-5 by default', async () => {
    const t = createNLTranslator(fakeProvider(), {
      apiKey: 'sk-test',
      client: fakeClient(
        '{"expression":"orders | first(1)","explanation":"x"}',
        captured,
      ),
    });
    await t.translate('q');
    expect(captured[0].model).toBe('claude-haiku-4-5');
  });

  it('caches the schema preamble across calls within TTL', async () => {
    let describeCalls = 0;
    const provider: Provider = {
      ...fakeProvider(),
      async describeSource(name: string) {
        describeCalls++;
        return {
          name,
          status: { healthy: true, rowCount: 1, lastFetch: null },
          sample: [],
          fields: ['x'],
        };
      },
    };
    const t = createNLTranslator(provider, {
      apiKey: 'sk-test',
      client: fakeClient(
        '{"expression":"orders | first(1)","explanation":"x"}',
        captured,
      ),
    });
    await t.translate('q1');
    const first = describeCalls;
    await t.translate('q2');
    expect(describeCalls).toBe(first); // cached, no second describe round-trip

    t.invalidateSchema();
    await t.translate('q3');
    expect(describeCalls).toBeGreaterThan(first);
  });

  it('allows the model to signal "not answerable" via empty expression', async () => {
    const t = createNLTranslator(fakeProvider(), {
      apiKey: 'sk-test',
      client: fakeClient(
        '{"expression":"","explanation":"PipeQuery is read-only and cannot drop tables."}',
        captured,
      ),
    });
    const r = await t.translate('drop the orders table');
    expect(r.expression).toBe('');
    expect(r.explanation).toMatch(/read-only/);
  });
});
