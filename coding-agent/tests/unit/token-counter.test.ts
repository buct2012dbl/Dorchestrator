import { describe, it, expect, beforeEach } from 'vitest';
import { TokenCounter } from '../../src/llm/token-counter.js';

describe('TokenCounter', () => {
  let tokenCounter: TokenCounter;

  beforeEach(() => {
    tokenCounter = new TokenCounter();
  });

  describe('count', () => {
    it('should count tokens in text', () => {
      const text = 'Hello, world!';
      const count = tokenCounter.count(text);

      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(10);
    });

    it('should handle empty text', () => {
      const count = tokenCounter.count('');

      expect(count).toBe(0);
    });

    it('should handle long text', () => {
      const text = 'a'.repeat(1000);
      const count = tokenCounter.count(text);

      expect(count).toBeGreaterThan(100);
    });
  });

  describe('countMessages', () => {
    it('should count tokens in messages', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ];

      const count = tokenCounter.countMessages(messages);

      expect(count).toBeGreaterThan(0);
    });

    it('should include message overhead', () => {
      const messages = [{ role: 'user', content: 'Hi' }];

      const count = tokenCounter.countMessages(messages);
      const contentCount = tokenCounter.count('Hi');

      expect(count).toBeGreaterThan(contentCount);
    });
  });

  describe('estimateTokens', () => {
    it('should provide fast estimation', () => {
      const text = 'Hello, world!';
      const estimate = tokenCounter.estimateTokens(text);

      expect(estimate).toBeGreaterThan(0);
      expect(estimate).toBeLessThan(10);
    });

    it('should be roughly accurate', () => {
      const text = 'a'.repeat(400); // ~100 tokens
      const estimate = tokenCounter.estimateTokens(text);

      expect(estimate).toBeGreaterThan(80);
      expect(estimate).toBeLessThan(120);
    });
  });
});
