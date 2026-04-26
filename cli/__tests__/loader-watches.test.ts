/**
 * Regression test for the v0.6.0 watches-loader bug:
 *
 *   loadConfig() built the typed PipeQueryConfig without copying raw.watches,
 *   so config.watches was always undefined. That silently broke three things:
 *     1. pq watch list always reported "no watches"
 *     2. pq watch add overwrote previous watches (load → empty → save → only the new one)
 *     3. WatchManager never started in pq serve (the `if (config.watches && ...)` was always false)
 *
 * The fix is one line in loader.ts. These tests cover the round-trip and the
 * additive save+reload behaviour so the regression can't sneak back.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeYaml } from '../src/utils/yaml.js';
import { loadConfig, saveConfig } from '../src/config/loader.js';
import type { PipeQueryConfig, WatchConfig } from '../src/config/schema.js';

describe('config loader — watches', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'pq-loader-test-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('preserves watches block from yaml on load', async () => {
    const yamlPath = join(dir, 'pipequery.yaml');
    const watch: WatchConfig = {
      query: 'crypto | first(1)',
      interval: '30s',
      fireWhen: 'on_change',
      notify: { telegram: { chatId: 123456789 } },
    };
    await writeYaml(yamlPath, {
      sources: {},
      endpoints: {},
      watches: { foo: watch },
    });

    const { config } = await loadConfig(dir);

    expect(config.watches).toBeDefined();
    expect(Object.keys(config.watches!)).toEqual(['foo']);
    expect(config.watches!.foo.query).toBe('crypto | first(1)');
    expect(config.watches!.foo.fireWhen).toBe('on_change');
    expect(config.watches!.foo.notify.telegram?.chatId).toBe(123456789);
  });

  it('save+reload keeps existing watches when adding a new one (no clobber)', async () => {
    // Mirrors the user-reported reproduction: two consecutive `pq watch add`
    // invocations should both end up in the yaml.
    const yamlPath = join(dir, 'pipequery.yaml');
    await writeYaml(yamlPath, {
      sources: {},
      endpoints: {},
    });

    // First add — load (empty), append `foo`, save.
    const first = await loadConfig(dir);
    first.config.watches = first.config.watches ?? {};
    first.config.watches.foo = {
      query: 'a | first(1)',
      notify: { telegram: { chatId: 1 } },
    };
    await saveConfig(first.config, first.path);

    // Second add — load (must include foo!), append `bar`, save.
    const second = await loadConfig(dir);
    second.config.watches = second.config.watches ?? {};
    second.config.watches.bar = {
      query: 'b | first(1)',
      notify: { telegram: { chatId: 2 } },
    };
    await saveConfig(second.config, second.path);

    // Reload and verify both watches survived.
    const final = await loadConfig(dir);
    expect(Object.keys(final.config.watches ?? {}).sort()).toEqual(['bar', 'foo']);
  });

  it('returns an empty watches object when the yaml has no watches block', async () => {
    // Defaulting to {} (rather than undefined) keeps the call sites in
    // watch.ts simple — they can write `config.watches[name] = ...` without
    // a nullish-fallback dance.
    const yamlPath = join(dir, 'pipequery.yaml');
    await writeYaml(yamlPath, {
      sources: {},
      endpoints: {},
    });

    const { config } = await loadConfig(dir);
    expect(config.watches).toEqual({});
  });

  it('round-trips a watches block through save → reload unchanged', async () => {
    const yamlPath = join(dir, 'pipequery.yaml');
    const original: PipeQueryConfig = {
      server: { port: 3000, host: '127.0.0.1' },
      sources: {},
      endpoints: {},
      dashboards: {},
      watches: {
        big: {
          query: 'events | where(severity == "high")',
          interval: '60s',
          fireWhen: 'when_non_empty',
          notify: {
            telegram: {
              chatId: -1001234567890,
              message: '🚨 high severity: {{ .msg }}',
            },
          },
        },
      },
    };
    await saveConfig(original, yamlPath);

    const { config } = await loadConfig(dir);
    expect(config.watches).toEqual(original.watches);
  });
});
