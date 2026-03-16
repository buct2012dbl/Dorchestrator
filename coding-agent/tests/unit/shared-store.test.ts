import { describe, it, expect } from 'vitest';
import { SharedContextStore } from '../../src/context/shared-store.js';

describe('SharedContextStore', () => {
  let store: SharedContextStore;

  beforeEach(() => {
    store = new SharedContextStore();
  });

  describe('set and get', () => {
    it('should store and retrieve values', () => {
      store.set('key1', 'value1', 'agent1');

      expect(store.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      expect(store.get('non-existent')).toBeUndefined();
    });

    it('should overwrite existing values', () => {
      store.set('key1', 'value1', 'agent1');
      store.set('key1', 'value2', 'agent2');

      expect(store.get('key1')).toBe('value2');
    });
  });

  describe('TTL', () => {
    it('should expire entries after TTL', async () => {
      store.set('key1', 'value1', 'agent1', 100);

      expect(store.get('key1')).toBe('value1');

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(store.get('key1')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should check if key exists', () => {
      store.set('key1', 'value1', 'agent1');

      expect(store.has('key1')).toBe(true);
      expect(store.has('key2')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete entries', () => {
      store.set('key1', 'value1', 'agent1');
      store.delete('key1');

      expect(store.has('key1')).toBe(false);
    });
  });

  describe('getByAgent', () => {
    it('should filter entries by agent', () => {
      store.set('key1', 'value1', 'agent1');
      store.set('key2', 'value2', 'agent1');
      store.set('key3', 'value3', 'agent2');

      const agent1Entries = store.getByAgent('agent1');

      expect(agent1Entries).toHaveLength(2);
      expect(agent1Entries.every(e => e.agentId === 'agent1')).toBe(true);
    });
  });

  describe('search', () => {
    it('should search by pattern', () => {
      store.set('api.users', 'data1', 'agent1');
      store.set('api.posts', 'data2', 'agent1');
      store.set('db.users', 'data3', 'agent1');

      const results = store.search('^api\\.');

      expect(results).toHaveLength(2);
      expect(results.every(e => e.key.startsWith('api.'))).toBe(true);
    });
  });

  describe('subscribe', () => {
    it('should notify subscribers on changes', () => {
      let notified = false;
      store.subscribe('key1', () => {
        notified = true;
      });

      store.set('key1', 'value1', 'agent1');

      expect(notified).toBe(true);
    });

    it('should allow unsubscribe', () => {
      let count = 0;
      const unsubscribe = store.subscribe('key1', () => {
        count++;
      });

      store.set('key1', 'value1', 'agent1');
      unsubscribe();
      store.set('key1', 'value2', 'agent1');

      expect(count).toBe(1);
    });
  });
});
