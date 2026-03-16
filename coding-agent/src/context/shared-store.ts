import { randomUUID } from 'node:crypto';

export interface SharedContextEntry {
  id: string;
  key: string;
  value: any;
  agentId: string;
  timestamp: number;
  ttl?: number;
}

export class SharedContextStore {
  private store = new Map<string, SharedContextEntry>();
  private subscribers = new Map<string, Set<(entry: SharedContextEntry) => void>>();

  set(key: string, value: any, agentId: string, ttl?: number): string {
    const id = randomUUID();
    const entry: SharedContextEntry = {
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

  get(key: string): any | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  getEntry(key: string): SharedContextEntry | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(key);
      return undefined;
    }

    return entry;
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;

    // Check TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }

  entries(): SharedContextEntry[] {
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
  subscribe(key: string, callback: (entry: SharedContextEntry) => void): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }

    this.subscribers.get(key)!.add(callback);

    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(key);
      if (subs) {
        subs.delete(callback);
      }
    };
  }

  private notifySubscribers(key: string, entry: SharedContextEntry): void {
    const subs = this.subscribers.get(key);
    if (subs) {
      for (const callback of subs) {
        try {
          callback(entry);
        } catch (error) {
          console.error('Error in subscriber callback:', error);
        }
      }
    }
  }

  // Get all entries by agent
  getByAgent(agentId: string): SharedContextEntry[] {
    return this.entries().filter(entry => entry.agentId === agentId);
  }

  // Search entries by key pattern
  search(pattern: string): SharedContextEntry[] {
    const regex = new RegExp(pattern);
    return this.entries().filter(entry => regex.test(entry.key));
  }

  getStats() {
    const entries = this.entries();
    const byAgent: Record<string, number> = {};

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
