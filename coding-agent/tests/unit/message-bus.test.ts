import { describe, it, expect, beforeEach } from 'vitest';
import { MessageBus } from '../../src/core/message-bus.js';

describe('MessageBus', () => {
  let messageBus: MessageBus;

  beforeEach(() => {
    messageBus = new MessageBus();
  });

  describe('subscribe', () => {
    it('should subscribe to events', () => {
      const handler = () => {};
      const unsubscribe = messageBus.subscribe('agent:message', handler);

      expect(unsubscribe).toBeInstanceOf(Function);
      expect(messageBus.getHandlerCount('agent:message')).toBe(1);
    });

    it('should allow multiple subscribers', () => {
      messageBus.subscribe('agent:message', () => {});
      messageBus.subscribe('agent:message', () => {});

      expect(messageBus.getHandlerCount('agent:message')).toBe(2);
    });
  });

  describe('publish', () => {
    it('should notify subscribers', async () => {
      let called = false;
      messageBus.subscribe('agent:message', () => {
        called = true;
      });

      await messageBus.publish('agent:message', { test: true });

      expect(called).toBe(true);
    });

    it('should pass data to handlers', async () => {
      let receivedData: any;
      messageBus.subscribe('agent:message', (data) => {
        receivedData = data;
      });

      await messageBus.publish('agent:message', { test: 'data' });

      expect(receivedData).toEqual({ test: 'data' });
    });

    it('should handle async handlers', async () => {
      let completed = false;
      messageBus.subscribe('agent:message', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        completed = true;
      });

      await messageBus.publish('agent:message', {});

      expect(completed).toBe(true);
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe handler', () => {
      const handler = () => {};
      const unsubscribe = messageBus.subscribe('agent:message', handler);

      unsubscribe();

      expect(messageBus.getHandlerCount('agent:message')).toBe(0);
    });
  });

  describe('getEventLog', () => {
    it('should log events', async () => {
      await messageBus.publish('agent:message', { test: true });

      const log = messageBus.getEventLog();

      expect(log).toHaveLength(1);
      expect(log[0].type).toBe('agent:message');
      expect(log[0].data).toEqual({ test: true });
    });

    it('should filter events by type', async () => {
      await messageBus.publish('agent:message', {});
      await messageBus.publish('agent:response', {});

      const log = messageBus.getEventLog({ type: 'agent:message' });

      expect(log).toHaveLength(1);
      expect(log[0].type).toBe('agent:message');
    });
  });
});
