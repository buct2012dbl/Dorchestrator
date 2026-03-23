type EventHandler = (data: any) => void | Promise<void>;
export type EventType = 'agent:message' | 'agent:response' | 'agent:tool-call' | 'agent:status' | 'agent:error' | 'agent:spawn' | 'agent:broadcast' | 'context:update' | 'session:start' | 'session:end' | 'tool:execute' | 'tool:result';
export interface Event {
    type: EventType;
    data: any;
    timestamp: number;
    sessionId?: string;
    agentId?: string;
}
export declare class MessageBus {
    private handlers;
    private eventLog;
    private maxLogSize;
    subscribe(event: EventType, handler: EventHandler): () => void;
    unsubscribe(event: EventType, handler: EventHandler): void;
    publish(event: EventType, data: any, metadata?: {
        sessionId?: string;
        agentId?: string;
    }): Promise<void>;
    getEventLog(filter?: {
        type?: EventType;
        sessionId?: string;
        agentId?: string;
    }): Event[];
    clearEventLog(): void;
    getHandlerCount(event: EventType): number;
    clear(): void;
}
export declare const messageBus: MessageBus;
export {};
//# sourceMappingURL=message-bus.d.ts.map