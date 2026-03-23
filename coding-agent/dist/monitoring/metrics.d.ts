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
export declare class MetricsCollector {
    private metrics;
    private counters;
    private gauges;
    timing(name: string, value: number, tags?: Record<string, string>): void;
    increment(name: string, value?: number, tags?: Record<string, string>): void;
    gauge(name: string, value: number, tags?: Record<string, string>): void;
    getStats(name: string, tags?: Record<string, string>): MetricStats | undefined;
    getCounter(name: string, tags?: Record<string, string>): number;
    getGauge(name: string, tags?: Record<string, string>): number | undefined;
    getAllMetrics(): Record<string, any>;
    reset(): void;
    resetMetric(name: string, tags?: Record<string, string>): void;
    private getKey;
    private percentile;
}
export declare const metrics: MetricsCollector;
export declare function measureAsync<T>(name: string, fn: () => Promise<T>, tags?: Record<string, string>): Promise<T>;
export declare function measureSync<T>(name: string, fn: () => T, tags?: Record<string, string>): T;
//# sourceMappingURL=metrics.d.ts.map