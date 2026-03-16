import { randomUUID } from 'node:crypto';

export interface Span {
  id: string;
  traceId: string;
  parentId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, string>;
  logs: Array<{ timestamp: number; message: string; data?: any }>;
}

export class Tracer {
  private spans = new Map<string, Span>();
  private activeSpans = new Map<string, string>(); // contextId -> spanId

  startSpan(name: string, traceId?: string, parentId?: string): Span {
    const span: Span = {
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

  endSpan(spanId: string): void {
    const span = this.spans.get(spanId);
    if (span && !span.endTime) {
      span.endTime = Date.now();
      span.duration = span.endTime - span.startTime;
    }
  }

  addTag(spanId: string, key: string, value: string): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.tags[key] = value;
    }
  }

  addLog(spanId: string, message: string, data?: any): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.logs.push({
        timestamp: Date.now(),
        message,
        data
      });
    }
  }

  getSpan(spanId: string): Span | undefined {
    return this.spans.get(spanId);
  }

  getTrace(traceId: string): Span[] {
    return Array.from(this.spans.values()).filter(s => s.traceId === traceId);
  }

  getAllSpans(): Span[] {
    return Array.from(this.spans.values());
  }

  clear(): void {
    this.spans.clear();
    this.activeSpans.clear();
  }

  // Get trace tree structure
  getTraceTree(traceId: string): any {
    const spans = this.getTrace(traceId);
    const rootSpans = spans.filter(s => !s.parentId);

    const buildTree = (span: Span): any => {
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
export function trace(name?: string) {
  return function (
    _target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const spanName = name || propertyKey;

    descriptor.value = async function (...args: any[]) {
      const span = tracer.startSpan(spanName);

      try {
        const result = await originalMethod.apply(this, args);
        tracer.addTag(span.id, 'status', 'success');
        return result;
      } catch (error) {
        tracer.addTag(span.id, 'status', 'error');
        tracer.addLog(span.id, 'Error occurred', { error: (error as Error).message });
        throw error;
      } finally {
        tracer.endSpan(span.id);
      }
    };

    return descriptor;
  };
}

// Utility function for manual tracing
export async function traceAsync<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  traceId?: string,
  parentId?: string
): Promise<T> {
  const span = tracer.startSpan(name, traceId, parentId);

  try {
    const result = await fn(span);
    tracer.addTag(span.id, 'status', 'success');
    return result;
  } catch (error) {
    tracer.addTag(span.id, 'status', 'error');
    tracer.addLog(span.id, 'Error occurred', { error: (error as Error).message });
    throw error;
  } finally {
    tracer.endSpan(span.id);
  }
}
