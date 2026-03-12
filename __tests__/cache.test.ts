import { describe, it, expect } from 'vitest';
import { QueryCache } from '../src/engine/cache';
import type { CompiledQuery } from '../src/engine/types';

function mockQuery(id: string): CompiledQuery {
  const fn = (() => []) as unknown as CompiledQuery;
  Object.defineProperty(fn, 'source', { value: id });
  Object.defineProperty(fn, 'ast', { value: { kind: 'Pipeline', source: '_data', operations: [] } });
  return fn;
}

describe('QueryCache', () => {
  it('stores and retrieves values', () => {
    const cache = new QueryCache(10);
    const q = mockQuery('a');
    cache.set('a', q);
    expect(cache.get('a')).toBe(q);
  });

  it('returns undefined for missing keys', () => {
    const cache = new QueryCache(10);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('evicts LRU entry when full', () => {
    const cache = new QueryCache(2);
    cache.set('a', mockQuery('a'));
    cache.set('b', mockQuery('b'));
    cache.set('c', mockQuery('c')); // should evict 'a'
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeDefined();
    expect(cache.get('c')).toBeDefined();
  });

  it('accessing a key promotes it (prevents eviction)', () => {
    const cache = new QueryCache(2);
    cache.set('a', mockQuery('a'));
    cache.set('b', mockQuery('b'));
    cache.get('a'); // promote 'a', now 'b' is LRU
    cache.set('c', mockQuery('c')); // should evict 'b'
    expect(cache.get('a')).toBeDefined();
    expect(cache.get('b')).toBeUndefined();
  });

  it('clear empties the cache', () => {
    const cache = new QueryCache(10);
    cache.set('a', mockQuery('a'));
    cache.set('b', mockQuery('b'));
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });

  it('size reports correct count', () => {
    const cache = new QueryCache(10);
    expect(cache.size).toBe(0);
    cache.set('a', mockQuery('a'));
    expect(cache.size).toBe(1);
    cache.set('b', mockQuery('b'));
    expect(cache.size).toBe(2);
  });

  it('updating existing key does not increase size', () => {
    const cache = new QueryCache(10);
    cache.set('a', mockQuery('a1'));
    cache.set('a', mockQuery('a2'));
    expect(cache.size).toBe(1);
  });
});
