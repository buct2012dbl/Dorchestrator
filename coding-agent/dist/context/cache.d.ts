export declare class FileCache<T = string> {
    private cache;
    private maxSize;
    private maxAge;
    constructor(maxSize?: number, maxAge?: number);
    set(key: string, data: T): void;
    get(key: string): T | undefined;
    has(key: string): boolean;
    delete(key: string): void;
    clear(): void;
    private evict;
    getStats(): {
        size: number;
        maxSize: number;
        utilization: number;
    };
    static hashKey(data: string): string;
}
//# sourceMappingURL=cache.d.ts.map