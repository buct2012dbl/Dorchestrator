export interface SharedContextEntry {
    id: string;
    key: string;
    value: any;
    agentId: string;
    timestamp: number;
    ttl?: number;
}
export declare class SharedContextStore {
    private store;
    private subscribers;
    set(key: string, value: any, agentId: string, ttl?: number): string;
    get(key: string): any | undefined;
    getEntry(key: string): SharedContextEntry | undefined;
    has(key: string): boolean;
    delete(key: string): void;
    clear(): void;
    keys(): string[];
    entries(): SharedContextEntry[];
    subscribe(key: string, callback: (entry: SharedContextEntry) => void): () => void;
    private notifySubscribers;
    getByAgent(agentId: string): SharedContextEntry[];
    search(pattern: string): SharedContextEntry[];
    getStats(): {
        total: number;
        byAgent: Record<string, number>;
        subscribers: number;
    };
}
export declare const sharedContext: SharedContextStore;
//# sourceMappingURL=shared-store.d.ts.map