/**
 * WebSocket source tests — covers the new subscribe-on-open + heartbeat
 * behaviour from issue #35. Spins up a real `ws` server in-process so
 * we exercise the actual JSON round-trip rather than mocking the socket.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocketServer, type WebSocket as WSocket } from 'ws';
import type { AddressInfo } from 'node:net';
import { WebSocketSourceAdapter } from '../src/server/sources/websocket.js';

interface Harness {
  url: string;
  /** Messages received by the server, parsed as JSON when possible. */
  received: unknown[];
  /** First connected client — used to push messages back at the adapter. */
  clientPromise: Promise<WSocket>;
  /** Force-close the active client connection (simulates a server restart). */
  forceCloseClient: () => void;
  close: () => Promise<void>;
}

async function makeServer(): Promise<Harness> {
  const wss = new WebSocketServer({ port: 0 });
  const received: unknown[] = [];
  let resolveClient!: (ws: WSocket) => void;
  const clientPromise = new Promise<WSocket>((res) => {
    resolveClient = res;
  });
  let activeClient: WSocket | null = null;

  wss.on('connection', (ws) => {
    activeClient = ws;
    ws.on('message', (raw) => {
      try {
        received.push(JSON.parse(raw.toString()));
      } catch {
        received.push(raw.toString());
      }
    });
    resolveClient(ws);
  });

  await new Promise<void>((res) => wss.once('listening', res));
  const port = (wss.address() as AddressInfo).port;
  return {
    url: `ws://127.0.0.1:${port}`,
    received,
    clientPromise,
    forceCloseClient: () => activeClient?.close(),
    close: () =>
      new Promise<void>((res) => {
        for (const c of wss.clients) c.terminate();
        wss.close(() => res());
      }),
  };
}

describe('WebSocketSourceAdapter — subscribe + heartbeat', () => {
  let server: Harness;
  beforeEach(async () => {
    server = await makeServer();
  });
  afterEach(async () => {
    await server.close();
  });

  it('sends a single subscribe payload immediately after open', async () => {
    const adapter = new WebSocketSourceAdapter({
      type: 'websocket',
      url: server.url,
      subscribe: { method: 'SUBSCRIBE', params: ['btcusdt@ticker'], id: 1 },
    });
    await adapter.start();
    await server.clientPromise;
    // Give the server a tick to flush the message into `received`.
    await new Promise((r) => setTimeout(r, 50));
    expect(server.received).toEqual([
      { method: 'SUBSCRIBE', params: ['btcusdt@ticker'], id: 1 },
    ]);
    adapter.stop();
  });

  it('sends an array of subscribe payloads in order', async () => {
    const adapter = new WebSocketSourceAdapter({
      type: 'websocket',
      url: server.url,
      subscribe: [
        { method: 'SUBSCRIBE', params: ['btc@ticker'], id: 1 },
        { method: 'SUBSCRIBE', params: ['eth@ticker'], id: 2 },
        { method: 'SUBSCRIBE', params: ['sol@ticker'], id: 3 },
      ],
    });
    await adapter.start();
    await server.clientPromise;
    await new Promise((r) => setTimeout(r, 50));
    expect(server.received).toHaveLength(3);
    expect((server.received[0] as { id: number }).id).toBe(1);
    expect((server.received[1] as { id: number }).id).toBe(2);
    expect((server.received[2] as { id: number }).id).toBe(3);
    adapter.stop();
  });

  it('sends nothing when subscribe is omitted (back-compat)', async () => {
    const adapter = new WebSocketSourceAdapter({
      type: 'websocket',
      url: server.url,
    });
    await adapter.start();
    await server.clientPromise;
    await new Promise((r) => setTimeout(r, 50));
    expect(server.received).toEqual([]);
    adapter.stop();
  });

  it('emits heartbeat payloads on the configured second-resolution interval', async () => {
    const adapter = new WebSocketSourceAdapter({
      type: 'websocket',
      url: server.url,
      heartbeat: { payload: { method: 'PING' }, interval: '1s' },
    });
    await adapter.start();
    await server.clientPromise;
    // Wait long enough for at least 2 ticks plus the open-time slack.
    await new Promise((r) => setTimeout(r, 2300));
    const pings = server.received.filter(
      (m) => typeof m === 'object' && m !== null && (m as { method?: string }).method === 'PING',
    );
    expect(pings.length).toBeGreaterThanOrEqual(2);
    adapter.stop();
  }, 5000);

  it('re-sends subscribe payloads on reconnect', async () => {
    const adapter = new WebSocketSourceAdapter({
      type: 'websocket',
      url: server.url,
      subscribe: { method: 'SUBSCRIBE', params: ['btc@ticker'], id: 1 },
    });
    await adapter.start();
    await server.clientPromise;
    await new Promise((r) => setTimeout(r, 50));
    expect(server.received).toHaveLength(1);

    // Server force-closes the client; adapter's internal reconnect (5s
    // delay) should fire and re-run start(), which re-sends subscribe.
    server.forceCloseClient();
    await new Promise((r) => setTimeout(r, 5500));
    expect(server.received.length).toBeGreaterThanOrEqual(2);
    expect((server.received[server.received.length - 1] as { method: string }).method).toBe(
      'SUBSCRIBE',
    );
    adapter.stop();
  }, 10_000);

  it('stops heartbeat timer and does not reconnect after stop()', async () => {
    const adapter = new WebSocketSourceAdapter({
      type: 'websocket',
      url: server.url,
      subscribe: { method: 'SUBSCRIBE', params: ['x'], id: 1 },
      heartbeat: { payload: { method: 'PING' }, interval: '1s' },
    });
    await adapter.start();
    await server.clientPromise;
    await new Promise((r) => setTimeout(r, 100));
    const beforeStop = server.received.length;

    adapter.stop();
    // Wait through one would-be reconnect window + a few heartbeat ticks.
    await new Promise((r) => setTimeout(r, 6000));
    // No new SUBSCRIBE re-sent (would indicate reconnect happened) and
    // no new PING ticks (heartbeat would have kept firing).
    expect(server.received.length).toBe(beforeStop);
  }, 10_000);

  it('still ingests messages from the server (no regression to base behaviour)', async () => {
    const adapter = new WebSocketSourceAdapter({
      type: 'websocket',
      url: server.url,
    });
    await adapter.start();
    const client = await server.clientPromise;
    client.send(JSON.stringify({ price: 100 }));
    client.send(JSON.stringify({ price: 101 }));
    await new Promise((r) => setTimeout(r, 50));
    expect(adapter.getData()).toEqual([{ price: 100 }, { price: 101 }]);
    adapter.stop();
  });
});
