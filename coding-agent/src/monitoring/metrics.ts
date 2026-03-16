export interface Metric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface MetricStats {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

export class MetricsCollector {
  private metrics = new Map<string, number[]>();
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();

  // Record a timing metric (in milliseconds)
  timing(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.getKey(name, tags);
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    this.metrics.get(key)!.push(value);
  }

  // Increment a counter
  increment(name: string, value: number = 1, tags?: Record<string, string>): void {
    const key = this.getKey(name, tags);
    this.counters.set(key, (this.counters.get(key) || 0) + value);
  }

  // Set a gauge value
  gauge(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.getKey(name, tags);
    this.gauges.set(key, value);
  }

  // Get statistics for a metric
  getStats(name: string, tags?: Record<string, string>): MetricStats | undefined {
    const key = this.getKey(name, tags);
    const values = this.metrics.get(key);

    if (!values || values.length === 0) {
      return undefined;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);

    return {
      count: sorted.length,
      sum,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / sorted.length,
      p50: this.percentile(sorted, 0.5),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99)
    };
  }

  // Get counter value
  getCounter(name: string, tags?: Record<string, string>): number {
    const key = this.getKey(name, tags);
    return this.counters.get(key) || 0;
  }

  // Get gauge value
  getGauge(name: string, tags?: Record<string, string>): number | undefined {
    const key = this.getKey(name, tags);
    return this.gauges.get(key);
  }

  // Get all metrics
  getAllMetrics(): Record<string, any> {
    const result: Record<string, any> = {
      timings: {},
      counters: {},
      gauges: {}
    };

    // Timings
    for (const key of this.metrics.keys()) {
      result.timings[key] = this.getStats(key);
    }

    // Counters
    for (const [key, value] of this.counters.entries()) {
      result.counters[key] = value;
    }

    // Gauges
    for (const [key, value] of this.gauges.entries()) {
      result.gauges[key] = value;
    }

    return result;
  }

  // Reset all metrics
  reset(): void {
    this.metrics.clear();
    this.counters.clear();
    this.gauges.clear();
  }

  // Reset specific metric
  resetMetric(name: string, tags?: Record<string, string>): void {
    const key = this.getKey(name, tags);
    this.metrics.delete(key);
    this.counters.delete(key);
    this.gauges.delete(key);
  }

  private getKey(name: string, tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) {
      return name;
    }

    const tagStr = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');

    return `${name}{${tagStr}}`;
  }

  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }
}

// Global metrics instance
export const metrics = new MetricsCollector();

// Utility function to measure execution time
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  tags?: Record<string, string>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    metrics.timing(name, Date.now() - start, tags);
    return result;
  } catch (error) {
    metrics.timing(name, Date.now() - start, { ...tags, error: 'true' });
    throw error;
  }
}

// Utility function to measure sync execution time
export function measureSync<T>(
  name: string,
  fn: () => T,
  tags?: Record<string, string>
): T {
  const start = Date.now();
  try {
    const result = fn();
    metrics.timing(name, Date.now() - start, tags);
    return result;
  } catch (error) {
    metrics.timing(name, Date.now() - start, { ...tags, error: 'true' });
    throw error;
  }
}
