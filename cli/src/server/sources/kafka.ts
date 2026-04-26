import { randomBytes } from 'node:crypto';
import { Kafka, logLevel, type Consumer, type SASLOptions } from 'kafkajs';
import type { KafkaSourceConfig } from '../../config/schema.js';
import { expandEnv } from '../../utils/expandEnv.js';
import type { SourceAdapter, SourceStatus } from './types.js';

const DEFAULT_MAX_BUFFER = 1000;

function normalizeBrokers(brokers: string | string[]): string[] {
  const list = Array.isArray(brokers) ? brokers : brokers.split(',');
  return list.map((b) => expandEnv(b.trim(), 'kafka source brokers')).filter(Boolean);
}

export class KafkaSourceAdapter implements SourceAdapter {
  private data: unknown[] = [];
  private kafka: Kafka | null = null;
  private consumer: Consumer | null = null;
  private lastFetch: Date | null = null;
  private error?: string;
  private connected = false;
  private listeners = new Set<(data: unknown[]) => void>();
  private readonly maxBuffer: number;
  private readonly groupId: string;

  constructor(private config: KafkaSourceConfig) {
    this.maxBuffer = config.maxBuffer ?? DEFAULT_MAX_BUFFER;
    // Auto-generate a per-process consumer group by default so each pipequery
    // instance sees the full firehose. Users who want load-balanced consumption
    // across replicas can set groupId explicitly in the yaml.
    this.groupId = config.groupId ?? `pipequery-${randomBytes(6).toString('hex')}`;
  }

  async start(): Promise<void> {
    const brokers = normalizeBrokers(this.config.brokers);
    if (brokers.length === 0) {
      throw new Error('Kafka source has no brokers configured');
    }

    this.kafka = new Kafka({
      clientId: `pipequery-${this.config.topic}`,
      brokers,
      ssl: this.config.ssl ?? false,
      sasl: this.config.sasl
        ? ({
            mechanism: this.config.sasl.mechanism,
            username: expandEnv(this.config.sasl.username, 'kafka source SASL username'),
            password: expandEnv(this.config.sasl.password, 'kafka source SASL password'),
          } as SASLOptions)
        : undefined,
      // Silence kafkajs's own logger — we surface errors via SourceStatus.
      logLevel: logLevel.ERROR,
    });

    this.consumer = this.kafka.consumer({ groupId: this.groupId });
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: this.config.topic,
      fromBeginning: this.config.fromBeginning ?? false,
    });
    this.connected = true;
    this.error = undefined;

    // Fire-and-forget; kafkajs's run() resolves immediately and keeps running
    // in the background until disconnect().
    void this.consumer.run({
      eachMessage: async ({ message, partition }) => {
        try {
          const row = this.decode(message.value, message.key, message.timestamp, partition, message.offset);
          this.data.push(row);
          if (this.data.length > this.maxBuffer) {
            this.data = this.data.slice(-this.maxBuffer);
          }
          this.lastFetch = new Date();
          this.error = undefined;
          this.notify();
        } catch {
          // Skip malformed messages rather than crashing the consumer.
        }
      },
    });
  }

  stop(): void {
    this.connected = false;
    if (this.consumer) {
      const consumer = this.consumer;
      this.consumer = null;
      // Fire-and-forget disconnect; SourceAdapter.stop() is sync, matching
      // the rest of the adapters.
      void consumer.disconnect().catch(() => {
        // Swallow — we're shutting down anyway.
      });
    }
    this.kafka = null;
  }

  getData(): unknown[] {
    return this.data;
  }

  getStatus(): SourceStatus {
    return {
      healthy: this.connected && !this.error,
      rowCount: this.data.length,
      lastFetch: this.lastFetch,
      error: this.error,
    };
  }

  onUpdate(callback: (data: unknown[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private decode(
    value: Buffer | null,
    key: Buffer | null,
    timestamp: string,
    partition: number,
    offset: string,
  ): Record<string, unknown> {
    const base: Record<string, unknown> = {
      _kafka_topic: this.config.topic,
      _kafka_partition: partition,
      _kafka_offset: offset,
      _kafka_timestamp: Number.parseInt(timestamp, 10),
      _kafka_key: key ? key.toString('utf8') : null,
    };

    if (!value) {
      return { ...base, value: null };
    }

    const format = this.config.valueFormat ?? 'json';
    if (format === 'string') {
      return { ...base, value: value.toString('utf8') };
    }
    if (format === 'raw') {
      return { ...base, value: value.toString('base64') };
    }
    // json
    const decoded = JSON.parse(value.toString('utf8')) as unknown;
    if (decoded !== null && typeof decoded === 'object' && !Array.isArray(decoded)) {
      // Spread the message body into the top-level row so queries can reference
      // fields directly (e.g. `events | where(event_type == 'order.paid')`).
      return { ...base, ...(decoded as Record<string, unknown>) };
    }
    return { ...base, value: decoded };
  }

  private notify(): void {
    for (const cb of this.listeners) cb(this.data);
  }
}
