export class MessageBus {
    handlers = new Map();
    eventLog = [];
    maxLogSize = 1000;
    subscribe(event, handler) {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, new Set());
        }
        this.handlers.get(event).add(handler);
        // Return unsubscribe function
        return () => this.unsubscribe(event, handler);
    }
    unsubscribe(event, handler) {
        const handlers = this.handlers.get(event);
        if (handlers) {
            handlers.delete(handler);
        }
    }
    async publish(event, data, metadata) {
        const eventObj = {
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
                }
                catch (error) {
                    console.error(`Error in event handler for ${event}:`, error);
                    return Promise.resolve();
                }
            });
            await Promise.all(promises);
        }
    }
    getEventLog(filter) {
        if (!filter)
            return [...this.eventLog];
        return this.eventLog.filter(event => {
            if (filter.type && event.type !== filter.type)
                return false;
            if (filter.sessionId && event.sessionId !== filter.sessionId)
                return false;
            if (filter.agentId && event.agentId !== filter.agentId)
                return false;
            return true;
        });
    }
    clearEventLog() {
        this.eventLog = [];
    }
    getHandlerCount(event) {
        return this.handlers.get(event)?.size || 0;
    }
    clear() {
        this.handlers.clear();
        this.eventLog = [];
    }
}
export const messageBus = new MessageBus();
//# sourceMappingURL=message-bus.js.map