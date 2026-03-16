import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector } from '../../src/monitoring/metrics.js';

describe('MetricsCollector', () => {
  let metrics: MetricsCollector;

  beforeEach(() => {
    metrics = new MetricsCollector();
  });

  describe('timing', () => {
    it('should record timing metrics', () => {
      metrics.timing('test.operation', 100);
      metrics.timing('test.operation', 200);
      metrics.timing('test.operation', 150);

      const stats = metrics.getStats('test.operation');

      expect(stats).toBeDefined();
      expect(stats!.count).toBe(3);
      expect(stats!.min).toBe(100);
      expect(stats!.max).toBe(200);
      expect(stats!.avg).toBe(150);
    });

    it('should support tags', () => {
      metrics.timing('api.request', 100, { endpoint: '/users' });
      metrics.timing('api.request', 200, { endpoint: '/posts' });

      const usersStats = metrics.getStats('api.request', { endpoint: '/users' });
      const postsStats = metrics.getStats('api.request', { endpoint: '/posts' });

      expect(usersStats!.count).toBe(1);
      expect(postsStats!.count).toBe(1);
    });
  });

  describe('counter', () => {
    it('should increment counters', () => {
      metrics.increment('requests.total');
      metrics.increment('requests.total');
      metrics.increment('requests.total', 3);

      expect(metrics.getCounter('requests.total')).toBe(5);
    });

    it('should support tags', () => {
      metrics.increment('requests', 1, { status: '200' });
      metrics.increment('requests', 1, { status: '404' });

      expect(metrics.getCounter('requests', { status: '200' })).toBe(1);
      expect(metrics.getCounter('requests', { status: '404' })).toBe(1);
    });
  });

  describe('gauge', () => {
    it('should set gauge values', () => {
      metrics.gauge('memory.usage', 1024);
      expect(metrics.getGauge('memory.usage')).toBe(1024);

      metrics.gauge('memory.usage', 2048);
      expect(metrics.getGauge('memory.usage')).toBe(2048);
    });
  });

  describe('percentiles', () => {
    it('should calculate percentiles', () => {
      for (let i = 1; i <= 100; i++) {
        metrics.timing('test', i);
      }

      const stats = metrics.getStats('test');

      expect(stats!.p50).toBeCloseTo(50, 0);
      expect(stats!.p95).toBeCloseTo(95, 0);
      expect(stats!.p99).toBeCloseTo(99, 0);
    });
  });

  describe('reset', () => {
    it('should reset all metrics', () => {
      metrics.timing('test', 100);
      metrics.increment('counter');
      metrics.gauge('gauge', 50);

      metrics.reset();

      expect(metrics.getStats('test')).toBeUndefined();
      expect(metrics.getCounter('counter')).toBe(0);
      expect(metrics.getGauge('gauge')).toBeUndefined();
    });
  });
});
