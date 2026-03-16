type EventHandler = (data: any) => void | Promise<void>;

export type EventType =
  | 'agent:message'
  | 'agent:response'
  | 'agent:tool-call'
  | 'agent:status'
  | 'agent:error'
  | 'agent:spawn'
  | 'agent:broadcast'
  | 'context:update'
  | 'session:start'
  | 'session:end'
  | 'tool:execute'
  | 'tool:result';

export interface Event {
  type: EventType;
  data: any;
  timestamp: number;
  sessionId?: string;
  agentId?: string;
}

export class MessageBus {
  private handlers = new Map<EventType, Set<EventHandler>>();
  private eventLog: Event[] = [];
  private maxLogSize = 1000;

  subscribe(event: EventType, handler: EventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => this.unsubscribe(event, handler);
  }

  unsubscribe(event: EventType, handler: EventHandler): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  async publish(event: EventType, data: any, metadata?: { sessionId?: string; agentId?: string }): Promise<void> {
    const eventObj: Event = {
      type: event,
      data,
      timestamp: Date.now(),
      sessionId: metadata?.sessionId,
      agentId: metadata?.agentId
    };

    // Log event
    this.eventLog.push(eventObj);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.shift();
    }

    // Notify handlers
    const handlers = this.handlers.get(event);
    if (handlers) {
      const promises = Array.from(handlers).map(handler => {
        try {
          return Promise.resolve(handler(data));
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
          return Promise.resolve();
        }
      });
      await Promise.all(promises);
    }
  }

  getEventLog(filter?: { type?: EventType; sessionId?: string; agentId?: string }): Event[] {
    if (!filter) return [...this.eventLog];

    return this.eventLog.filter(event => {
      if (filter.type && event.type !== filter.type) return false;
      if (filter.sessionId && event.sessionId !== filter.sessionId) return false;
      if (filter.agentId && event.agentId !== filter.agentId) return false;
      return true;
    });
  }

  clearEventLog(): void {
    this.eventLog = [];
  }

  getHandlerCount(event: EventType): number {
    return this.handlers.get(event)?.size || 0;
  }

  clear(): void {
    this.handlers.clear();
    this.eventLog = [];
  }
}

export const messageBus = new MessageBus();
