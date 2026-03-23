import { randomUUID } from 'node:crypto';
export class SharedContextStore {
    store = new Map();
    subscribers = new Map();
    set(key, value, agentId, ttl) {
        const id = randomUUID();
        const entry = {
            id,
            key,
            value,
            agentId,
            timestamp: Date.now(),
            ttl
        };
        this.store.set(key, entry);
        // Notify subscribers
        this.notifySubscribers(key, entry);
        return id;
    }
    get(key) {
        const entry = this.store.get(key);
        if (!entry)
            return undefined;
        // Check TTL
        if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
            this.store.delete(key);
            return undefined;
        }
        return entry.value;
    }
    getEntry(key) {
        const entry = this.store.get(key);
        if (!entry)
            return undefined;
        // Check TTL
        if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
            this.store.delete(key);
            return undefined;
        }
        return entry;
    }
    has(key) {
        const entry = this.store.get(key);
        if (!entry)
            return false;
        // Check TTL
        if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
            this.store.delete(key);
            return false;
        }
        return true;
    }
    delete(key) {
        this.store.delete(key);
    }
    clear() {
        this.store.clear();
    }
    keys() {
        return Array.from(this.store.keys());
    }
    entries() {
        return Array.from(this.store.values()).filter(entry => {
            // Filter out expired entries
            if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
                this.store.delete(entry.key);
                return false;
            }
            return true;
        });
    }
    // Subscribe to changes on a specific key
    subscribe(key, callback) {
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, new Set());
        }
        this.subscribers.get(key).add(callback);
        // Return unsubscribe function
        return () => {
            const subs = this.subscribers.get(key);
            if (subs) {
                subs.delete(callback);
            }
        };
    }
    notifySubscribers(key, entry) {
        const subs = this.subscribers.get(key);
        if (subs) {
            for (const callback of subs) {
                try {
                    callback(entry);
                }
                catch (error) {
                    console.error('Error in subscriber callback:', error);
                }
            }
        }
    }
    // Get all entries by agent
    getByAgent(agentId) {
        return this.entries().filter(entry => entry.agentId === agentId);
    }
    // Search entries by key pattern
    search(pattern) {
        const regex = new RegExp(pattern);
        return this.entries().filter(entry => regex.test(entry.key));
    }
    getStats() {
        const entries = this.entries();
        const byAgent = {};
        for (const entry of entries) {
            byAgent[entry.agentId] = (byAgent[entry.agentId] || 0) + 1;
        }
        return {
            total: entries.length,
            byAgent,
            subscribers: this.subscribers.size
        };
    }
}
export const sharedContext = new SharedContextStore();
//# sourceMappingURL=shared-store.js.map