import { randomUUID } from 'node:crypto';
export class Tracer {
    spans = new Map();
    activeSpans = new Map(); // contextId -> spanId
    startSpan(name, traceId, parentId) {
        const span = {
            id: randomUUID(),
            traceId: traceId || randomUUID(),
            parentId,
            name,
            startTime: Date.now(),
            tags: {},
            logs: []
        };
        this.spans.set(span.id, span);
        return span;
    }
    endSpan(spanId) {
        const span = this.spans.get(spanId);
        if (span && !span.endTime) {
            span.endTime = Date.now();
            span.duration = span.endTime - span.startTime;
        }
    }
    addTag(spanId, key, value) {
        const span = this.spans.get(spanId);
        if (span) {
            span.tags[key] = value;
        }
    }
    addLog(spanId, message, data) {
        const span = this.spans.get(spanId);
        if (span) {
            span.logs.push({
                timestamp: Date.now(),
                message,
                data
            });
        }
    }
    getSpan(spanId) {
        return this.spans.get(spanId);
    }
    getTrace(traceId) {
        return Array.from(this.spans.values()).filter(s => s.traceId === traceId);
    }
    getAllSpans() {
        return Array.from(this.spans.values());
    }
    clear() {
        this.spans.clear();
        this.activeSpans.clear();
    }
    // Get trace tree structure
    getTraceTree(traceId) {
        const spans = this.getTrace(traceId);
        const rootSpans = spans.filter(s => !s.parentId);
        const buildTree = (span) => {
            const children = spans
                .filter(s => s.parentId === span.id)
                .map(buildTree);
            return {
                id: span.id,
                name: span.name,
                duration: span.duration,
                tags: span.tags,
                children
            };
        };
        return rootSpans.map(buildTree);
    }
}
// Global tracer instance
export const tracer = new Tracer();
// Decorator for automatic tracing
export function trace(name) {
    return function (_target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        const spanName = name || propertyKey;
        descriptor.value = async function (...args) {
            const span = tracer.startSpan(spanName);
            try {
                const result = await originalMethod.apply(this, args);
                tracer.addTag(span.id, 'status', 'success');
                return result;
            }
            catch (error) {
                tracer.addTag(span.id, 'status', 'error');
                tracer.addLog(span.id, 'Error occurred', { error: error.message });
                throw error;
            }
            finally {
                tracer.endSpan(span.id);
            }
        };
        return descriptor;
    };
}
// Utility function for manual tracing
export async function traceAsync(name, fn, traceId, parentId) {
    const span = tracer.startSpan(name, traceId, parentId);
    try {
        const result = await fn(span);
        tracer.addTag(span.id, 'status', 'success');
        return result;
    }
    catch (error) {
        tracer.addTag(span.id, 'status', 'error');
        tracer.addLog(span.id, 'Error occurred', { error: error.message });
        throw error;
    }
    finally {
        tracer.endSpan(span.id);
    }
}
//# sourceMappingURL=tracer.js.map