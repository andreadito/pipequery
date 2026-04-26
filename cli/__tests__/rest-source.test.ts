/**
 * REST source — env-var interpolation in url / headers / params,
 * plus auth: bearer helper. Issue #37 (slice).
 *
 * Spins up a real http server in-process so we exercise the actual
 * outbound request shape rather than mocking globalThis.fetch.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { RestSourceAdapter } from '../src/server/sources/rest.js';

interface Captured {
  url: string;
  headers: Record<string, string | string[] | undefined>;
}

interface Harness {
  url: string;
  captured: Captured[];
  /** Body the server returns for the next request. Default: empty array. */
  setResponse(body: unknown, status?: number): void;
  close: () => Promise<void>;
}

async function makeServer(): Promise<Harness> {
  const captured: Captured[] = [];
  let nextBody: unknown = [];
  let nextStatus = 200;

  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    captured.push({ url: req.url ?? '', headers: req.headers });
    res.statusCode = nextStatus;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(nextBody));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`,
    captured,
    setResponse(body, status = 200) {
      nextBody = body;
      nextStatus = status;
    },
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

describe('REST source — env interpolation + auth: bearer (#37 slice)', () => {
  let server: Harness;
  let envBackup: Record<string, string | undefined>;

  beforeEach(async () => {
    server = await makeServer();
    envBackup = {
      MY_TOKEN: process.env.MY_TOKEN,
      MY_KEY: process.env.MY_KEY,
      USER_PATH: process.env.USER_PATH,
      MY_REGION: process.env.MY_REGION,
    };
  });
  afterEach(async () => {
    await server.close();
    // Restore env
    for (const [k, v] of Object.entries(envBackup)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('expands ${ENV_VAR} in URL', async () => {
    process.env.USER_PATH = 'users';
    server.setResponse([]);
    const adapter = new RestSourceAdapter({
      type: 'rest',
      url: `${server.url}/api/\${USER_PATH}`,
    });
    await adapter.start();
    adapter.stop();
    expect(server.captured[0].url).toBe('/api/users');
  });

  it('expands ${ENV_VAR} in headers', async () => {
    process.env.MY_KEY = 'sk-secret-abc';
    server.setResponse([]);
    const adapter = new RestSourceAdapter({
      type: 'rest',
      url: server.url,
      headers: { 'X-API-Key': '${MY_KEY}', 'X-Static': 'literal' },
    });
    await adapter.start();
    adapter.stop();
    expect(server.captured[0].headers['x-api-key']).toBe('sk-secret-abc');
    expect(server.captured[0].headers['x-static']).toBe('literal');
  });

  it('expands ${ENV_VAR} in query params and merges with existing query string', async () => {
    process.env.MY_REGION = 'eu-west-1';
    server.setResponse([]);
    const adapter = new RestSourceAdapter({
      type: 'rest',
      url: `${server.url}/api?fixed=1`,
      params: { region: '${MY_REGION}', kind: 'live' },
    });
    await adapter.start();
    adapter.stop();
    // Query string contains both the inline ?fixed=1 and the appended params,
    // joined with `&`. URLSearchParams encodes dashes as-is.
    const seen = server.captured[0].url;
    expect(seen).toContain('fixed=1');
    expect(seen).toContain('region=eu-west-1');
    expect(seen).toContain('kind=live');
    expect(seen.startsWith('/api?')).toBe(true);
  });

  it('emits empty string and a warning for missing env vars (does not embed literal "${FOO}")', async () => {
    // No MY_TOKEN set
    delete process.env.MY_TOKEN;
    server.setResponse([]);
    const stderrCaptured: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderrCaptured.push(typeof chunk === 'string' ? chunk : chunk.toString());
      return true;
    }) as typeof process.stderr.write;

    const adapter = new RestSourceAdapter({
      type: 'rest',
      url: server.url,
      headers: { Authorization: 'Bearer ${MY_TOKEN}' },
    });
    try {
      await adapter.start();
      adapter.stop();
    } finally {
      process.stderr.write = origWrite;
    }

    // The literal "${...}" must NOT appear in the outbound header. Node
    // trims trailing whitespace from header values on the wire, so the
    // received value is "Bearer" not "Bearer ".
    const auth = server.captured[0].headers['authorization'] as string;
    expect(auth).not.toContain('${');
    expect(auth.startsWith('Bearer')).toBe(true);
    expect(stderrCaptured.some((s) => s.includes('MY_TOKEN'))).toBe(true);
  });

  it('auth: bearer adds Authorization: Bearer <token> with env interpolation', async () => {
    process.env.MY_TOKEN = 'jwt.abc.123';
    server.setResponse([]);
    const adapter = new RestSourceAdapter({
      type: 'rest',
      url: server.url,
      auth: { kind: 'bearer', token: '${MY_TOKEN}' },
    });
    await adapter.start();
    adapter.stop();
    expect(server.captured[0].headers['authorization']).toBe('Bearer jwt.abc.123');
  });

  it('auth: bearer wins over a hand-rolled headers.Authorization on collision', async () => {
    // If a user sets both, they almost certainly meant the auth helper —
    // bearer is the one that actually plumbs the token through env vars.
    process.env.MY_TOKEN = 'jwt.xyz';
    server.setResponse([]);
    const adapter = new RestSourceAdapter({
      type: 'rest',
      url: server.url,
      headers: { Authorization: 'Bearer should-be-overridden' },
      auth: { kind: 'bearer', token: '${MY_TOKEN}' },
    });
    await adapter.start();
    adapter.stop();
    expect(server.captured[0].headers['authorization']).toBe('Bearer jwt.xyz');
  });

  it('back-compat: no env vars + no auth → behaves exactly like before', async () => {
    server.setResponse([{ id: 1 }, { id: 2 }]);
    const adapter = new RestSourceAdapter({
      type: 'rest',
      url: server.url,
      headers: { 'X-Custom': 'value' },
    });
    await adapter.start();
    expect(adapter.getData()).toEqual([{ id: 1 }, { id: 2 }]);
    expect(server.captured[0].headers['x-custom']).toBe('value');
    expect(server.captured[0].headers['authorization']).toBeUndefined();
    adapter.stop();
  });
});
