export interface Span {
    id: string;
    traceId: string;
    parentId?: string;
    name: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    tags: Record<string, string>;
    logs: Array<{
        timestamp: number;
        message: string;
        data?: any;
    }>;
}
export declare class Tracer {
    private spans;
    private activeSpans;
    startSpan(name: string, traceId?: string, parentId?: string): Span;
    endSpan(spanId: string): void;
    addTag(spanId: string, key: string, value: string): void;
    addLog(spanId: string, message: string, data?: any): void;
    getSpan(spanId: string): Span | undefined;
    getTrace(traceId: string): Span[];
    getAllSpans(): Span[];
    clear(): void;
    getTraceTree(traceId: string): any;
}
export declare const tracer: Tracer;
export declare function trace(name?: string): (_target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
export declare function traceAsync<T>(name: string, fn: (span: Span) => Promise<T>, traceId?: string, parentId?: string): Promise<T>;
//# sourceMappingURL=tracer.d.ts.map