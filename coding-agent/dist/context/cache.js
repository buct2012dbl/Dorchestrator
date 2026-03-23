import { createHash } from 'node:crypto';
export class FileCache {
    cache = new Map();
    maxSize;
    maxAge;
    constructor(maxSize = 1000, maxAge = 300000) {
        this.maxSize = maxSize;
        this.maxAge = maxAge;
    }
    set(key, data) {
        // Evict old entries if cache is full
        if (this.cache.size >= this.maxSize) {
            this.evict();
        }
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            hits: 0
        });
    }
    get(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return undefined;
        // Check if expired
        if (Date.now() - entry.timestamp > this.maxAge) {
            this.cache.delete(key);
            return undefined;
        }
        // Update hit count
        entry.hits++;
        return entry.data;
    }
    has(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return false;
        // Check if expired
        if (Date.now() - entry.timestamp > this.maxAge) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }
    delete(key) {
        this.cache.delete(key);
    }
    clear() {
        this.cache.clear();
    }
    evict() {
        // LRU eviction: remove least recently used (lowest hits)
        let minHits = Infinity;
        let evictKey = null;
        for (const [key, entry] of this.cache.entries()) {
            if (entry.hits < minHits) {
                minHits = entry.hits;
                evictKey = key;
            }
        }
        if (evictKey) {
            this.cache.delete(evictKey);
        }
    }
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            utilization: this.cache.size / this.maxSize
        };
    }
    static hashKey(data) {
        return createHash('sha256').update(data).digest('hex');
    }
}
//# sourceMappingURL=cache.js.map