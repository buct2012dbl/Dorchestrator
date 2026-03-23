export class MetricsCollector {
    metrics = new Map();
    counters = new Map();
    gauges = new Map();
    // Record a timing metric (in milliseconds)
    timing(name, value, tags) {
        const key = this.getKey(name, tags);
        if (!this.metrics.has(key)) {
            this.metrics.set(key, []);
        }
        this.metrics.get(key).push(value);
    }
    // Increment a counter
    increment(name, value = 1, tags) {
        const key = this.getKey(name, tags);
        this.counters.set(key, (this.counters.get(key) || 0) + value);
    }
    // Set a gauge value
    gauge(name, value, tags) {
        const key = this.getKey(name, tags);
        this.gauges.set(key, value);
    }
    // Get statistics for a metric
    getStats(name, tags) {
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
    getCounter(name, tags) {
        const key = this.getKey(name, tags);
        return this.counters.get(key) || 0;
    }
    // Get gauge value
    getGauge(name, tags) {
        const key = this.getKey(name, tags);
        return this.gauges.get(key);
    }
    // Get all metrics
    getAllMetrics() {
        const result = {
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
    reset() {
        this.metrics.clear();
        this.counters.clear();
        this.gauges.clear();
    }
    // Reset specific metric
    resetMetric(name, tags) {
        const key = this.getKey(name, tags);
        this.metrics.delete(key);
        this.counters.delete(key);
        this.gauges.delete(key);
    }
    getKey(name, tags) {
        if (!tags || Object.keys(tags).length === 0) {
            return name;
        }
        const tagStr = Object.entries(tags)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}:${v}`)
            .join(',');
        return `${name}{${tagStr}}`;
    }
    percentile(sorted, p) {
        const index = Math.ceil(sorted.length * p) - 1;
        return sorted[Math.max(0, index)];
    }
}
// Global metrics instance
export const metrics = new MetricsCollector();
// Utility function to measure execution time
export async function measureAsync(name, fn, tags) {
    const start = Date.now();
    try {
        const result = await fn();
        metrics.timing(name, Date.now() - start, tags);
        return result;
    }
    catch (error) {
        metrics.timing(name, Date.now() - start, { ...tags, error: 'true' });
        throw error;
    }
}
// Utility function to measure sync execution time
export function measureSync(name, fn, tags) {
    const start = Date.now();
    try {
        const result = fn();
        metrics.timing(name, Date.now() - start, tags);
        return result;
    }
    catch (error) {
        metrics.timing(name, Date.now() - start, { ...tags, error: 'true' });
        throw error;
    }
}
//# sourceMappingURL=metrics.js.map